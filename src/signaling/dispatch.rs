//! Handling of a single client message.

use super::messages::{ClientMessage, ServerMessage};
use super::negotiation::NegotiationEvent;
use crate::app::AppState;
use crate::media::RtpSink;
use crate::room::RoomPeer;
use crate::telemetry::{Entry, EventKind, EventRecord};
use crate::transport::PeerConnection;
use std::sync::Arc;
use tokio::sync::{Mutex, mpsc};

/// Applies a message received from the client.
///
/// `tx` is the sending peer's signaling channel; `conn` its WebRTC connection;
/// `sink` the destination of its RTP packets, handed to the forwarding engine
/// on `Join`.
pub async fn handle_message(
    msg: ClientMessage,
    peer_id: &Arc<str>,
    tx: &mpsc::Sender<ServerMessage>,
    state: &AppState,
    conn: &Arc<Mutex<PeerConnection>>,
    sink: &Arc<dyn RtpSink>,
) {
    match msg {
        ClientMessage::Join { room_id, .. } => {
            let outcome = state.rooms.join_room(
                &room_id,
                RoomPeer {
                    peer_id: peer_id.to_string(),
                    sender: tx.clone(),
                },
            );

            // Le cycle de vie n'est enregistré que si le peer_id est un uuid — il l'est
            // toujours, `http/ws.rs` le génère. La télémétrie ne peut pas casser une session.
            if let Some(peer_uuid) = crate::telemetry::peer_uuid(peer_id) {
                let now = chrono::Utc::now();
                if outcome.room_created {
                    state.telemetry.record(Entry::RoomOpened {
                        id: outcome.room_session,
                        name: room_id.to_string(),
                        at: now,
                    });
                    state.telemetry.record(Entry::Event(
                        EventRecord::new(EventKind::RoomCreated, now).room(outcome.room_session),
                    ));
                }
                state.telemetry.record(Entry::PeerJoined {
                    id: peer_uuid,
                    room_id: outcome.room_session,
                    at: now,
                });
                state.telemetry.record(Entry::Event(
                    EventRecord::new(EventKind::PeerJoined, now)
                        .room(outcome.room_session)
                        .peer(peer_uuid),
                ));
            }

            // Forwarding is scoped to the room: the peer only becomes
            // reachable here, and only to the members of that room.
            state
                .engine
                .add_peer(room_id.clone(), Arc::clone(peer_id), sink.clone());

            let _ = tx
                .send(ServerMessage::JoinedRoom {
                    room_id: room_id.clone(),
                    peers: outcome.occupants,
                })
                .await;

            // Both directions of the wiring — what the room already publishes,
            // and what this peer may already be publishing — are the
            // negotiator's job.
            state.negotiator.notify(NegotiationEvent::PeerJoined {
                peer: Arc::clone(peer_id),
                room_id,
            });

            tracing::info!("Peer {} a rejoint la room", peer_id);
        }

        ClientMessage::SfuOffer { sdp } => {
            tracing::info!("Peer {} — SFU offer reçue", peer_id);

            // Bound in a `let` before the `match`: a scrutinee's temporary
            // `MutexGuard` lives until the end of the `match` expression, which
            // would keep the `PeerConnection` locked during logging and while
            // sending the reply. Here it drops at the end of this line.
            // (Clippy: `significant_drop_in_scrutinee`.)
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

        ClientMessage::SfuAnswer { sdp } => {
            // Applied by the negotiator rather than here: it is the step that
            // turns queued subscriptions into live down_tracks, and it has to
            // stay ordered with respect to every other negotiation event.
            state.negotiator.notify(NegotiationEvent::AnswerReceived {
                peer: Arc::clone(peer_id),
                sdp,
            });
        }

        ClientMessage::SfuIceCandidate { candidate } => {
            tracing::debug!("Peer {} — ICE candidate reçu", peer_id);
            conn.lock().await.add_remote_candidate(&candidate);
        }

        ClientMessage::Leave => {
            // Pas d'enregistrement télémétrique ici : la connexion reste ouverte
            // (le peer peut rejoindre une autre room), donc ni le peer ni ses
            // tracks ne se terminent réellement — contrairement au teardown de
            // session.rs. `let _ =` : même remarque que dans `join_room`.
            let _ = state.rooms.leave_room(peer_id);
            state.engine.remove_peer(peer_id);
            state.negotiator.notify(NegotiationEvent::PeerLeft {
                peer: Arc::clone(peer_id),
            });
            tracing::info!("Peer {} a quitté la room", peer_id);
        }

        // --- P2P relay, inherited from the mesh mode ---
        // Kept for client compatibility; the SFU does not depend on it.
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
