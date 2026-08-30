//! Lifecycle of a WebSocket session.

use super::dispatch::handle_message;
use super::messages::{ClientMessage, ServerMessage};
use crate::app::AppState;
use crate::media::{ForwardingEngine, RtpPacketData, RtpSink};
use crate::transport::{PeerConnection, PeerSink, event_loop};
use axum::extract::ws::{Message, WebSocket};
use futures::sink::SinkExt;
use futures::stream::{SplitSink, StreamExt};
use std::sync::Arc;
use tokio::sync::mpsc::{self, Receiver};
use tokio::sync::{Mutex, oneshot};

/// Depth of the outbound signaling channel.
const SIGNALING_CHANNEL_CAPACITY: usize = 100;

/// Depth of the inbound packet channel, from the transport to the engine.
///
/// This channel carries the stream of a single publisher — this peer's. At
/// ~150 packets/s for 1080p video, 128 packets are worth **~850 ms of media**.
/// Like the `PeerSink` outbound queue, it is bounded and drops rather than
/// accumulates: a packet almost a second old is worthless to a participant,
/// and letting them pile up would drive memory and latency up without ever
/// catching back up.
const RTP_INGRESS_CAPACITY: usize = 128;

/// Drives a session end to end: establishes the WebRTC connection, wires up
/// forwarding, loops over inbound messages, then cleans up on close.
pub async fn handle_socket(socket: WebSocket, peer_id: Arc<str>, state: AppState) {
    let (ws_sender, mut ws_receiver) = socket.split();
    // Bounded multi-producer / single-consumer channel: every signaling sender
    // writes here, only the WebSocket task reads. Bounded so that a stuck
    // client cannot inflate memory.
    let (tx, rx) = mpsc::channel::<ServerMessage>(SIGNALING_CHANNEL_CAPACITY);

    let conn = Arc::new(Mutex::new(
        PeerConnection::new(
            Arc::clone(&peer_id),
            tx.clone(),
            state.config.ice_host.clone(),
        )
        .await,
    ));

    // WebRTC loop: emits the media packets it receives on `rtp_rx`.
    //
    // The loop waits indefinitely on the socket and on str0m's deadlines;
    // nothing in its lifecycle ties it to the WebSocket. Without an explicit
    // signal it would outlive the session, keeping the `Rtc` and the UDP file
    // descriptor alive. `shutdown_tx` stays armed for the whole session and is
    // fired on the way out.
    let (rtp_tx, rtp_rx) =
        tokio::sync::mpsc::channel::<(Arc<str>, RtpPacketData)>(RTP_INGRESS_CAPACITY);
    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();
    tokio::spawn(event_loop::run(conn.clone(), rtp_tx, shutdown_rx));

    // The sink exists from the moment of connection — its writer task must be
    // running before the first packet — but the engine only learns about it on
    // `Join`: a peer that has joined no room receives nothing and broadcasts
    // nothing. Holding it here keeps it alive for the whole session.
    let sink: Arc<dyn RtpSink> = PeerSink::new(Arc::clone(&peer_id), conn.clone());

    spawn_forwarding_pump(state.engine.clone(), Arc::clone(&peer_id), rtp_rx);
    spawn_signaling_pump(Arc::clone(&peer_id), rx, ws_sender);

    let _ = tx
        .send(ServerMessage::Connected {
            peer_id: peer_id.to_string(),
        })
        .await;

    while let Some(Ok(msg)) = ws_receiver.next().await {
        match msg {
            Message::Text(text) => match serde_json::from_str::<ClientMessage>(&text) {
                Ok(client_msg) => {
                    handle_message(client_msg, &peer_id, &tx, &state, &conn, &sink).await
                }
                Err(e) => {
                    tracing::warn!("Message invalide : {}", e);
                    let _ = tx
                        .send(ServerMessage::Error {
                            message: format!("Message invalide : {}", e),
                        })
                        .await;
                }
            },
            Message::Close(_) => break,
            _ => {}
        }
    }

    // Teardown order: the event loop first — it releases the socket and its
    // reference to the `PeerConnection` — then the registries, which release
    // the `PeerSink` and the down_tracks the other publishers held on it. The
    // last `Arc` on the sink falls when this function returns: its queue
    // closes, its writer task exits, and the `PeerConnection` — hence the UDP
    // socket — is finally destroyed.
    let _ = shutdown_tx.send(());

    state.rooms.leave_room(&peer_id);
    state.engine.remove_peer(&peer_id);
    state.metrics.record_disconnect();
    tracing::info!("Peer {} déconnecté", peer_id);
}

/// Drains the peer's media packets into the forwarding engine.
fn spawn_forwarding_pump(
    engine: Arc<ForwardingEngine>,
    peer_id: Arc<str>,
    mut rtp_rx: Receiver<(Arc<str>, RtpPacketData)>,
) {
    tokio::spawn(async move {
        while let Some((from_peer_id, packet)) = rtp_rx.recv().await {
            engine.forward_rtp(&from_peer_id, packet);
        }
        tracing::debug!("Peer {} — task de forwarding terminée", peer_id);
    });
}

/// Serializes and pushes signaling messages onto the WebSocket.
fn spawn_signaling_pump(
    peer_id: Arc<str>,
    mut rx: mpsc::Receiver<ServerMessage>,
    mut ws_sender: SplitSink<WebSocket, Message>,
) {
    tokio::spawn(async move {
        // `recv` only yields `None` once every sender has been dropped: the
        // task can no longer die because it fell behind.
        while let Some(msg) = rx.recv().await {
            let json = match serde_json::to_string(&msg) {
                Ok(j) => j,
                Err(e) => {
                    tracing::error!("Erreur sérialisation : {}", e);
                    continue;
                }
            };
            if ws_sender.send(Message::Text(json.into())).await.is_err() {
                break;
            }
        }
        tracing::debug!("Peer {} — task de signaling terminée", peer_id);
    });
}
