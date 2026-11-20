//! A peer's event loop: str0m ↔ UDP socket pump.

use super::peer_connection::PeerConnection;
use crate::media::RtpPacketData;
use crate::metrics::{DropSite, PacketDrops};
use crate::telemetry::sampler::{IngressReading, PeerReading};
use std::collections::HashSet;
use std::sync::Arc;
use std::time::{Duration, Instant};
use str0m::{
    Candidate, Event, IceConnectionState, Input, Output,
    media::{MediaKind, Mid},
    net::Receive,
    net::Transmit,
};
use tokio::sync::Mutex;
use tokio::sync::mpsc::Sender;
use tokio::sync::mpsc::error::TrySendError;
use tokio::sync::oneshot;

/// Size of the UDP receive buffer (a comfortable MTU).
const RECV_BUFFER_SIZE: usize = 2000;

/// Inbound packets the SFU drops before they reach the forwarding engine.
///
/// The counts go to the peer's shared [`PacketDrops`], read by `/metrics` and
/// telemetry. Logging every drop would drown the logs: a saturated queue
/// produces as many as the publisher emits packets, i.e. hundreds per second.
/// Only the first loss of a burst is traced, with the running total; the burst
/// ends as soon as a packet gets through again.
struct IngressDrops {
    counters: Arc<PacketDrops>,
    queue_bursting: bool,
    /// The mids currently in an unknown-PT burst.
    ///
    /// Per mid, unlike the queue: an unknown PT is a property of one m-line.
    /// With a single flag, the valid packets of another mid would end the
    /// burst at every turn and bring back one `warn!` per rejected packet.
    unknown_pt_bursting: HashSet<Mid>,
}

impl IngressDrops {
    fn new(counters: Arc<PacketDrops>) -> Self {
        IngressDrops {
            counters,
            queue_bursting: false,
            unknown_pt_bursting: HashSet::new(),
        }
    }

    /// A packet of `mid` was rejected for its PT. `true` when it opens a
    /// burst, i.e. when it should be logged.
    fn unknown_pt_starts_burst(&mut self, mid: Mid) -> bool {
        self.unknown_pt_bursting.insert(mid)
    }

    /// A packet of `mid` passed the PT check: its burst, if any, is over.
    fn unknown_pt_ends_burst(&mut self, mid: Mid) {
        // `is_empty` d'abord : le cas normal ne paie pas un hash par paquet.
        if !self.unknown_pt_bursting.is_empty() {
            self.unknown_pt_bursting.remove(&mid);
        }
    }
}

/// Runs the connection until it closes.
///
/// Alternates between draining str0m's outputs (transmits, events) and waiting
/// for either an inbound datagram or the deadline str0m asked for. The media
/// packets received are pushed onto `rtp_tx`, bound for the forwarding engine.
///
/// `drops` are the peer's counters: the inbound packets dropped here — queue
/// full, unknown payload type — are counted there, as ingress drops. They are
/// also attached to every [`TransportEvent::PeerStats`], for telemetry.
///
/// `shutdown` is the stop signal the session emits when the WebSocket closes.
/// It is armed inside the `select!` rather than checked between two turns:
/// str0m sometimes asks for distant deadlines, and the loop must exit without
/// waiting for the next one. On receiving it the `Rtc` is closed cleanly
/// (`Rtc::disconnect`) and the loop returns, releasing the UDP socket and its
/// reference to the [`PeerConnection`].
///
/// The datagrams str0m produces are not sent under the lock: they are
/// accumulated, then sent once the `MutexGuard` has been released, so that the
/// `PeerSink`'s RTP writer task is not left stuck behind a burst of syscalls.
pub async fn run(
    conn: Arc<Mutex<PeerConnection>>,
    events: Sender<TransportEvent>,
    drops: Arc<PacketDrops>,
    mut shutdown: oneshot::Receiver<()>,
) {
    let (socket, local_addr, peer_id) = {
        let mut c = conn.lock().await;

        let local_addr = match c.local_ice_addr() {
            Ok(addr) => addr,
            Err(e) => {
                tracing::error!("Peer {} — adresse ICE locale : {}", c.peer_id, e);
                return;
            }
        };

        if let Ok(candidate) = Candidate::host(local_addr, "udp") {
            c.rtc.add_local_candidate(candidate);
        }

        (c.socket.clone(), local_addr, Arc::clone(&c.peer_id))
    };

    let mut buf = vec![0u8; RECV_BUFFER_SIZE];

    // Buffer of datagrams to send, filled under the lock and drained once the
    // lock has been released. Reused from one turn to the next: `drain` empties
    // it without giving back its capacity, hence no allocation at all in the
    // steady state.
    let mut outbound: Vec<Transmit> = Vec::new();
    let mut ingress_drops = IngressDrops::new(drops);

    loop {
        let timeout = {
            let mut c = conn.lock().await;

            // A closed `Rtc` — through `disconnect` or an internal failure —
            // produces neither transmits nor events any more, and returns only
            // a "never" deadline. Carrying on would mean sleeping forever while
            // holding the socket.
            if !c.rtc.is_alive() {
                tracing::debug!("Peer {} — Rtc fermée, arrêt de la boucle", c.peer_id);
                break;
            }

            loop {
                match c.rtc.poll_output() {
                    Ok(Output::Timeout(t)) => break t,
                    // Set aside, not sent: see the send loop below.
                    Ok(Output::Transmit(t)) => outbound.push(t),
                    Ok(Output::Event(event)) => {
                        handle_event(&mut c, event, &events, &mut ingress_drops)
                    }
                    Err(e) => {
                        tracing::error!("Peer {} — poll_output : {}", c.peer_id, e);
                        return;
                    }
                }
            }
        };

        // The `MutexGuard` dropped on the previous line: the send syscalls
        // happen outside the critical section, so ingress and egress are no
        // longer serialized. The order stays the one in which str0m produced
        // the datagrams — `push` then `drain` preserve FIFO, and this is a
        // network protocol: order matters.
        for transmit in outbound.drain(..) {
            let _ = socket
                .send_to(&transmit.contents, transmit.destination)
                .await;
        }

        let now = Instant::now();
        let duration = timeout.saturating_duration_since(now).max(Duration::ZERO);

        tokio::select! {
            // An `Err` is as good as an `Ok`: it means the session was dropped
            // without sending the signal, which is just as much an end of life.
            _ = &mut shutdown => {
                let mut c = conn.lock().await;
                c.rtc.disconnect();
                tracing::debug!("Peer {} — session terminée, Rtc fermée", c.peer_id);
                break;
            }
            result = socket.recv_from(&mut buf) => {
                match result {
                    Ok((len, addr)) => {
                        let mut c = conn.lock().await;
                        c.remote_addr = Some(addr);
                        if let Ok(contents) = buf[..len].try_into() {
                            let _ = c.rtc.handle_input(Input::Receive(
                                Instant::now(),
                                Receive {
                                    proto: str0m::net::Protocol::Udp,
                                    source: addr,
                                    destination: local_addr,
                                    contents,
                                },
                            ));
                        }
                    }
                    Err(e) => {
                        tracing::error!("Peer UDP error : {}", e);
                        break;
                    }
                }
            }
            _ = tokio::time::sleep(duration) => {
                let mut c = conn.lock().await;
                let _ = c.rtc.handle_input(Input::Timeout(Instant::now()));
            }
        }
    }

    // `socket` and the `Arc` clone on the `PeerConnection` drop here: this is
    // the first link of the teardown that gives the UDP file descriptor back to
    // the system.
    tracing::debug!("Peer {} — boucle d'événements terminée", peer_id);
}

/// What the event loop reports to the session layer.
///
/// One channel rather than two: the announcement of a track and the packets of
/// that track must stay in order, or the negotiator would wire a subscription
/// for a source the engine has not heard of yet.
#[derive(Debug)]
pub enum TransportEvent {
    /// The peer published a new track.
    TrackAdded {
        peer: Arc<str>,
        mid: Mid,
        kind: MediaKind,
    },
    /// A media packet from the peer, ready to be forwarded.
    Media {
        peer: Arc<str>,
        packet: RtpPacketData,
    },
    /// The peer asked for a keyframe on one of the m-lines the SFU sends it.
    ///
    /// The SFU has no encoder: the request has to travel on to whoever
    /// publishes that m-line's source.
    KeyframeRequested { peer: Arc<str>, mid: Mid },
    /// One sampling interval of statistics for an m-line this peer publishes.
    ///
    /// The values are str0m's cumulative totals: turning them into deltas is
    /// the session's job, which owns the previous reading.
    TrackStats {
        peer: Arc<str>,
        mid: Mid,
        reading: IngressReading,
    },
    /// One sampling interval of this peer's transport totals.
    PeerStats {
        peer: Arc<str>,
        reading: PeerReading,
    },
    /// The peer's ICE connection changed state.
    IceState {
        peer: Arc<str>,
        state: IceConnectionState,
    },
}

/// Handles a str0m event.
fn handle_event(
    conn: &mut PeerConnection,
    event: Event,
    events: &Sender<TransportEvent>,
    drops: &mut IngressDrops,
) {
    match event {
        Event::Connected => {
            tracing::info!("✅ Peer {} connecté (ICE + DTLS)", conn.peer_id);
        }
        Event::IceConnectionStateChange(state) => {
            tracing::info!("Peer {} ICE : {:?}", conn.peer_id, state);
            // Rare et utile au diagnostic : perdu, il manquerait une
            // transition dans la chronologie du peer. On le signale.
            if let Err(TrySendError::Full(_)) = events.try_send(TransportEvent::IceState {
                peer: Arc::clone(&conn.peer_id),
                state,
            }) {
                tracing::warn!("Peer {} — état ICE {:?} non remonté", conn.peer_id, state);
            }
        }
        Event::MediaIngressStats(s) => {
            let reading = IngressReading {
                bytes: s.bytes,
                packets: s.packets,
                nacks: s.nacks,
                plis: s.plis,
                firs: s.firs,
                jitter: s.jitter,
                clock_rate: conn.rx_clock_rate(s.mid),
                loss: s.loss,
                rtt_ms: s.rtt.map(|d| d.as_secs_f32() * 1000.0),
            };
            // Une statistique perdue coûte un trou d'une seconde dans la série,
            // pas un track fantôme : contrairement à une annonce, on la jette
            // sans log, comme un paquet média.
            let _ = events.try_send(TransportEvent::TrackStats {
                peer: Arc::clone(&conn.peer_id),
                mid: s.mid,
                reading,
            });
        }
        Event::PeerStats(s) => {
            let reading = PeerReading {
                bytes_rx: s.bytes_rx,
                bytes_tx: s.bytes_tx,
                transport_bytes_rx: s.peer_bytes_rx,
                transport_bytes_tx: s.peer_bytes_tx,
                egress_loss: s.egress_loss_fraction,
                bwe_bps: s
                    .bwe_tx
                    .map(|b| i64::try_from(b.as_u64()).unwrap_or(i64::MAX)),
                // Relevés au même instant que les cumuls str0m, au rythme de
                // l'échantillonnage : la télémétrie en tire des deltas par
                // seconde comme pour le reste.
                drops: drops.counters.snapshot(),
            };
            let _ = events.try_send(TransportEvent::PeerStats {
                peer: Arc::clone(&conn.peer_id),
                reading,
            });
        }
        // Le sens sortant décrit ce que reçoit un subscriber, pas ce que publie
        // ce peer : l'attribuer aux tracks de ce peer les compterait deux fois.
        // `PeerStats` porte déjà le total transport sortant. Ignoré exprès.
        Event::MediaEgressStats(_) => {}
        Event::MediaAdded(media) => {
            tracing::info!(
                "✅ Peer {} publie {:?} sur mid={}",
                conn.peer_id,
                media.kind,
                media.mid
            );
            conn.rx_kind.insert(media.mid, media.kind);

            // A lost announcement means a track nobody ever subscribes to:
            // unlike a media packet, it cannot simply be dropped.
            let announcement = TransportEvent::TrackAdded {
                peer: Arc::clone(&conn.peer_id),
                mid: media.mid,
                kind: media.kind,
            };
            if let Err(e) = events.try_send(announcement) {
                tracing::error!(
                    "Peer {} — annonce de track perdue sur mid={} : {}",
                    conn.peer_id,
                    media.mid,
                    e
                );
            }
        }
        Event::MediaData(data) => {
            let mid = data.mid;
            let pt = data.pt;
            let Some(packet) = conn.to_packet(data) else {
                drops
                    .counters
                    .record(DropSite::UnknownPt, conn.rx_is_video(mid));
                if drops.unknown_pt_starts_burst(mid) {
                    tracing::warn!(
                        "Peer {} — PT {} absent du codec config sur mid={}, paquet ignoré (total {})",
                        conn.peer_id,
                        pt,
                        mid,
                        drops.counters.total(DropSite::UnknownPt)
                    );
                }
                return;
            };
            drops.unknown_pt_ends_burst(mid);
            let is_video = packet.is_video;
            // `Arc::clone`: the peer_id never changes, so sending it per packet
            // no longer has to reallocate it.
            let event = TransportEvent::Media {
                peer: Arc::clone(&conn.peer_id),
                packet,
            };
            match events.try_send(event) {
                Ok(()) => drops.queue_bursting = false,
                // Real-time media: the engine is behind, this packet is already
                // worthless. We drop it rather than wait.
                Err(TrySendError::Full(_)) => {
                    drops.counters.record(DropSite::IngressQueue, is_video);
                    if !drops.queue_bursting {
                        drops.queue_bursting = true;
                        tracing::warn!(
                            "Peer {} — file de forwarding pleine, paquet entrant jeté (total {})",
                            conn.peer_id,
                            drops.counters.total(DropSite::IngressQueue)
                        );
                    }
                }
                // The session is gone: swallowing silently is the normal case.
                Err(TrySendError::Closed(_)) => {}
            }
        }
        Event::KeyframeRequest(request) => {
            tracing::debug!(
                "Peer {} — keyframe demandée sur mid={}",
                conn.peer_id,
                request.mid
            );
            let _ = events.try_send(TransportEvent::KeyframeRequested {
                peer: Arc::clone(&conn.peer_id),
                mid: request.mid,
            });
        }
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::media::RtpSink;
    use crate::metrics::{DropCounts, KindCounts, Metrics};
    use crate::transport::PeerSink;
    use str0m::format::{Codec, CodecExtra};
    use str0m::media::{ExtensionValues, Frequency, MediaData, MediaTime, Pt};
    use str0m::rtp::SeqNo;
    use tokio::sync::mpsc;

    const AUDIO: &str = "0";
    const VIDEO: &str = "1";

    /// Une connexion dont le mid 0 publie de l'audio et le mid 1 de la vidéo.
    async fn connection(peer: &str) -> PeerConnection {
        let (sender, _rx) = mpsc::channel(4);
        let mut conn = PeerConnection::new(
            Arc::from(peer),
            sender,
            "127.0.0.1".to_string(),
            None,
            Duration::from_secs(1),
        )
        .await;
        conn.rx_kind.insert(Mid::from(AUDIO), MediaKind::Audio);
        conn.rx_kind.insert(Mid::from(VIDEO), MediaKind::Video);
        conn
    }

    /// Le PT qu'annonce la config de codecs de `conn` pour `codec`.
    fn pt_of(conn: &PeerConnection, codec: Codec) -> Pt {
        conn.rtc
            .codec_config()
            .params()
            .iter()
            .find(|p| p.spec().codec == codec)
            .map(|p| p.pt())
            .expect("codec configuré")
    }

    /// Un PT dynamique absent de la config de codecs de `conn`.
    fn unknown_pt(conn: &PeerConnection) -> Pt {
        let configured: Vec<Pt> = conn
            .rtc
            .codec_config()
            .params()
            .iter()
            .map(|p| p.pt())
            .collect();
        (96..=127u8)
            .map(Pt::from)
            .find(|pt| !configured.contains(pt))
            .expect("un PT dynamique libre")
    }

    fn media(conn: &PeerConnection, mid: &str, pt: Pt) -> Event {
        let params = conn.rtc.codec_config().params()[0];
        Event::MediaData(MediaData {
            mid: Mid::from(mid),
            pt,
            rid: None,
            params,
            time: MediaTime::new(0, Frequency::FORTY_EIGHT_KHZ),
            network_time: Instant::now(),
            seq_range: SeqNo::from(1)..=SeqNo::from(1),
            contiguous: true,
            data: Arc::from(&b"frame"[..]),
            ext_vals: ExtensionValues::default(),
            codec_extra: CodecExtra::None,
            last_sender_info: None,
            audio_start_of_talk_spurt: false,
        })
    }

    /// Un PT inconnu en continu sur un mid, pendant qu'un autre mid tourne
    /// normalement, ne produit qu'un début de rafale — donc un seul `warn!`.
    #[tokio::test]
    async fn valid_traffic_on_another_mid_does_not_end_an_unknown_pt_burst() {
        let mut conn = connection("alice").await;
        let opus = pt_of(&conn, Codec::Opus);
        let unknown = unknown_pt(&conn);
        let (events, _rx) = mpsc::channel(64);
        let mut drops = IngressDrops::new(Arc::new(PacketDrops::new()));

        let mut bursts = 0;
        for _ in 0..10 {
            let opened_before = drops.unknown_pt_bursting.len();
            let event = media(&conn, VIDEO, unknown);
            handle_event(&mut conn, event, &events, &mut drops);
            if drops.unknown_pt_bursting.len() > opened_before {
                bursts += 1;
            }
            let event = media(&conn, AUDIO, opus);
            handle_event(&mut conn, event, &events, &mut drops);
        }
        assert_eq!(bursts, 1);
        assert_eq!(drops.counters.total(DropSite::UnknownPt), 10);

        // Un paquet valide sur le mid fautif, lui, clôt la rafale.
        drops.unknown_pt_ends_burst(Mid::from(VIDEO));
        assert!(drops.unknown_pt_starts_burst(Mid::from(VIDEO)));
    }

    /// Une file d'entrée saturée fait monter, sur /metrics, le compteur du
    /// peer émetteur, dans le sens entrant, pour le type du paquet — et rien
    /// d'autre.
    #[tokio::test]
    async fn a_full_ingress_queue_shows_on_metrics_for_the_sender_as_ingress_audio() {
        let metrics = Metrics::new();
        let alice = metrics.register_peer_drops(&Arc::from("alice"));
        metrics.register_peer_drops(&Arc::from("bob"));

        let mut conn = connection("alice").await;
        let opus = pt_of(&conn, Codec::Opus);
        // File d'une place, jamais lue : le premier paquet passe, les trois
        // suivants sont jetés.
        let (events, _rx) = mpsc::channel(1);
        let mut drops = IngressDrops::new(alice);
        for _ in 0..4 {
            let event = media(&conn, AUDIO, opus);
            handle_event(&mut conn, event, &events, &mut drops);
        }

        let snap = metrics.snapshot().packet_drops;
        assert_eq!(
            snap.peers["alice"],
            DropCounts {
                ingress_queue: KindCounts { audio: 3, video: 0 },
                ..Default::default()
            }
        );
        assert_eq!(snap.peers["bob"], DropCounts::default());
    }

    /// Un PT absent de la config est compté, au bon type de média.
    #[tokio::test]
    async fn an_unknown_payload_type_is_counted_per_media_kind() {
        let metrics = Metrics::new();
        let alice = metrics.register_peer_drops(&Arc::from("alice"));

        let mut conn = connection("alice").await;
        let (events, _rx) = mpsc::channel(16);
        let mut drops = IngressDrops::new(alice);
        let unknown = unknown_pt(&conn);
        for mid in [AUDIO, VIDEO, VIDEO] {
            let event = media(&conn, mid, unknown);
            handle_event(&mut conn, event, &events, &mut drops);
        }

        let snap = metrics.snapshot().packet_drops;
        assert_eq!(
            snap.peers["alice"].unknown_pt,
            KindCounts { audio: 1, video: 2 }
        );
        assert_eq!(snap.peers["alice"].ingress_queue, KindCounts::default());
    }

    /// Sans saturation, les trois compteurs restent à zéro.
    #[tokio::test]
    async fn an_unsaturated_session_drops_nothing() {
        let metrics = Metrics::new();
        let alice = metrics.register_peer_drops(&Arc::from("alice"));

        let mut conn = connection("alice").await;
        let opus = pt_of(&conn, Codec::Opus);
        let vp8 = pt_of(&conn, Codec::Vp8);
        let (events, _rx) = mpsc::channel(64);
        let mut drops = IngressDrops::new(Arc::clone(&alice));
        for _ in 0..20 {
            let event = media(&conn, AUDIO, opus);
            handle_event(&mut conn, event, &events, &mut drops);
            let event = media(&conn, VIDEO, vp8);
            handle_event(&mut conn, event, &events, &mut drops);
        }
        let sink = PeerSink::new(Arc::from("alice"), Arc::new(Mutex::new(conn)), alice);
        for _ in 0..20 {
            sink.write_rtp(crate::media::RtpPacketData {
                params: PayloadParamsFixture::opus(),
                payload: Arc::from(&b"frame"[..]),
                mid: Mid::from(AUDIO),
                network_time: Instant::now(),
                rtp_time: 0,
                is_video: false,
            });
        }

        assert_eq!(
            metrics.snapshot().packet_drops.totals,
            DropCounts::default()
        );
    }

    struct PayloadParamsFixture;

    impl PayloadParamsFixture {
        fn opus() -> str0m::format::PayloadParams {
            str0m::format::PayloadParams::new(
                Pt::from(111),
                None,
                str0m::format::CodecSpec {
                    codec: Codec::Opus,
                    clock_rate: Frequency::FORTY_EIGHT_KHZ,
                    channels: Some(2),
                    format: Default::default(),
                },
            )
        }
    }
}
