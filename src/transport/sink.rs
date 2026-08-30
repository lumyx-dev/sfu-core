//! Bridge between the media layer and a WebRTC connection.

use super::peer_connection::PeerConnection;
use crate::media::{RtpPacketData, RtpSink};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::Duration;
use tokio::sync::Mutex;
use tokio::sync::mpsc::{self, error::TrySendError};

/// PLI retry ladder used after a new subscriber subscribes.
///
/// The source peer must produce a keyframe for the newcomer to be able to
/// decode; a single request is lost too often while the connection settles,
/// hence the staggered repetition.
const KEYFRAME_RETRY_DELAYS_MS: [u64; 4] = [200, 500, 1000, 2000];

/// Depth of a peer's RTP write queue.
///
/// Measured against the rate of a 1080p video publisher — ~150 packets/s — 128
/// packets are worth **~850 ms of media for a single source**. Every source of
/// a given subscriber shares this queue: the real ceiling drops to ~425 ms with
/// two publishers, ~210 ms with four.
///
/// This is a safety rail, not a target: in normal conditions the queue stays
/// almost empty, the writer task consuming as fast as the engine produces. The
/// sizing aims at two bounds at once — staying above a keyframe burst (a 1080p
/// IDR fragments over about a hundred MTU-sized packets), so that a mere
/// scheduling hiccup does not truncate it, and staying low enough that a
/// durably stalled WebRTC write inflates neither memory nor latency.
const RTP_QUEUE_CAPACITY: usize = 128;

/// A sink's write queue and its drop policy.
///
/// For real-time media, accumulating makes no sense: a packet that waited
/// hundreds of milliseconds arrives too late to be usefully decoded. When the
/// queue is full we drop it — but never silently, hence the counter.
struct RtpQueue {
    tx: mpsc::Sender<RtpPacketData>,
    /// Packets dropped since the sink was created.
    dropped: AtomicU64,
    /// Whether a drop burst is under way.
    ///
    /// A saturated queue drops as many packets as the publishers emit, i.e.
    /// hundreds per second: logging every loss would drown the logs. Only the
    /// first of a burst is traced, and the burst ends as soon as a packet gets
    /// through again.
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

    /// Queues a packet, or drops it if the queue is full.
    ///
    /// Never blocks: called from the forwarding hot path, which is
    /// synchronous.
    fn push(&self, peer_id: &str, packet: RtpPacketData) {
        match self.tx.try_send(packet) {
            Ok(()) => {
                // Read before write: in normal conditions the flag is already
                // `false`, and this avoids dirtying its cache line on every
                // packet and every subscriber.
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
            // Closed sink: "a closed sink silently swallows it" is the trait's
            // contract, not a loss worth reporting.
            Err(TrySendError::Closed(_)) => {}
        }
    }

    fn dropped(&self) -> u64 {
        self.dropped.load(Ordering::Relaxed)
    }
}

/// Production implementation of [`RtpSink`]: queues the packets, and a
/// dedicated task writes them to the [`PeerConnection`].
///
/// The queue decouples the forwarding hot path (synchronous, non-waiting) from
/// the WebRTC write (asynchronous, under a mutex). One sink per peer: every
/// source writing to it goes through the same queue, hence a single writer.
///
/// It is **bounded**: if the WebRTC write stalls, the excess packets are
/// dropped rather than queued. See [`RTP_QUEUE_CAPACITY`] and
/// [`PeerSink::dropped_packets`].
pub struct PeerSink {
    peer_id: Arc<str>,
    queue: RtpQueue,
    conn: Arc<Mutex<PeerConnection>>,
}

impl PeerSink {
    /// Creates the sink and starts its writer task.
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

    /// Packets dropped since the sink was created, for lack of room in the
    /// queue.
    ///
    /// Stays at zero as long as the WebRTC write keeps up with forwarding; a
    /// rising value points at a peer whose output is falling behind.
    ///
    /// NOTE: this counter is not relayed through `/metrics` yet — the media
    /// layer has no access to [`crate::metrics::Metrics`], and wiring it there
    /// would be out of scope. For now it is only readable from here and through
    /// [`RtpQueue::push`]'s logging.
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

    /// Minimal video packet, whose instances differ only by their payload.
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

    /// A saturated queue must neither block the caller nor inflate memory: the
    /// excess packet is dropped.
    #[test]
    fn a_full_queue_drops_the_extra_packets_instead_of_queueing_them() {
        // The receiver is held but never read: the queue fills up, then
        // saturates at its capacity.
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

    /// Dropping must stay observable, otherwise it would be worse than the
    /// unbounded queue it replaces.
    #[test]
    fn the_drop_counter_stays_at_zero_while_the_queue_has_room() {
        let (tx, _rx) = mpsc::channel::<RtpPacketData>(4);
        let queue = RtpQueue::new(tx);

        for _ in 0..4 {
            queue.push("alice", packet(b"frame"));
        }

        assert_eq!(queue.dropped(), 0, "rien ne doit être jeté avant saturation");
    }

    /// RTP is an ordered protocol: the queue must not reorder what is put into
    /// it, not even under saturation.
    #[tokio::test]
    async fn the_queue_preserves_the_order_of_the_packets_it_accepts() {
        let (tx, mut rx) = mpsc::channel::<RtpPacketData>(4);
        let queue = RtpQueue::new(tx);

        // Six sends for two drops: what comes out must be the prefix of the
        // accepted ones, in input order.
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

    /// The counter the sink exposes must be its queue's own.
    ///
    /// The runtime is single-threaded and nothing awaits between the writes:
    /// the writer task cannot slip in to drain the queue.
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
