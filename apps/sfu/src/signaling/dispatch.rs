//! Traitement d'un message client.

use super::messages::{ClientMessage, ServerMessage};
use crate::app::AppState;
use crate::media::RtpSink;
use crate::room::RoomPeer;
use crate::transport::PeerConnection;
use std::sync::Arc;
use tokio::sync::{Mutex, mpsc};

/// Applique un message reçu du client.
///
/// `tx` est le canal de signaling du peer émetteur ; `conn` sa connexion WebRTC ;
/// `sink` la destination de ses paquets RTP, remise au moteur de forwarding
/// au moment du `Join`.
pub async fn handle_message(
    msg: ClientMessage,
    peer_id: &str,
    tx: &mpsc::Sender<ServerMessage>,
    state: &AppState,
    conn: &Arc<Mutex<PeerConnection>>,
    sink: &Arc<dyn RtpSink>,
) {
    match msg {
        ClientMessage::Join { room_id, .. } => {
            let existing_peers = state.rooms.join_room(
                &room_id,
                RoomPeer {
                    peer_id: peer_id.to_string(),
                    sender: tx.clone(),
                },
            );

            // Le forwarding est scopé à la room : le peer n'y devient joignable
            // qu'ici, et seulement pour les membres de cette room.
            state
                .engine
                .add_peer(room_id.clone(), peer_id.to_string(), sink.clone());

            let _ = tx
                .send(ServerMessage::JoinedRoom {
                    room_id,
                    peers: existing_peers,
                })
                .await;
            tracing::info!("Peer {} a rejoint la room", peer_id);
        }

        ClientMessage::SfuOffer { sdp } => {
            tracing::info!("Peer {} — SFU offer reçue", peer_id);

            // Lié dans un `let` avant le `match` : le `MutexGuard` temporaire
            // d'un scrutateur vit jusqu'à la fin de l'expression `match`, ce qui
            // garderait la `PeerConnection` verrouillée pendant la
            // journalisation et l'envoi de la réponse. Ici il tombe dès la fin
            // de cette ligne. (Clippy : `significant_drop_in_scrutinee`.)
            let outcome = conn.lock().await.handle_offer(&sdp);

            match outcome {
                Ok(_) => tracing::info!("Peer {} — offer traitée ✅", peer_id),
                Err(e) => {
                    tracing::error!("Peer {} — erreur offer : {}", peer_id, e);
                    let _ = tx
                        .send(ServerMessage::Error {
                            message: format!("Erreur offer : {}", e),
                        })
                        .await;
                }
            }
        }

        ClientMessage::SfuIceCandidate { candidate } => {
            tracing::debug!("Peer {} — ICE candidate reçu", peer_id);
            conn.lock().await.add_remote_candidate(&candidate);
        }

        ClientMessage::Leave => {
            state.rooms.leave_room(peer_id);
            state.engine.remove_peer(peer_id);
            tracing::info!("Peer {} a quitté la room", peer_id);
        }

        // --- Relais P2P, hérité du mode maillé ---
        // Conservé pour compatibilité du client ; le SFU n'en dépend pas.
        ClientMessage::Answer {
            sdp,
            target_peer_id,
        } => {
            state.rooms.send_to(
                &target_peer_id,
                ServerMessage::Offer {
                    sdp,
                    from_peer_id: peer_id.to_string(),
                },
            );
        }

        ClientMessage::Offer { .. } => {
            tracing::debug!("Peer {} — offer P2P reçue", peer_id);
        }

        ClientMessage::IceCandidate { target_peer_id, .. } => {
            tracing::debug!("Peer {} — ICE candidate pour {}", peer_id, target_peer_id);
        }
    }
}
