//! Pont entre la couche média et une connexion WebRTC.

use super::peer_connection::PeerConnection;
use crate::media::{RtpPacketData, RtpSink};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::Duration;
use tokio::sync::Mutex;
use tokio::sync::mpsc::{self, error::TrySendError};

/// Échelle de relances de PLI après l'abonnement d'un nouveau subscriber.
///
/// Le peer source doit produire une keyframe pour que le nouvel arrivant
/// puisse décoder ; une seule demande se perd trop souvent pendant que la
/// connexion se stabilise, d'où la répétition en escalier.
const KEYFRAME_RETRY_DELAYS_MS: [u64; 4] = [200, 500, 1000, 2000];

/// Profondeur de la file d'écriture RTP d'un peer.
///
/// Rapportée au débit d'un publisher vidéo 1080p — ~150 paquets/s —, 128
/// paquets valent **~850 ms de média pour une source unique**. Toutes les
/// sources d'un même subscriber partagent cette file : le plafond réel tombe à
/// ~425 ms à deux publishers, ~210 ms à quatre.
///
/// C'est un garde-fou, pas un objectif : en régime normal la file reste quasi
/// vide, la task d'écriture consommant aussi vite que le moteur produit. Le
/// dimensionnement vise deux bornes à la fois — rester au-dessus d'une rafale
/// de keyframe (une IDR 1080p se fragmente sur une centaine de paquets MTU),
/// pour qu'un simple hoquet d'ordonnancement ne la tronque pas, et rester assez
/// bas pour qu'une écriture WebRTC durablement calée ne fasse enfler ni la
/// mémoire ni la latence.
const RTP_QUEUE_CAPACITY: usize = 128;

/// File d'écriture d'un sink et sa politique de rejet.
///
/// Sur du média temps réel accumuler n'a pas de sens : un paquet qui a attendu
/// des centaines de millisecondes arrive trop tard pour être décodé utilement.
/// Quand la file est pleine on le jette — mais jamais en silence, d'où le
/// compteur.
struct RtpQueue {
    tx: mpsc::Sender<RtpPacketData>,
    /// Paquets jetés depuis la création du sink.
    dropped: AtomicU64,
    /// Rafale de rejets en cours.
    ///
    /// Une file saturée jette autant de paquets que les publishers en émettent,
    /// soit des centaines par seconde : journaliser chaque perte noierait les
    /// logs. Seule la première d'une rafale est tracée, la rafale étant close
    /// dès qu'un paquet repasse.
    bursting: AtomicBool,
}

impl RtpQueue {
    fn new(tx: mpsc::Sender<RtpPacketData>) -> Self {
        RtpQueue {
            tx,
            dropped: AtomicU64::new(0),
            bursting: AtomicBool::new(false),
        }
    }

    /// Met un paquet en file, ou le jette si elle est pleine.
    ///
    /// Ne bloque jamais : appelée depuis le chemin chaud du forwarding, qui est
    /// synchrone.
    fn push(&self, peer_id: &str, packet: RtpPacketData) {
        match self.tx.try_send(packet) {
            Ok(()) => {
                // Lecture avant écriture : en régime normal le drapeau est déjà
                // `false`, et l'on évite de salir sa ligne de cache à chaque
                // paquet et chaque subscriber.
                if self.bursting.load(Ordering::Relaxed) {
                    self.bursting.store(false, Ordering::Relaxed);
                }
            }
            Err(TrySendError::Full(_)) => {
                let total = self.dropped.fetch_add(1, Ordering::Relaxed) + 1;
                if !self.bursting.swap(true, Ordering::Relaxed) {
                    tracing::warn!(
                        "Peer {} — file RTP pleine ({} paquets), paquet jeté (total {})",
                        peer_id,
                        RTP_QUEUE_CAPACITY,
                        total
                    );
                }
            }
            // Sink fermé : « un sink fermé absorbe silencieusement » est le
            // contrat du trait, ce n'est pas une perte à signaler.
            Err(TrySendError::Closed(_)) => {}
        }
    }

    fn dropped(&self) -> u64 {
        self.dropped.load(Ordering::Relaxed)
    }
}

/// Implémentation de production de [`RtpSink`] : met les paquets en file et
/// une task dédiée les écrit sur la [`PeerConnection`].
///
/// La file découple le chemin chaud du forwarding (synchrone, sans attente) de
/// l'écriture WebRTC (asynchrone, sous mutex). Un sink par peer : toutes les
/// sources qui lui écrivent passent par la même file, donc un seul writer.
///
/// Elle est **bornée** : si l'écriture WebRTC cale, les paquets excédentaires
/// sont jetés plutôt que mis en attente. Voir [`RTP_QUEUE_CAPACITY`] et
/// [`PeerSink::dropped_packets`].
pub struct PeerSink {
    peer_id: Arc<str>,
    queue: RtpQueue,
    conn: Arc<Mutex<PeerConnection>>,
}

impl PeerSink {
    /// Crée le sink et démarre sa task d'écriture.
    pub fn new(peer_id: Arc<str>, conn: Arc<Mutex<PeerConnection>>) -> Arc<Self> {
        let (tx, mut rx) = mpsc::channel::<RtpPacketData>(RTP_QUEUE_CAPACITY);

        let pump_conn = conn.clone();
        let pump_id = Arc::clone(&peer_id);
        tokio::spawn(async move {
            while let Some(packet) = rx.recv().await {
                let mut c = pump_conn.lock().await;
                if let Err(e) = c.write_rtp(&packet) {
                    tracing::debug!("Peer {} — écriture RTP échouée : {}", pump_id, e);
                    break;
                }
            }
            tracing::debug!("Peer {} — task d'écriture RTP terminée", pump_id);
        });

        Arc::new(PeerSink {
            peer_id,
            queue: RtpQueue::new(tx),
            conn,
        })
    }

    pub fn peer_id(&self) -> &str {
        &self.peer_id
    }

    /// Paquets jetés depuis la création du sink, faute de place dans la file.
    ///
    /// Reste à zéro tant que l'écriture WebRTC suit le rythme du forwarding ;
    /// une valeur qui monte désigne un peer dont la sortie décroche.
    ///
    /// NOTE : ce compteur n'est pas encore relayé par `/metrics` — la couche
    /// média n'a pas accès à [`crate::metrics::Metrics`], et l'y amener
    /// dépasserait le cadre. Il n'est pour l'instant lisible que d'ici et par
    /// la journalisation de [`RtpQueue::push`].
    pub fn dropped_packets(&self) -> u64 {
        self.queue.dropped()
    }
}

impl RtpSink for PeerSink {
    fn write_rtp(&self, packet: RtpPacketData) {
        self.queue.push(&self.peer_id, packet);
    }

    fn request_keyframe(&self) {
        let conn = self.conn.clone();
        let peer_id = Arc::clone(&self.peer_id);

        tokio::spawn(async move {
            for delay in KEYFRAME_RETRY_DELAYS_MS {
                tokio::time::sleep(Duration::from_millis(delay)).await;
                conn.lock().await.request_keyframe();
                tracing::info!("Peer {} — PLI envoyée après {}ms", peer_id, delay);
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use str0m::media::Mid;
    use std::time::Instant;

    /// Paquet vidéo minimal, dont seul le payload distingue les instances.
    fn packet(payload: &[u8]) -> RtpPacketData {
        RtpPacketData {
            payload_type: 96,
            sequence_number: 0,
            timestamp: 1_000,
            ssrc: 0,
            payload: Arc::from(payload),
            is_keyframe: false,
            mid: Mid::from("0"),
            network_time: Instant::now(),
            rtp_time: 90_000,
            is_video: true,
        }
    }

    /// Une file saturée ne doit ni bloquer l'appelant ni faire enfler la
    /// mémoire : le paquet excédentaire est abandonné.
    #[test]
    fn a_full_queue_drops_the_extra_packets_instead_of_queueing_them() {
        // Le récepteur est gardé sans jamais être lu : la file se remplit puis
        // sature à sa capacité.
        let (tx, _rx) = mpsc::channel::<RtpPacketData>(4);
        let queue = RtpQueue::new(tx);

        for _ in 0..10 {
            queue.push("alice", packet(b"frame"));
        }

        assert_eq!(
            queue.dropped(),
            6,
            "4 paquets tiennent dans la file, les 6 suivants doivent être jetés"
        );
    }

    /// Le rejet doit rester observable, sinon il serait pire que la file non
    /// bornée qu'il remplace.
    #[test]
    fn the_drop_counter_stays_at_zero_while_the_queue_has_room() {
        let (tx, _rx) = mpsc::channel::<RtpPacketData>(4);
        let queue = RtpQueue::new(tx);

        for _ in 0..4 {
            queue.push("alice", packet(b"frame"));
        }

        assert_eq!(queue.dropped(), 0, "rien ne doit être jeté avant saturation");
    }

    /// RTP est un protocole d'ordre : la file ne doit pas réordonner ce qu'on y
    /// dépose, ni sous saturation.
    #[tokio::test]
    async fn the_queue_preserves_the_order_of_the_packets_it_accepts() {
        let (tx, mut rx) = mpsc::channel::<RtpPacketData>(4);
        let queue = RtpQueue::new(tx);

        // Six envois pour deux rejets : ce qui ressort doit être le préfixe des
        // acceptés, dans l'ordre d'entrée.
        for payload in [b"a", b"b", b"c", b"d", b"e", b"f"] {
            queue.push("alice", packet(payload));
        }

        let mut recus = Vec::new();
        while let Ok(packet) = rx.try_recv() {
            recus.push(packet.payload[0]);
        }

        assert_eq!(
            recus,
            b"abcd".to_vec(),
            "la file doit rendre les paquets acceptés dans leur ordre d'entrée"
        );
    }

    /// Le compteur exposé par le sink doit bien être celui de sa file.
    ///
    /// Le runtime est mono-tâche et rien n'attend entre les écritures : la task
    /// d'écriture ne peut pas s'intercaler pour vider la file.
    #[tokio::test]
    async fn the_sink_reports_the_packets_its_queue_dropped() {
        let (sender, _rx) = mpsc::channel(4);
        let conn = Arc::new(Mutex::new(
            PeerConnection::new(Arc::from("alice"), sender, "127.0.0.1".to_string()).await,
        ));
        let sink = PeerSink::new(Arc::from("alice"), conn);

        for _ in 0..RTP_QUEUE_CAPACITY + 7 {
            sink.write_rtp(packet(b"frame"));
        }

        assert_eq!(
            sink.dropped_packets(),
            7,
            "les paquets au-delà de la capacité doivent être comptés comme jetés"
        );
    }
}
