//! Moteur de forwarding : aiguille les paquets RTP entre peers d'une même room.

use super::down_track::DownTrack;
use super::packet::RtpPacketData;
use super::sink::RtpSink;
use super::up_track::UpTrack;
use dashmap::DashMap;
use std::sync::Arc;

/// Les peers joignables d'une room, indexés par peer_id.
///
/// Le sink est stocké là plutôt que dans un index global : le fanout itère
/// alors sur les seuls membres de la room, sans balayer le serveur entier.
type RoomSinks = DashMap<String, Arc<dyn RtpSink>>;

/// Route les paquets RTP d'un publisher vers les autres peers de sa room.
///
/// Le `room_id` n'est ici qu'une clé de regroupement : le moteur ne connaît
/// pas le module `room/` et ne manipule que des `Arc<dyn RtpSink>`.
pub struct ForwardingEngine {
    /// Ce que chaque peer publie, indexé par peer_id.
    up_tracks: DashMap<String, Arc<UpTrack>>,
    /// Où écrire pour joindre les peers, groupés par room_id.
    rooms: DashMap<String, Arc<RoomSinks>>,
    /// Index peer_id → room_id, pour retrouver la room d'un peer en O(1).
    peer_rooms: DashMap<String, String>,
}

impl ForwardingEngine {
    pub fn new() -> Arc<Self> {
        Arc::new(ForwardingEngine {
            up_tracks: DashMap::new(),
            rooms: DashMap::new(),
            peer_rooms: DashMap::new(),
        })
    }

    /// Déclare un peer joignable dans une room.
    ///
    /// Appelé quand le peer rejoint effectivement une room, pas à la connexion :
    /// tant qu'il n'a rejoint personne, il ne reçoit rien et ne diffuse rien.
    /// Un peer déjà enregistré ailleurs est d'abord retiré de son ancienne room.
    pub fn add_peer(&self, room_id: String, peer_id: String, sink: Arc<dyn RtpSink>) {
        // La `Ref` est relâchée avant `remove_peer`, qui écrit dans la même map.
        let previous = self.peer_rooms.get(&peer_id).map(|r| r.clone());
        if previous.is_some_and(|previous| previous != room_id) {
            self.remove_peer(&peer_id);
        }

        let room = self
            .rooms
            .entry(room_id.clone())
            .or_insert_with(|| Arc::new(RoomSinks::new()))
            .clone();

        room.insert(peer_id.clone(), sink);
        self.peer_rooms.insert(peer_id.clone(), room_id.clone());

        tracing::info!(
            "ForwardingEngine — peer {} enregistré dans la room {}",
            peer_id,
            room_id
        );
    }

    /// Retire un peer : son sink, le flux qu'il publiait, et les down_tracks
    /// que les autres publishers de sa room tenaient sur lui.
    ///
    /// Ce dernier point est ce qui libère sa task d'écriture : chaque
    /// down_track garde un `Arc` sur son sink.
    pub fn remove_peer(&self, peer_id: &str) {
        // Les down_tracks du partant tombent avec son up_track.
        self.up_tracks.remove(peer_id);

        let Some((_, room_id)) = self.peer_rooms.remove(peer_id) else {
            return;
        };

        let Some(room) = self.rooms.get(&room_id).map(|r| Arc::clone(&*r)) else {
            return;
        };
        room.remove(peer_id);

        // Seuls les peers restés dans la room ont pu s'abonner à lui.
        for entry in room.iter() {
            if let Some(up_track) = self.up_tracks.get(entry.key()) {
                up_track.remove_subscriber(peer_id);
            }
        }

        if room.is_empty() {
            self.rooms.remove(&room_id);
        }

        tracing::info!(
            "ForwardingEngine — peer {} retiré de la room {}",
            peer_id,
            room_id
        );
    }

    /// Nombre de peers joignables, toutes rooms confondues.
    pub fn peer_count(&self) -> usize {
        self.peer_rooms.len()
    }

    /// Nombre de rooms qui comptent au moins un peer.
    pub fn room_count(&self) -> usize {
        self.rooms.len()
    }

    /// Flux publié par un peer, s'il en a un.
    pub fn up_track(&self, peer_id: &str) -> Option<Arc<UpTrack>> {
        self.up_tracks.get(peer_id).map(|t| t.clone())
    }

    /// Reçoit un paquet d'un publisher et le distribue aux autres peers de sa room.
    ///
    /// Un peer qui n'a rejoint aucune room ne diffuse à personne : le paquet est
    /// alors ignoré, sans même créer d'up_track.
    ///
    /// Le flux du publisher et les abonnements sont créés à la volée, au premier
    /// paquet : c'est le seul moment où l'on sait qu'un peer publie réellement.
    /// Chaque nouvel abonnement déclenche une demande de keyframe côté source,
    /// sans quoi le subscriber attendrait la prochaine keyframe spontanée.
    pub fn forward_rtp(&self, from_peer_id: &str, packet: RtpPacketData) {
        // Résolu avant toute itération : on clone l'`Arc` et on lâche la `Ref` —
        // qui tient un verrou de shard — immédiatement.
        let Some(room_id) = self.peer_rooms.get(from_peer_id).map(|r| r.clone()) else {
            return;
        };
        let Some(room) = self.rooms.get(&room_id).map(|r| Arc::clone(&*r)) else {
            return;
        };

        // `entry` réclame une clé possédée : l'appeler d'emblée allouerait une
        // `String` à chaque paquet, y compris — et surtout — quand l'up_track
        // existe déjà. Un `get()` d'abord réduit le régime établi à une simple
        // recherche ; la `Ref`, qui tient un verrou de shard, est relâchée à la
        // fin de cette ligne, avant l'écriture qui touche la même map.
        let existing = self.up_tracks.get(from_peer_id).map(|t| t.clone());

        let up_track = match existing {
            Some(up_track) => up_track,
            None => self
                .up_tracks
                .entry(from_peer_id.to_string())
                .or_insert_with(|| {
                    let is_video = packet.payload_type >= 96;
                    Arc::new(UpTrack::new(
                        format!("{}-track", from_peer_id),
                        from_peer_id.to_string(),
                        is_video,
                    ))
                })
                .clone(),
        };

        // Même précaution : `room.get()` pendant `room.iter()` est un accès
        // ré-entrant à la DashMap, susceptible de bloquer si un writer attend
        // sur le même shard.
        let source_sink = room.get(from_peer_id).map(|r| Arc::clone(&*r));

        // Cette boucle ne fait que créer les down_tracks manquants.
        for entry in room.iter() {
            let subscriber_id = entry.key();
            if subscriber_id == from_peer_id {
                continue;
            }

            if up_track.get_down_track(subscriber_id).is_none() {
                let down_track = Arc::new(DownTrack::new(
                    subscriber_id.clone(),
                    format!("{}->{}", from_peer_id, subscriber_id),
                    entry.value().clone(),
                ));
                up_track.add_subscriber(subscriber_id.clone(), down_track);

                // Une demande par nouvel abonnement, pas une par paquet.
                if let Some(source) = &source_sink {
                    source.request_keyframe();
                }
            }
        }

        // Une seule diffusion par paquet : `forward()` écrit déjà à tous les
        // down_tracks. L'appeler dans la boucle coûterait S² écritures.
        up_track.forward(&packet);
    }
}
