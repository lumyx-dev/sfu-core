//! Lifecycle of a WebSocket session.

use super::dispatch::handle_message;
use super::messages::{ClientMessage, ServerMessage};
use super::negotiation::{NegotiationEvent, Negotiator};
use crate::app::AppState;
use crate::media::{ForwardingEngine, RtpSink};
use crate::metrics::Metrics;
use crate::transport::{PeerConnection, PeerSink, TransportEvent, event_loop};
use axum::extract::ws::{Message, WebSocket};
use futures::sink::SinkExt;
use futures::stream::{SplitSink, StreamExt};
use std::sync::Arc;
use tokio::sync::mpsc::{self, Receiver};
use tokio::sync::{Mutex, oneshot};

/// Depth of the outbound signaling channel.
const SIGNALING_CHANNEL_CAPACITY: usize = 100;

/// Depth of the inbound event channel, from the transport to the session.
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

    // WebRTC loop: emits what it observes on `transport_rx` — the tracks the
    // peer publishes, the media packets it sends, the keyframes it asks for.
    //
    // The loop waits indefinitely on the socket and on str0m's deadlines;
    // nothing in its lifecycle ties it to the WebSocket. Without an explicit
    // signal it would outlive the session, keeping the `Rtc` and the UDP file
    // descriptor alive. `shutdown_tx` stays armed for the whole session and is
    // fired on the way out.
    let (transport_tx, transport_rx) =
        tokio::sync::mpsc::channel::<TransportEvent>(RTP_INGRESS_CAPACITY);
    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();
    tokio::spawn(event_loop::run(conn.clone(), transport_tx, shutdown_rx));

    // The sink exists from the moment of connection — its writer task must be
    // running before the first packet — but the engine only learns about it on
    // `Join`: a peer that has joined no room receives nothing and broadcasts
    // nothing. Holding it here keeps it alive for the whole session.
    let sink: Arc<dyn RtpSink> = PeerSink::new(Arc::clone(&peer_id), conn.clone());

    // The negotiator has to be able to re-offer to this peer from the moment
    // it exists: a track published elsewhere can reach it before it has said a
    // word.
    state
        .negotiator
        .register(Arc::clone(&peer_id), conn.clone(), tx.clone());

    spawn_transport_pump(
        state.engine.clone(),
        state.negotiator.clone(),
        state.metrics.clone(),
        Arc::clone(&peer_id),
        transport_rx,
    );
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
    state.negotiator.notify(NegotiationEvent::PeerLeft {
        peer: Arc::clone(&peer_id),
    });
    state.negotiator.unregister(&peer_id);
    state.metrics.record_disconnect();
    tracing::info!("Peer {} déconnecté", peer_id);
}

/// Drains what the peer's WebRTC loop observes: media into the forwarding
/// engine, everything else into the negotiator.
fn spawn_transport_pump(
    engine: Arc<ForwardingEngine>,
    negotiator: Arc<Negotiator>,
    metrics: Arc<Metrics>,
    peer_id: Arc<str>,
    mut events: Receiver<TransportEvent>,
) {
    tokio::spawn(async move {
        while let Some(event) = events.recv().await {
            match event {
                TransportEvent::Media { peer, packet } => {
                    let bytes = packet.payload.len() as u64;
                    // The media layer has no access to `Metrics` — it reports
                    // how many writes the fanout cost and the session records
                    // it. Without this, `/metrics` stayed at zero however much
                    // traffic went through.
                    let written = engine.forward_rtp(&peer, packet);
                    for _ in 0..written {
                        metrics.record_rtp(bytes);
                    }
                }
                TransportEvent::TrackAdded { peer, mid, kind } => {
                    negotiator.notify(NegotiationEvent::TrackPublished { peer, mid, kind });
                }
                TransportEvent::KeyframeRequested { peer, mid } => {
                    metrics.record_keyframe();
                    negotiator.notify(NegotiationEvent::KeyframeRequested { peer, mid });
                }
            }
        }
        tracing::debug!("Peer {} — task de transport terminée", peer_id);
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
