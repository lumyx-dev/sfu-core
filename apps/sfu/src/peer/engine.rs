use crate::peer::connection::PeerConnection;
use crate::peer::track::{DownTrack, RtpPacketData, UpTrack};
use dashmap::DashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Gère le forwarding RTP entre tous les peers d'une room
pub struct ForwardingEngine {
    /// UpTracks par peer_id — ce que chaque peer publie
    up_tracks: DashMap<String, Arc<UpTrack>>,
    /// Connexions WebRTC par peer_id — pour écrire les paquets forwardés
    connections: DashMap<String, Arc<Mutex<PeerConnection>>>,
}

impl ForwardingEngine {
    pub fn new() -> Arc<Self> {
        Arc::new(ForwardingEngine {
            up_tracks: DashMap::new(),
            connections: DashMap::new(),
        })
    }

    /// Ajoute un peer avec sa connexion WebRTC
    pub fn add_peer(&self, peer_id: String, conn: Arc<Mutex<PeerConnection>>) {
        self.connections.insert(peer_id, conn);
    }

    /// Retire un peer et nettoie ses tracks
    pub fn remove_peer(&self, peer_id: &str) {
        self.connections.remove(peer_id);
        self.up_tracks.remove(peer_id);
        tracing::info!("ForwardingEngine — peer {} retiré", peer_id);
    }

    /// Reçoit un paquet RTP d'un peer et le forward aux autres
    pub async fn forward_rtp(&self, from_peer_id: &str, packet: RtpPacketData) {
        let up_track = self
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
            .clone();

        for entry in self.connections.iter() {
            let subscriber_id = entry.key().clone();
            if subscriber_id == from_peer_id {
                continue;
            }

            if up_track.get_down_track(&subscriber_id).is_none() {
                let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<RtpPacketData>();

                let down_track = Arc::new(DownTrack::new(
                    subscriber_id.clone(),
                    format!("{}->{}", from_peer_id, subscriber_id),
                    tx,
                ));

                up_track.add_subscriber(subscriber_id.clone(), down_track);

                // task qui envoie les paquets remappés via WebRTC
                let conn = entry.value().clone();
                let sub_id = subscriber_id.clone();
                let from_id = from_peer_id.to_string();
                tokio::spawn(async move {
                    while let Some(rewritten) = rx.recv().await {
                        let mut c = conn.lock().await;
                        if let Err(e) = c.write_rtp(&rewritten) {
                            tracing::debug!("Forward {} → {} erreur : {}", from_id, sub_id, e);
                            break;
                        }
                    }
                });

                // demande une keyframe au peer source ← ici
                if let Some(source_conn) = self.connections.get(from_peer_id) {
                    let conn_clone = source_conn.clone();
                    tokio::spawn(async move {
                        for delay in [200, 500, 1000, 2000] {
                            tokio::time::sleep(std::time::Duration::from_millis(delay)).await;
                            let mut c = conn_clone.lock().await;
                            c.request_keyframe();
                            tracing::info!("PLI envoyée après {}ms", delay);
                        }
                    });
                }
            }

            up_track.forward(&packet);
        }
    }
}
