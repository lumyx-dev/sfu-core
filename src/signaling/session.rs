//! Lifecycle of a WebSocket session.

use super::dispatch::handle_message;
use super::messages::{ClientMessage, ServerMessage};
use super::negotiation::{NegotiationEvent, Negotiator};
use crate::app::AppState;
use crate::media::{ForwardingEngine, RtpSink};
use crate::metrics::Metrics;
use crate::telemetry::sampler::Sampler;
use crate::telemetry::{Entry, EventKind, EventRecord, PeerSample, Telemetry, TrackSample};
use crate::transport::{PeerConnection, PeerSink, TransportEvent, event_loop};
use axum::extract::ws::{Message, WebSocket};
use futures::sink::SinkExt;
use futures::stream::{SplitSink, StreamExt};
use std::collections::HashMap;
use std::sync::Arc;
use str0m::IceConnectionState;
use str0m::format::PayloadParams;
use str0m::media::Mid;
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
            state.config.udp_ports.clone(),
            state.config.telemetry.sample_interval,
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
        state.telemetry.clone(),
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

    let departure = state.rooms.leave_room(&peer_id);

    if let Some(peer_uuid) = crate::telemetry::peer_uuid(&peer_id) {
        let _ = state.telemetry.clear_occupancy(peer_uuid);
        if let Some(d) = &departure {
            state.telemetry.record_departure(
                d.peer_session,
                d.room_session,
                d.room_dropped,
                chrono::Utc::now(),
            );
        }
    }

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
    telemetry: Arc<Telemetry>,
    peer_id: Arc<str>,
    mut events: Receiver<TransportEvent>,
) {
    tokio::spawn(async move {
        // Un échantillonneur par peer, local à cette tâche : sa durée de vie
        // est celle de la connexion, donc celle des cumuls str0m qu'il
        // soustrait.
        let mut sampler = Sampler::new();
        // Codec de chaque mid publié, appris au premier paquet — `MediaAdded`
        // ne le porte pas. Il est consigné au tick de statistiques suivant,
        // pas ici : le chemin des paquets ne fait qu'un lookup par paquet, et
        // une consignation impossible (track pas encore publié) est retentée
        // une fois par seconde, pas une fois par paquet.
        let mut codecs: HashMap<Mid, Codec> = HashMap::new();

        while let Some(event) = events.recv().await {
            match event {
                TransportEvent::Media { peer, packet } => {
                    codecs.entry(packet.mid).or_insert(Codec {
                        params: packet.params,
                        recorded: false,
                    });
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
                    // La télémétrie clé ses tracks par occupation, pas par
                    // connexion (Task 6 review, finding 3) : hors room, rien à
                    // publier ici — le prochain `join` s'en chargera (LUM-708).
                    // Idempotent : si ce `join` est passé entre-temps, ne
                    // republie pas.
                    if let Some(occupancy) = occupancy(&telemetry, &peer) {
                        telemetry.publish_track(
                            occupancy,
                            &mid.to_string(),
                            kind.into(),
                            chrono::Utc::now(),
                        );
                    }
                    negotiator.notify(NegotiationEvent::TrackPublished { peer, mid, kind });
                }
                TransportEvent::KeyframeRequested { peer, mid } => {
                    metrics.record_keyframe();
                    negotiator.notify(NegotiationEvent::KeyframeRequested { peer, mid });
                }
                TransportEvent::TrackStats { peer, mid, reading } => {
                    let mid_str = mid.to_string();
                    // Le delta se calcule même hors room : sinon le premier
                    // échantillon après un `join` vaudrait tout ce qui a
                    // transité avant.
                    let Some(d) = sampler.ingress(&mid_str, &reading) else {
                        continue;
                    };
                    let Some(track_id) = occupancy(&telemetry, &peer)
                        .and_then(|o| telemetry.published_track(o, &mid_str))
                    else {
                        continue;
                    };
                    if let Some(codec) = codecs.get_mut(&mid)
                        && !codec.recorded
                    {
                        record_codec(&telemetry, track_id, &codec.params);
                        codec.recorded = true;
                    }
                    telemetry.record(Entry::TrackSample(TrackSample {
                        track_id,
                        at: chrono::Utc::now(),
                        bytes: d.bytes,
                        packets: d.packets,
                        nacks: d.nacks,
                        plis: d.plis,
                        firs: d.firs,
                        jitter_ms: d.jitter_ms,
                        loss: d.loss,
                        rtt_ms: d.rtt_ms,
                    }));
                }
                TransportEvent::PeerStats { peer, reading } => {
                    let Some(d) = sampler.peer(&reading) else {
                        continue;
                    };
                    let Some(occupancy) = occupancy(&telemetry, &peer) else {
                        continue;
                    };
                    telemetry.record(Entry::PeerSample(PeerSample {
                        peer_id: occupancy,
                        at: chrono::Utc::now(),
                        bytes_rx: d.bytes_rx,
                        bytes_tx: d.bytes_tx,
                        transport_bytes_rx: d.transport_bytes_rx,
                        transport_bytes_tx: d.transport_bytes_tx,
                        egress_loss: d.egress_loss,
                        bwe_bps: d.bwe_bps,
                    }));
                }
                TransportEvent::IceState { peer, state } => {
                    if let Some(occupancy) = occupancy(&telemetry, &peer) {
                        record_ice_state(&telemetry, occupancy, state);
                    }
                }
            }
        }
        tracing::debug!("Peer {} — task de transport terminée", peer_id);
    });
}

/// The occupancy a connection currently holds, if it is in a room.
///
/// Telemetry rows are keyed by occupancy, not connection (Task 6 review,
/// finding 3): outside a room there is nothing to attach a sample to.
fn occupancy(telemetry: &Telemetry, peer: &str) -> Option<uuid::Uuid> {
    crate::telemetry::peer_uuid(peer).and_then(|c| telemetry.occupancy_of(c))
}

/// The codec a publisher sends on one of its m-lines, and whether telemetry
/// has been told.
struct Codec {
    params: PayloadParams,
    recorded: bool,
}

/// Records the codec of a published track.
fn record_codec(telemetry: &Telemetry, track_id: uuid::Uuid, params: &PayloadParams) {
    let spec = params.spec();
    telemetry.record(Entry::TrackCodec {
        id: track_id,
        // `Display` de str0m : "opus", "VP8", "H264"… le schéma attend des
        // minuscules.
        codec: spec.codec.to_string().to_lowercase(),
        clock_rate: i32::try_from(spec.clock_rate.get()).unwrap_or(i32::MAX),
    });
}

/// Records an ICE transition: the peer's last known state, plus an event for
/// the transitions the dashboard's timeline shows.
fn record_ice_state(telemetry: &Telemetry, occupancy: uuid::Uuid, state: IceConnectionState) {
    let now = chrono::Utc::now();
    telemetry.record(Entry::IceState {
        peer_id: occupancy,
        state: format!("{state:?}").to_lowercase(),
        at: now,
    });
    // str0m 0.23 n'a pas d'état `Failed` : son agent ICE ne clôt jamais le
    // trickle, une connexion peut toujours revenir. `IceFailed` reste donc
    // sans émetteur. `Completed` suit `Connected` sans rien apprendre de plus.
    let kind = match state {
        IceConnectionState::Connected => EventKind::IceConnected,
        IceConnectionState::Disconnected => EventKind::IceDisconnected,
        _ => return,
    };
    telemetry.record(Entry::Event(EventRecord::new(kind, now).peer(occupancy)));
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::telemetry::sampler::IngressReading;
    use crate::telemetry::{MemorySink, TrackKind};
    use std::time::Duration;
    use str0m::media::MediaKind;
    use tokio::sync::mpsc::Sender;
    use uuid::Uuid;

    /// A transport pump wired to a drainable telemetry sink, fed by hand.
    struct Pump {
        telemetry: Arc<Telemetry>,
        sink: Arc<MemorySink>,
        connection: Uuid,
        peer: Arc<str>,
        events: Sender<TransportEvent>,
    }

    impl Pump {
        fn start() -> Pump {
            let sink = Arc::new(MemorySink::new());
            let telemetry = Telemetry::new(sink.clone());
            let engine = ForwardingEngine::new();
            let negotiator = Negotiator::new(engine.clone());
            let connection = Uuid::new_v4();
            let peer: Arc<str> = Arc::from(connection.to_string().as_str());
            let (events, rx) = mpsc::channel(16);
            spawn_transport_pump(
                engine,
                negotiator,
                Metrics::new(),
                telemetry.clone(),
                Arc::clone(&peer),
                rx,
            );
            Pump {
                telemetry,
                sink,
                connection,
                peer,
                events,
            }
        }

        /// Sends one cumulative stats reading for mid 1, `bytes` so far.
        async fn stats(&self, bytes: u64) {
            let reading = IngressReading {
                bytes,
                packets: bytes / 1000,
                nacks: 0,
                plis: 0,
                firs: 0,
                jitter: 900,
                clock_rate: 90_000,
                loss: None,
                rtt_ms: None,
            };
            self.events
                .send(TransportEvent::TrackStats {
                    peer: Arc::clone(&self.peer),
                    mid: Mid::from("1"),
                    reading,
                })
                .await
                .unwrap();
        }

        /// Everything the pump recorded since the last call.
        ///
        /// Waits for the pump to catch up: an ICE state change is sent last,
        /// and since the pump handles its events in order, once its
        /// `Entry::IceState` shows up everything sent before it has been
        /// handled. The marker itself is filtered out.
        async fn recorded(&self) -> Vec<Entry> {
            self.events
                .send(TransportEvent::IceState {
                    peer: Arc::clone(&self.peer),
                    state: IceConnectionState::Checking,
                })
                .await
                .unwrap();
            let deadline = tokio::time::Instant::now() + Duration::from_secs(2);
            let mut entries = Vec::new();
            loop {
                entries.extend(self.sink.drain());
                if entries.iter().any(|e| matches!(e, Entry::IceState { .. })) {
                    break;
                }
                assert!(tokio::time::Instant::now() < deadline, "pompe bloquée");
                tokio::time::sleep(Duration::from_millis(1)).await;
            }
            entries.retain(|e| !matches!(e, Entry::IceState { .. }));
            entries
        }

        /// The track samples recorded since the last call, as
        /// `(track_id, bytes)`.
        async fn samples(&self) -> Vec<(Uuid, i64)> {
            self.recorded()
                .await
                .into_iter()
                .filter_map(|e| match e {
                    Entry::TrackSample(s) => Some((s.track_id, s.bytes)),
                    _ => None,
                })
                .collect()
        }

        fn join(&self, occupancy: Uuid) {
            self.telemetry.set_occupancy(self.connection, occupancy);
        }

        fn publish_video(&self, occupancy: Uuid) -> Uuid {
            self.telemetry
                .publish_track(occupancy, "1", TrackKind::Video, chrono::Utc::now())
                .expect("track neuf")
        }
    }

    #[tokio::test]
    async fn samples_follow_the_track_into_its_new_occupancy() {
        // LUM-708 : après un changement de room, le track republié dans la
        // nouvelle occupation reçoit les échantillons — et le delta enjambe le
        // changement, puisque les cumuls str0m sont ceux de la connexion.
        let pump = Pump::start();

        let room_a = Uuid::new_v4();
        pump.join(room_a);
        let track_a = pump.publish_video(room_a);
        pump.stats(1_000).await;
        pump.stats(3_000).await;
        assert_eq!(pump.samples().await, vec![(track_a, 2_000)]);

        let room_b = Uuid::new_v4();
        pump.telemetry.forget_peer(room_a);
        pump.join(room_b);
        let track_b = pump.publish_video(room_b);
        pump.stats(4_500).await;

        assert_eq!(
            pump.samples().await,
            vec![(track_b, 1_500)],
            "l'échantillon va au track de room-b, avec le delta depuis le dernier relevé"
        );
    }

    #[tokio::test]
    async fn a_track_not_published_in_the_current_occupancy_gets_no_sample() {
        // Le symptôme de LUM-708, côté pompe : une occupation sans track
        // publié n'invente pas d'id — pas d'échantillon orphelin.
        let pump = Pump::start();
        pump.join(Uuid::new_v4());
        pump.stats(1_000).await;
        pump.stats(2_000).await;
        assert!(pump.samples().await.is_empty());
    }

    #[tokio::test]
    async fn a_queued_track_added_after_the_join_does_not_publish_twice() {
        // La course que l'idempotence de `publish_track` absorbe : le `join` a
        // republié le track, puis le `TrackAdded` encore en file arrive.
        let pump = Pump::start();
        let occupancy = Uuid::new_v4();
        pump.join(occupancy);
        pump.publish_video(occupancy);
        pump.sink.drain();

        pump.events
            .send(TransportEvent::TrackAdded {
                peer: Arc::clone(&pump.peer),
                mid: Mid::from("1"),
                kind: MediaKind::Video,
            })
            .await
            .unwrap();
        let entries = pump.recorded().await;

        assert!(
            !entries
                .iter()
                .any(|e| matches!(e, Entry::TrackPublished { .. })),
            "aucun TrackPublished en double, reçu {entries:?}"
        );
    }
}
