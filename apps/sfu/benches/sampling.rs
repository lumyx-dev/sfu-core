//! Measures what the telemetry instrumentation costs the media path.
//!
//! No harness, no dependency: `cargo bench` is enough.
//!
//! # What is actually on the hot path
//!
//! Sampling itself fires once per second per track — its cost is irrelevant by
//! construction. What runs **per packet** is only this:
//!
//! - `rx_clock_rate.entry(mid)` in the transport event loop, which learns the
//!   codec's clock rate from the first packet;
//! - `codec_seen.insert(mid)` in the session pump, which keeps the codec from
//!   being recorded again on every packet.
//!
//! Two hash lookups on a `Mid`. This benchmark measures them against the
//! per-packet forwarding cost reported by `benches/forwarding.rs`, because a
//! number without its baseline says nothing.
//!
//! # Scope
//!
//! The registries are measured in isolation, not through the channels that
//! carry packets between the two tasks. The figure is therefore the added
//! arithmetic, not an end-to-end delta — an honest lower bound, like the
//! forwarding benchmark it is compared against.

use lumyx_sfu::telemetry::sampler::{IngressReading, Sampler};
use std::collections::{HashMap, HashSet};
use std::hint::black_box;
use std::time::Instant;
use str0m::media::Mid;

/// Packets per benchmark run.
const PACKETS: usize = 200_000;

/// Per-packet forwarding cost measured by `benches/forwarding.rs`, in
/// nanoseconds. The comparison point, not a measurement of this file.
const FORWARDING_NS_PER_PACKET: f64 = 850.0;

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

/// The two per-packet registry operations, over `tracks` concurrent m-lines.
fn per_packet(tracks: usize) -> std::time::Duration {
    let mids: Vec<Mid> = (0..tracks).map(|i| Mid::from(&*i.to_string())).collect();
    let mut clock_rate: HashMap<Mid, u32> = HashMap::new();
    let mut codec_seen: HashSet<Mid> = HashSet::new();

    let start = Instant::now();
    for i in 0..PACKETS {
        let mid = mids[i % tracks];
        // `event_loop.rs` : apprendre le clock rate au premier paquet.
        clock_rate.entry(mid).or_insert(90_000);
        // `session.rs` : n'enregistrer le codec qu'une fois par track.
        black_box(codec_seen.insert(mid));
    }
    start.elapsed()
}

/// One sampling interval: the delta arithmetic for one track.
fn per_sample(samples: usize) -> std::time::Duration {
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

    println!("\nComparaison : {FORWARDING_NS_PER_PACKET:.0} ns/paquet pour le fanout (benches/forwarding.rs)\n");

    let samples = 100_000;
    let ns = per_sample(samples).as_nanos() as f64 / samples as f64;
    println!("Échantillonnage par track et par seconde : {ns:.1} ns");
    println!(
        "Soit, pour 100 tracks à 1 Hz : {:.1} µs/s de CPU, {:.4}% d'un cœur\n",
        ns * 100.0 / 1000.0,
        ns * 100.0 / 1000.0 / 10_000.0
    );
}
