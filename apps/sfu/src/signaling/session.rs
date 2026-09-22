//! Lifecycle of a WebSocket session.

use super::dispatch::handle_message;
use super::messages::{ClientMessage, ServerMessage};
use super::negotiation::{NegotiationEvent, Negotiator};
use crate::app::AppState;
use crate::media::{ForwardingEngine, RtpSink};
use crate::metrics::Metrics;
use crate::telemetry::sampler::Sampler;
use crate::telemetry::{
    Entry, EventKind, EventRecord, PeerSample, Telemetry, TrackKind, TrackSample,
};
use crate::transport::{PeerConnection, PeerSink, TransportEvent, event_loop};
use axum::extract::ws::{Message, WebSocket};
use futures::sink::SinkExt;
use futures::stream::{SplitSink, StreamExt};
use std::sync::Arc;
use str0m::media::MediaKind;
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
        // Un `Sampler` par peer, local à la task : c'est exactement sa durée
        // de vie, donc rien à nettoyer quand la connexion tombe.
        let mut sampler = Sampler::new();
        // Les tracks dont le codec est déjà consigné. Le codec n'arrive
        // qu'avec le premier paquet et ne change plus : sans ce garde, la
        // branche émettrait un UPDATE par paquet, des centaines par seconde.
        let mut codec_seen: std::collections::HashSet<str0m::media::Mid> =
            std::collections::HashSet::new();
        while let Some(event) = events.recv().await {
            match event {
                TransportEvent::Media { peer, packet } => {
                    let bytes = packet.payload.len() as u64;
                    // Le codec n'arrive qu'avec le premier paquet : `MediaAdded`
                    // ne le porte pas, seul `PayloadParams` le porte.
                    if codec_seen.insert(packet.mid)
                        && let Some(connection) = crate::telemetry::peer_uuid(&peer)
                        && let Some(occupancy) = telemetry.occupancy_of(connection)
                    {
                        let spec = packet.params.spec();
                        telemetry.record(Entry::TrackCodec {
                            id: telemetry.track_id(occupancy, &packet.mid.to_string()),
                            codec: format!("{:?}", spec.codec).to_lowercase(),
                            // `clock_rate` est un `str0m::Frequency`, pas un
                            // entier : il enveloppe un NonZeroU32.
                            clock_rate: spec.clock_rate.get() as i32,
                        });
                    }
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
                    // connexion (Task 6 review, finding 3) : sans occupation
                    // mirée pour ce connecteur — pas encore dans une room, ou
                    // qui vient de la quitter — il n'y a rien à publier.
                    if let Some(peer_uuid) = crate::telemetry::peer_uuid(&peer)
                        && let Some(occupancy) = telemetry.occupancy_of(peer_uuid)
                    {
                        let mid_str = mid.to_string();
                        let track_id = telemetry.track_id(occupancy, &mid_str);
                        let now = chrono::Utc::now();
                        telemetry.record(Entry::TrackPublished {
                            id: track_id,
                            peer_id: occupancy,
                            mid: mid_str,
                            kind: match kind {
                                MediaKind::Audio => TrackKind::Audio,
                                MediaKind::Video => TrackKind::Video,
                            },
                            at: now,
                        });
                        telemetry.record(Entry::Event(
                            EventRecord::new(EventKind::TrackPublished, now)
                                .peer(occupancy)
                                .track(track_id),
                        ));
                    }
                    negotiator.notify(NegotiationEvent::TrackPublished { peer, mid, kind });
                }
                TransportEvent::KeyframeRequested { peer, mid } => {
                    metrics.record_keyframe();
                    negotiator.notify(NegotiationEvent::KeyframeRequested { peer, mid });
                }
                TransportEvent::TrackStats { peer, mid, reading } => {
                    let Some(peer_uuid) = crate::telemetry::peer_uuid(&peer) else {
                        continue;
                    };
                    // Hors d'une room, l'échantillon n'a aucun
                    // `telemetry.peers.id` auquel se rattacher : l'écrire
                    // produirait une ligne orpheline.
                    let Some(occupancy) = telemetry.occupancy_of(peer_uuid) else {
                        continue;
                    };
                    let mid = mid.to_string();
                    // Le premier relevé ne rend rien : un cumul seul ne dit
                    // rien, il faut un précédent à soustraire.
                    if let Some(d) = sampler.ingress(&mid, &reading) {
                        telemetry.record(Entry::TrackSample(TrackSample {
                            track_id: telemetry.track_id(occupancy, &mid),
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
                }
                TransportEvent::IceState { peer, state } => {
                    let Some(connection) = crate::telemetry::peer_uuid(&peer) else {
                        continue;
                    };
                    let Some(occupancy) = telemetry.occupancy_of(connection) else {
                        continue;
                    };
                    let at = chrono::Utc::now();
                    let label = format!("{state:?}").to_lowercase();
                    telemetry.record(Entry::IceState {
                        peer_id: occupancy,
                        state: label,
                        at,
                    });
                    // `New` et `Checking` sont des états de passage : les
                    // inscrire dans `peers.ice_state` est utile, en faire des
                    // lignes d'`events` noierait le journal sous du bruit de
                    // négociation.
                    //
                    // str0m 0.23.1 n'expose pas d'état `Failed` : le seul
                    // échec observable ici est `Disconnected`, d'où l'absence
                    // de branche `IceFailed`. Elle viendra de la détection de
                    // timeout, pas de cet événement.
                    let kind = match state {
                        str0m::IceConnectionState::Connected
                        | str0m::IceConnectionState::Completed => Some(EventKind::IceConnected),
                        str0m::IceConnectionState::Disconnected => {
                            Some(EventKind::IceDisconnected)
                        }
                        _ => None,
                    };
                    if let Some(kind) = kind {
                        telemetry
                            .record(Entry::Event(EventRecord::new(kind, at).peer(occupancy)));
                    }
                }
                TransportEvent::PeerStats { peer, reading } => {
                    let Some(peer_uuid) = crate::telemetry::peer_uuid(&peer) else {
                        continue;
                    };
                    let Some(occupancy) = telemetry.occupancy_of(peer_uuid) else {
                        continue;
                    };
                    if let Some(d) = sampler.peer(&reading) {
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::telemetry::MemorySink;
    use crate::telemetry::sampler::IngressReading;
    use std::time::Duration;
    use uuid::Uuid;

    /// Drives the pump with two readings of the same m-line and returns what
    /// telemetry recorded.
    ///
    /// Two readings, because the first is only a baseline: the sampler needs a
    /// previous total to subtract from.
    async fn pump_two_readings(
        first: IngressReading,
        second: IngressReading,
    ) -> Vec<crate::telemetry::Entry> {
        pump(first, second, true).await
    }

    async fn pump(
        first: IngressReading,
        second: IngressReading,
        joined: bool,
    ) -> Vec<crate::telemetry::Entry> {
        let engine = ForwardingEngine::new();
        let negotiator = Negotiator::new(engine.clone());
        let sink = Arc::new(MemorySink::new());
        let telemetry = Telemetry::new(sink.clone());
        let peer_id: Arc<str> = Arc::from(Uuid::new_v4().to_string());
        if joined {
            let connection = crate::telemetry::peer_uuid(&peer_id).expect("uuid");
            telemetry.set_occupancy(connection, Uuid::new_v4());
        }
        let (tx, rx) = mpsc::channel(8);

        spawn_transport_pump(
            engine,
            negotiator,
            Metrics::new(),
            telemetry,
            Arc::clone(&peer_id),
            rx,
        );

        for reading in [first, second] {
            tx.send(TransportEvent::TrackStats {
                peer: Arc::clone(&peer_id),
                mid: str0m::media::Mid::from("0"),
                reading,
            })
            .await
            .expect("la pompe écoute");
        }

        // La pompe est une task : lui laisser le temps de consommer les deux
        // événements avant de lire ce qu'elle a produit.
        tokio::time::sleep(Duration::from_millis(50)).await;
        sink.drain()
    }

    fn reading(bytes: u64, packets: u64, nacks: u64, plis: u64, firs: u64) -> IngressReading {
        IngressReading {
            bytes,
            packets,
            nacks,
            plis,
            firs,
            jitter: 900,
            clock_rate: 90_000,
            loss: Some(0.02),
            rtt_ms: Some(48.0),
        }
    }

    fn packet(mid: &str) -> crate::media::RtpPacketData {
        use str0m::format::{Codec, CodecSpec, PayloadParams};
        use str0m::media::{Frequency, Pt};
        crate::media::RtpPacketData {
            params: PayloadParams::new(
                Pt::from(96),
                None,
                CodecSpec {
                    codec: Codec::Vp8,
                    clock_rate: Frequency::NINETY_KHZ,
                    channels: None,
                    format: Default::default(),
                },
            ),
            payload: Arc::from(&b"payload"[..]),
            mid: str0m::media::Mid::from(mid),
            network_time: std::time::Instant::now(),
            rtp_time: 90_000,
            is_video: true,
        }
    }

    /// Drives the pump with media packets and returns what telemetry recorded.
    async fn pump_packets(mids: &[&str]) -> Vec<crate::telemetry::Entry> {
        let engine = ForwardingEngine::new();
        let negotiator = Negotiator::new(engine.clone());
        let sink = Arc::new(MemorySink::new());
        let telemetry = Telemetry::new(sink.clone());
        let peer_id: Arc<str> = Arc::from(Uuid::new_v4().to_string());
        let connection = crate::telemetry::peer_uuid(&peer_id).expect("uuid");
        telemetry.set_occupancy(connection, Uuid::new_v4());
        let (tx, rx) = mpsc::channel(8);

        spawn_transport_pump(
            engine,
            negotiator,
            Metrics::new(),
            telemetry,
            Arc::clone(&peer_id),
            rx,
        );

        for mid in mids {
            tx.send(TransportEvent::Media {
                peer: Arc::clone(&peer_id),
                packet: packet(mid),
            })
            .await
            .expect("la pompe écoute");
        }

        tokio::time::sleep(Duration::from_millis(50)).await;
        sink.drain()
    }

    #[tokio::test]
    async fn the_codec_is_recorded_once_per_track_not_once_per_packet() {
        // Le codec n'arrive qu'avec le premier paquet, et il ne change pas.
        // En émettre un par paquet produirait un UPDATE par paquet — des
        // centaines par seconde et par track.
        let entries = pump_packets(&["0", "0", "0"]).await;

        let codecs: Vec<_> = entries
            .iter()
            .filter_map(|e| match e {
                crate::telemetry::Entry::TrackCodec { codec, clock_rate, .. } => {
                    Some((codec.clone(), *clock_rate))
                }
                _ => None,
            })
            .collect();

        assert_eq!(codecs.len(), 1, "un seul TrackCodec pour trois paquets");
        assert_eq!(codecs[0], ("vp8".to_string(), 90_000));
    }

    #[tokio::test]
    async fn two_tracks_each_get_their_own_codec_entry() {
        let entries = pump_packets(&["0", "1", "0", "1"]).await;

        let codecs = entries
            .iter()
            .filter(|e| matches!(e, crate::telemetry::Entry::TrackCodec { .. }))
            .count();

        assert_eq!(codecs, 2, "un TrackCodec par mid");
    }

    /// Drives the pump with one ICE state change.
    async fn pump_ice(state: str0m::IceConnectionState) -> Vec<crate::telemetry::Entry> {
        let engine = ForwardingEngine::new();
        let negotiator = Negotiator::new(engine.clone());
        let sink = Arc::new(MemorySink::new());
        let telemetry = Telemetry::new(sink.clone());
        let peer_id: Arc<str> = Arc::from(Uuid::new_v4().to_string());
        let connection = crate::telemetry::peer_uuid(&peer_id).expect("uuid");
        telemetry.set_occupancy(connection, Uuid::new_v4());
        let (tx, rx) = mpsc::channel(8);

        spawn_transport_pump(
            engine,
            negotiator,
            Metrics::new(),
            telemetry,
            Arc::clone(&peer_id),
            rx,
        );

        tx.send(TransportEvent::IceState {
            peer: Arc::clone(&peer_id),
            state,
        })
        .await
        .expect("la pompe écoute");

        tokio::time::sleep(Duration::from_millis(50)).await;
        sink.drain()
    }

    fn ice_event_kinds(entries: &[crate::telemetry::Entry]) -> Vec<EventKind> {
        entries
            .iter()
            .filter_map(|e| match e {
                crate::telemetry::Entry::Event(r) => Some(r.kind),
                _ => None,
            })
            .collect()
    }

    #[tokio::test]
    async fn a_connected_ice_state_is_recorded_and_raises_an_event() {
        let entries = pump_ice(str0m::IceConnectionState::Connected).await;

        let state = entries.iter().find_map(|e| match e {
            crate::telemetry::Entry::IceState { state, .. } => Some(state.clone()),
            _ => None,
        });
        assert_eq!(state.as_deref(), Some("connected"));
        assert_eq!(ice_event_kinds(&entries), vec![EventKind::IceConnected]);
    }

    #[tokio::test]
    async fn a_disconnected_ice_state_raises_the_disconnected_event() {
        let entries = pump_ice(str0m::IceConnectionState::Disconnected).await;

        assert_eq!(ice_event_kinds(&entries), vec![EventKind::IceDisconnected]);
    }

    #[tokio::test]
    async fn a_transient_ice_state_is_recorded_without_raising_an_event() {
        // `Checking` est un état de passage : l'inscrire dans `peers.ice_state`
        // est utile, en faire une ligne d'`events` noierait le journal sous du
        // bruit de négociation.
        let entries = pump_ice(str0m::IceConnectionState::Checking).await;

        let state = entries.iter().find_map(|e| match e {
            crate::telemetry::Entry::IceState { state, .. } => Some(state.clone()),
            _ => None,
        });
        assert_eq!(state.as_deref(), Some("checking"));
        assert!(
            ice_event_kinds(&entries).is_empty(),
            "aucun event pour un état de passage"
        );
    }

    #[tokio::test]
    async fn the_pump_records_one_track_sample_per_delta_not_per_reading() {
        let entries = pump_two_readings(reading(1000, 10, 1, 2, 3), reading(1500, 15, 2, 4, 5)).await;

        let samples: Vec<_> = entries
            .iter()
            .filter(|e| matches!(e, crate::telemetry::Entry::TrackSample(_)))
            .collect();
        assert_eq!(
            samples.len(),
            1,
            "le premier relevé est une référence, pas un échantillon"
        );
    }

    #[tokio::test]
    async fn a_peer_that_has_not_joined_a_room_produces_no_sample() {
        // Sans occupation, l'échantillon n'a aucun `telemetry.peers.id`
        // auquel se rattacher : l'écrire produirait une ligne orpheline que
        // ni la room ni le participant ne retrouveraient jamais.
        let entries = pump(reading(1000, 10, 1, 2, 3), reading(1500, 15, 2, 4, 6), false).await;

        assert!(
            !entries
                .iter()
                .any(|e| matches!(e, crate::telemetry::Entry::TrackSample(_))),
            "aucun TrackSample ne doit être émis hors d'une room"
        );
    }

    #[tokio::test]
    async fn the_pump_maps_every_counter_to_its_own_field() {
        // Des valeurs toutes distinctes : une transcription qui échangerait
        // deux champs (plis <- nacks) passerait inaperçue avec des valeurs
        // égales, et c'est le seul vrai risque de ce câblage.
        let entries = pump_two_readings(reading(1000, 10, 1, 2, 3), reading(1500, 15, 2, 4, 6)).await;

        let sample = entries
            .iter()
            .find_map(|e| match e {
                crate::telemetry::Entry::TrackSample(s) => Some(s),
                _ => None,
            })
            .expect("un TrackSample");

        assert_eq!(sample.bytes, 500, "bytes");
        assert_eq!(sample.packets, 5, "packets");
        assert_eq!(sample.nacks, 1, "nacks");
        assert_eq!(sample.plis, 2, "plis");
        assert_eq!(sample.firs, 3, "firs");
        assert_eq!(sample.jitter_ms, Some(10.0), "900 unités à 90 kHz = 10 ms");
        assert_eq!(sample.loss, Some(0.02), "loss");
        assert_eq!(sample.rtt_ms, Some(48.0), "rtt_ms");
    }
}
