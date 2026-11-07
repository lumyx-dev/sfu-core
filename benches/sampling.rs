//! Measures what the telemetry instrumentation costs the media path.
//!
//! No harness, no dependency: `cargo bench --bench sampling` is enough.
//!
//! # What is actually on the hot path
//!
//! Sampling itself fires once per second per track — its cost is irrelevant by
//! construction. What runs **per packet** is a single hash lookup on a `Mid`:
//! `codecs.entry(mid)` in the session's transport pump, which remembers the
//! publisher's `PayloadParams` so the codec can be recorded on the next stats
//! tick. The clock rate needs no per-packet work: it is derived from the media
//! kind when a stats event arrives.
//!
//! This benchmark measures that lookup against the per-packet forwarding cost
//! reported by `benches/forwarding.rs`, because a number without its baseline
//! says nothing.
//!
//! # Scope
//!
//! The registry is measured in isolation, not through the channels that carry
//! packets between tasks. The figure is the added arithmetic, not an
//! end-to-end delta — an honest lower bound, like the forwarding benchmark it
//! is compared against.

use lumyx_sfu::telemetry::sampler::{IngressReading, Sampler};
use std::collections::HashMap;
use std::hint::black_box;
use std::mem::size_of;
use std::time::{Duration, Instant};
use str0m::format::PayloadParams;
use str0m::media::Mid;

/// Packets per benchmark run.
const PACKETS: usize = 200_000;

/// Per-packet forwarding cost measured by `benches/forwarding.rs`, in
/// nanoseconds. The comparison point, not a measurement of this file.
const FORWARDING_NS_PER_PACKET: f64 = 850.0;

/// Stand-in for the session's `Codec` entry: same size as the real value, so
/// the map's memory traffic matches, without having to build a `PayloadParams`.
#[derive(Clone, Copy)]
struct Codec {
    _params: [u8; size_of::<PayloadParams>()],
    _recorded: bool,
}

fn reading(bytes: u64) -> IngressReading {
    IngressReading {
        bytes,
        packets: bytes / 1200,
        nacks: 0,
        plis: 0,
        firs: 0,
        jitter: 900,
        clock_rate: 90_000,
        loss: Some(0.01),
        rtt_ms: Some(42.0),
    }
}

/// The per-packet registry operation, over `tracks` concurrent m-lines.
fn per_packet(tracks: usize) -> Duration {
    let mids: Vec<Mid> = (0..tracks).map(|i| Mid::from(&*i.to_string())).collect();
    let mut codecs: HashMap<Mid, Codec> = HashMap::new();
    let codec = Codec {
        _params: [0; size_of::<PayloadParams>()],
        _recorded: false,
    };

    let start = Instant::now();
    for i in 0..PACKETS {
        let mid = mids[i % tracks];
        // `session.rs` : mémoriser le codec au premier paquet du mid.
        black_box(codecs.entry(black_box(mid)).or_insert(codec));
    }
    start.elapsed()
}

/// One sampling interval: the delta arithmetic for one track.
fn per_sample(samples: usize) -> Duration {
    let mut sampler = Sampler::new();
    let start = Instant::now();
    for i in 0..samples {
        black_box(sampler.ingress("0", &reading(1200 * i as u64)));
    }
    start.elapsed()
}

fn main() {
    println!("\nInstrumentation télémétrie — coût par paquet sur le chemin chaud\n");
    println!(" tracks    ns/paquet    % du forwarding");
    println!("------------------------------------------");

    for tracks in [1usize, 2, 4, 12] {
        let elapsed = per_packet(tracks);
        let ns = elapsed.as_nanos() as f64 / PACKETS as f64;
        println!(
            "{:>7}    {:>9.1}    {:>14.1}%",
            tracks,
            ns,
            ns / FORWARDING_NS_PER_PACKET * 100.0
        );
    }

    println!(
        "\nComparaison : {FORWARDING_NS_PER_PACKET:.0} ns/paquet pour le fanout (benches/forwarding.rs)\n"
    );

    let samples = 100_000;
    let ns = per_sample(samples).as_nanos() as f64 / samples as f64;
    println!("Échantillonnage par track et par seconde : {ns:.1} ns");
    println!(
        "Soit {:.1} µs/s pour 100 tracks — hors chemin chaud, une fois par seconde.\n",
        ns * 100.0 / 1000.0
    );
}
