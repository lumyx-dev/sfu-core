//! A peer's event loop: str0m ↔ UDP socket pump.

use super::peer_connection::PeerConnection;
use crate::media::RtpPacketData;
use std::sync::Arc;
use std::time::{Duration, Instant};
use str0m::{Candidate, Event, Input, Output, media::MediaKind, net::Receive, net::Transmit};
use tokio::sync::Mutex;
use tokio::sync::mpsc::Sender;
use tokio::sync::mpsc::error::TrySendError;
use tokio::sync::oneshot;

/// Size of the UDP receive buffer (a comfortable MTU).
const RECV_BUFFER_SIZE: usize = 2000;

/// Inbound packets dropped for lack of room in the forwarding engine's queue.
///
/// Logging every drop would drown the logs: a saturated queue produces as many
/// as the publisher emits packets, i.e. hundreds per second. Only the first
/// loss of a burst is traced, with the running total; the burst ends as soon as
/// a packet gets through again.
#[derive(Default)]
struct IngressDrops {
    total: u64,
    bursting: bool,
}

/// Runs the connection until it closes.
///
/// Alternates between draining str0m's outputs (transmits, events) and waiting
/// for either an inbound datagram or the deadline str0m asked for. The media
/// packets received are pushed onto `rtp_tx`, bound for the forwarding engine.
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
    rtp_tx: Sender<(Arc<str>, RtpPacketData)>,
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
    let mut ingress_drops = IngressDrops::default();

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
                        handle_event(&mut c, event, &rtp_tx, &mut ingress_drops)
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

/// Handles a str0m event.
fn handle_event(
    conn: &mut PeerConnection,
    event: Event,
    rtp_tx: &Sender<(Arc<str>, RtpPacketData)>,
    drops: &mut IngressDrops,
) {
    match event {
        Event::Connected => {
            tracing::info!("✅ Peer {} connecté (ICE + DTLS)", conn.peer_id);
        }
        Event::IceConnectionStateChange(state) => {
            tracing::info!("Peer {} ICE : {:?}", conn.peer_id, state);
        }
        Event::MediaAdded(media) => {
            tracing::info!(
                "✅ Peer {} media ajouté : {:?} mid={:?}",
                conn.peer_id,
                media.kind,
                media.mid
            );
            conn.tx_streams.insert(media.mid, media.kind);
            conn.mid_kind.insert(media.mid, media.kind);
        }
        Event::MediaData(data) => {
            let packet = to_packet(conn, data);
            // `Arc::clone`: the peer_id never changes, so sending it per packet
            // no longer has to reallocate it.
            match rtp_tx.try_send((Arc::clone(&conn.peer_id), packet)) {
                Ok(()) => drops.bursting = false,
                // Real-time media: the engine is behind, this packet is already
                // worthless. We drop it rather than wait.
                Err(TrySendError::Full(_)) => {
                    drops.total += 1;
                    if !drops.bursting {
                        drops.bursting = true;
                        tracing::warn!(
                            "Peer {} — file de forwarding pleine, paquet entrant jeté (total {})",
                            conn.peer_id,
                            drops.total
                        );
                    }
                }
                // The session is gone: swallowing silently is the normal case.
                Err(TrySendError::Closed(_)) => {}
            }
        }
        Event::KeyframeRequest(_) => {
            tracing::info!("Peer {} — keyframe request reçue", conn.peer_id);
        }
        _ => {}
    }
}

/// Converts a str0m `MediaData` into an internal packet, rebasing the timestamp
/// onto the media kind's RTP clock (90 kHz video, 48 kHz audio).
///
/// The `MediaData` is consumed: its `data` field — already an `Arc<[u8]>` — is
/// moved into the packet as is, without conversion or copy. It is the same type
/// `Writer::write` expects on the way out, so the buffer received from str0m is
/// the very one handed back to it.
fn to_packet(conn: &PeerConnection, data: str0m::media::MediaData) -> RtpPacketData {
    let mid = data.mid;
    let is_video = conn
        .mid_kind
        .get(&mid)
        .map(|k| *k == MediaKind::Video)
        .unwrap_or(false);

    let freq = if is_video {
        str0m::media::Frequency::NINETY_KHZ
    } else {
        str0m::media::Frequency::FORTY_EIGHT_KHZ
    };

    RtpPacketData {
        payload_type: *data.pt,
        sequence_number: 0,
        timestamp: data.time.as_seconds() as u32,
        ssrc: 0,
        payload: data.data,
        is_keyframe: data.contiguous,
        mid,
        network_time: data.network_time,
        rtp_time: data.time.rebase(freq).numer(),
        is_video,
    }
}
