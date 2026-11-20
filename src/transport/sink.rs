//! Bridge between the media layer and a WebRTC connection.

use super::peer_connection::PeerConnection;
use crate::media::{RtpPacketData, RtpSink};
use crate::metrics::{DropSite, PacketDrops};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use str0m::media::Mid;
use tokio::sync::Mutex;
use tokio::sync::mpsc::{self, error::TrySendError};

/// PLI retry ladder used after a new subscriber subscribes.
///
/// The source peer must produce a keyframe for the newcomer to be able to
/// decode; a single request is lost too often while the connection settles,
/// hence the staggered repetition. The first one goes out immediately — the
/// subscriber is already negotiated by the time this is called, so there is
/// nothing to wait for.
const KEYFRAME_RETRY_DELAYS_MS: [u64; 4] = [0, 200, 600, 1500];

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
    /// The peer's drop counters, shared with `/metrics` and telemetry. This
    /// queue counts into [`DropSite::EgressQueue`].
    drops: Arc<PacketDrops>,
    /// Whether a drop burst is under way.
    ///
    /// A saturated queue drops as many packets as the publishers emit, i.e.
    /// hundreds per second: logging every loss would drown the logs. Only the
    /// first of a burst is traced, and the burst ends as soon as a packet gets
    /// through again.
    bursting: AtomicBool,
}

impl RtpQueue {
    fn new(tx: mpsc::Sender<RtpPacketData>, drops: Arc<PacketDrops>) -> Self {
        RtpQueue {
            tx,
            drops,
            bursting: AtomicBool::new(false),
        }
    }

    /// Queues a packet, or drops it if the queue is full.
    ///
    /// Never blocks: called from the forwarding hot path, which is
    /// synchronous.
    fn push(&self, peer_id: &str, packet: RtpPacketData) {
        let is_video = packet.is_video;
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
                self.drops.record(DropSite::EgressQueue, is_video);
                if !self.bursting.swap(true, Ordering::Relaxed) {
                    let total = self.dropped();
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
        self.drops.total(DropSite::EgressQueue)
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
    ///
    /// `drops` are the peer's counters: the packets this sink's queue drops
    /// are counted there, as egress drops.
    pub fn new(
        peer_id: Arc<str>,
        conn: Arc<Mutex<PeerConnection>>,
        drops: Arc<PacketDrops>,
    ) -> Arc<Self> {
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
            queue: RtpQueue::new(tx, drops),
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
    /// rising value points at a peer whose output is falling behind. Also
    /// exported, split by media kind, on `/metrics` and in telemetry.
    pub fn dropped_packets(&self) -> u64 {
        self.queue.dropped()
    }
}

impl RtpSink for PeerSink {
    fn write_rtp(&self, packet: RtpPacketData) {
        self.queue.push(&self.peer_id, packet);
    }

    fn request_keyframe(&self, mid: Mid) {
        let conn = self.conn.clone();
        let peer_id = Arc::clone(&self.peer_id);

        tokio::spawn(async move {
            for delay in KEYFRAME_RETRY_DELAYS_MS {
                if delay > 0 {
                    tokio::time::sleep(Duration::from_millis(delay)).await;
                }
                conn.lock().await.request_keyframe(mid);
            }
            tracing::debug!("Peer {} — escalier de PLI terminé sur mid={}", peer_id, mid);
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Instant;
    use str0m::format::{Codec, CodecSpec, PayloadParams};
    use str0m::media::{Frequency, Pt};

    /// Minimal video packet, whose instances differ only by their payload.
    fn packet(payload: &[u8]) -> RtpPacketData {
        RtpPacketData {
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
            payload: Arc::from(payload),
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
        let queue = RtpQueue::new(tx, Arc::new(PacketDrops::new()));

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
        let queue = RtpQueue::new(tx, Arc::new(PacketDrops::new()));

        for _ in 0..4 {
            queue.push("alice", packet(b"frame"));
        }

        assert_eq!(
            queue.dropped(),
            0,
            "rien ne doit être jeté avant saturation"
        );
    }

    /// RTP is an ordered protocol: the queue must not reorder what is put into
    /// it, not even under saturation.
    #[tokio::test]
    async fn the_queue_preserves_the_order_of_the_packets_it_accepts() {
        let (tx, mut rx) = mpsc::channel::<RtpPacketData>(4);
        let queue = RtpQueue::new(tx, Arc::new(PacketDrops::new()));

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
            PeerConnection::new(
                Arc::from("alice"),
                sender,
                "127.0.0.1".to_string(),
                None,
                std::time::Duration::from_secs(1),
            )
            .await,
        ));
        let drops = Arc::new(PacketDrops::new());
        let sink = PeerSink::new(Arc::from("alice"), conn, Arc::clone(&drops));

        for _ in 0..RTP_QUEUE_CAPACITY + 7 {
            sink.write_rtp(packet(b"frame"));
        }

        assert_eq!(
            sink.dropped_packets(),
            7,
            "les paquets au-delà de la capacité doivent être comptés comme jetés"
        );
        // Le même compteur, vu de /metrics : sens sortant, type vidéo.
        let s = drops.snapshot();
        assert_eq!(s.egress_queue.video, 7);
        assert_eq!(s.egress_queue.audio, 0);
        assert_eq!(s.ingress_queue.audio + s.ingress_queue.video, 0);
    }

    /// Une file de sortie saturée se lit sur /metrics au compte du peer
    /// destinataire, dans le sens sortant — pas au compte de l'émetteur.
    #[tokio::test]
    async fn a_full_egress_queue_shows_on_metrics_for_the_receiver_as_egress() {
        let metrics = crate::metrics::Metrics::new();
        metrics.register_peer_drops(&Arc::from("alice"));
        let bob = metrics.register_peer_drops(&Arc::from("bob"));
        let (sender, _rx) = mpsc::channel(4);
        let conn = Arc::new(Mutex::new(
            PeerConnection::new(
                Arc::from("bob"),
                sender,
                "127.0.0.1".to_string(),
                None,
                std::time::Duration::from_secs(1),
            )
            .await,
        ));
        let sink = PeerSink::new(Arc::from("bob"), conn, bob);

        let mut audio = packet(b"opus");
        audio.is_video = false;
        for _ in 0..RTP_QUEUE_CAPACITY + 5 {
            sink.write_rtp(audio.clone());
        }

        let snap = metrics.snapshot().packet_drops;
        assert_eq!(snap.peers["bob"].egress_queue.audio, 5);
        assert_eq!(snap.peers["bob"].egress_queue.video, 0);
        assert_eq!(snap.peers["bob"].ingress_queue.audio, 0);
        assert_eq!(
            snap.peers["alice"],
            crate::metrics::DropCounts::default(),
            "l'émetteur n'y est pour rien"
        );
    }

    /// B1b ne porte que sur l'audio : un rejet audio doit être compté comme
    /// tel, et non noyé dans la vidéo.
    #[test]
    fn an_audio_drop_is_counted_as_audio() {
        let (tx, _rx) = mpsc::channel::<RtpPacketData>(1);
        let drops = Arc::new(PacketDrops::new());
        let queue = RtpQueue::new(tx, Arc::clone(&drops));

        let mut audio = packet(b"opus");
        audio.is_video = false;
        queue.push("alice", audio.clone());
        queue.push("alice", audio);

        let s = drops.snapshot();
        assert_eq!(s.egress_queue.audio, 1);
        assert_eq!(s.egress_queue.video, 0);
    }
}
