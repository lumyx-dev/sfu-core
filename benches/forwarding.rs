//! Measures the cost of the forwarding hot path against the number of peers.
//!
//! No harness, no dependency: `cargo bench` is enough. The sinks are atomic
//! counters, so what is measured is the engine, not the network write.
//!
//! What the benchmark aims to show: how the work per published packet evolves
//! as the room grows, and what a single write costs.
//!
//! # Scope: the media layer alone, not end to end
//!
//! The benchmark stops at the [`RtpSink`]: it covers the engine's fanout, the
//! creation of the down_tracks, and the packet's rewrite and clone, but **not**
//! the downstream WebRTC write (`PeerConnection::write_rtp` →
//! `str0m::media::Writer::write`), nor the `PeerSink` queue, nor SRTP
//! encryption, nor the UDP send.
//!
//! These numbers must therefore not be read as a latency or an end-to-end cost:
//! they are a lower bound on the work per packet. A regression on the outbound
//! path — a payload copy reintroduced at write time, say — would be entirely
//! invisible here.

use lumyx_sfu::media::{ForwardingEngine, RtpPacketData, RtpSink, TrackKey};
use std::hint::black_box;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Instant;
use str0m::format::{Codec, CodecSpec, PayloadParams};
use str0m::media::{Frequency, Mid, Pt};

/// A sink that does nothing but count — the packet received is consumed and dropped.
#[derive(Default)]
struct CountingSink {
    writes: AtomicUsize,
}

impl RtpSink for CountingSink {
    fn write_rtp(&self, packet: RtpPacketData) {
        self.writes.fetch_add(1, Ordering::Relaxed);
        black_box(&packet);
    }
    fn request_keyframe(&self, _mid: Mid) {}
}

/// The m-line every peer publishes its video on, as every browser does.
const PUBLISH_MID: &str = "1";

/// Video packet of realistic size (~MTU).
fn packet() -> RtpPacketData {
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
        payload: Arc::from(vec![0u8; 1200]),
        mid: Mid::from(PUBLISH_MID),
        network_time: Instant::now(),
        rtp_time: 90_000,
        is_video: true,
    }
}

/// The benchmark's single room: every peer is in it, so everyone sees everyone.
const ROOM: &str = "bench";

/// Publishes `iterations` packets from one peer of a room of `peers` members.
/// Returns (total duration, writes performed).
fn run(peers: usize, iterations: usize) -> (std::time::Duration, usize) {
    let engine = ForwardingEngine::new();
    let ids: Vec<Arc<str>> = (0..peers)
        .map(|i| Arc::from(format!("peer-{i}").as_str()))
        .collect();

    let sinks: Vec<Arc<CountingSink>> = ids
        .iter()
        .map(|id| {
            let sink = Arc::new(CountingSink::default());
            engine.add_peer(ROOM.to_string(), Arc::clone(id), sink.clone());
            sink
        })
        .collect();

    // The subscriptions are set up outside the measurement, as the negotiator
    // does once each peer has answered: one m-line per subscriber. What is
    // measured is the steady state, not the ramp-up.
    let publisher = Arc::clone(&ids[0]);
    let source = TrackKey::new(Arc::clone(&publisher), Mid::from(PUBLISH_MID));
    engine.publish_track(source.clone(), true);
    for subscriber in ids.iter().skip(1) {
        engine.subscribe(&source, subscriber, Mid::from("2"));
    }

    let template = packet();
    let start = Instant::now();
    for _ in 0..iterations {
        engine.forward_rtp(&publisher, black_box(template.clone()));
    }
    let elapsed = start.elapsed();

    let writes: usize = sinks.iter().map(|s| s.writes.load(Ordering::Relaxed)).sum();

    (elapsed, writes)
}

fn main() {
    const ITERATIONS: usize = 20_000;

    println!("\nForwarding — {ITERATIONS} paquets publiés par un peer, payload 1200 o\n");
    println!(
        "{:>6} {:>11} {:>10} {:>10} {:>12} {:>13}",
        "peers", "écritures", "attendu", "surcoût", "µs/paquet", "ns/écriture"
    );
    println!("{}", "-".repeat(68));

    for peers in [2, 3, 5, 10, 20, 50] {
        let subscribers = peers - 1;
        let (elapsed, writes) = run(peers, ITERATIONS);

        let writes_per_packet = writes as f64 / ITERATIONS as f64;
        let expected = subscribers as f64;
        let us_per_packet = elapsed.as_secs_f64() * 1e6 / ITERATIONS as f64;

        println!(
            "{:>6} {:>11.0} {:>10.0} {:>9.0}x {:>12.2} {:>13.0}",
            peers,
            writes_per_packet,
            expected,
            writes_per_packet / expected,
            us_per_packet,
            us_per_packet * 1000.0 / writes_per_packet
        );
    }

    // Sustainable rate: a 1080p stream is ~150 packets/s per publisher.
    println!("\nCapacité estimée sur un cœur (150 paquets/s par publisher) :\n");
    println!("{:>6} {:>18} {:>16}", "peers", "µs/s de CPU", "charge cœur");
    println!("{}", "-".repeat(42));

    for peers in [5, 10, 20, 50] {
        let (elapsed, _) = run(peers, ITERATIONS);
        let us_per_packet = elapsed.as_secs_f64() * 1e6 / ITERATIONS as f64;
        // each peer publishes 150 packets/s
        let us_per_second = us_per_packet * 150.0 * peers as f64;
        println!(
            "{:>6} {:>18.0} {:>15.1}%",
            peers,
            us_per_second,
            us_per_second / 10_000.0
        );
    }
    println!();
}
