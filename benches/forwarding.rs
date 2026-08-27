//! Mesure le coût du chemin chaud de forwarding en fonction du nombre de peers.
//!
//! Sans harness ni dépendance : `cargo bench` suffit. Les sinks sont des
//! compteurs atomiques, donc on mesure le moteur, pas l'écriture réseau.
//!
//! Ce que le banc cherche à montrer : comment le travail par paquet publié
//! évolue quand la room grandit, et ce que coûte une écriture.
//!
//! # Portée : couche média seule, pas du bout-en-bout
//!
//! Le banc s'arrête au [`RtpSink`] : il couvre le fanout du moteur, la création
//! des down_tracks, la réécriture et le clone du paquet, mais **pas** l'écriture
//! WebRTC en aval (`PeerConnection::write_rtp` → `str0m::media::Writer::write`),
//! ni la file du `PeerSink`, ni le chiffrement SRTP, ni l'envoi UDP.
//!
//! Ces chiffres ne se lisent donc pas comme une latence ou un coût de bout en
//! bout : ils bornent par le bas le travail par paquet. Une régression sur le
//! chemin de sortie — par exemple une copie du payload réintroduite à
//! l'écriture — resterait totalement invisible ici.

use sfu::media::{ForwardingEngine, RtpPacketData, RtpSink};
use str0m::media::Mid;
use std::hint::black_box;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Instant;

/// Sink qui ne fait que compter — le paquet reçu est consommé et jeté.
#[derive(Default)]
struct CountingSink {
    writes: AtomicUsize,
}

impl RtpSink for CountingSink {
    fn write_rtp(&self, packet: RtpPacketData) {
        self.writes.fetch_add(1, Ordering::Relaxed);
        black_box(&packet);
    }
    fn request_keyframe(&self) {}
}

/// Paquet vidéo de taille réaliste (~MTU).
fn packet() -> RtpPacketData {
    RtpPacketData {
        payload_type: 96,
        sequence_number: 0,
        timestamp: 1_000,
        ssrc: 0,
        payload: Arc::from(vec![0u8; 1200]),
        is_keyframe: false,
        mid: Mid::from("0"),
        network_time: Instant::now(),
        rtp_time: 90_000,
        is_video: true,
    }
}

/// Room unique du banc : tous les peers y sont, donc tous se voient.
const ROOM: &str = "bench";

/// Publie `iterations` paquets depuis un peer d'une room de `peers` membres.
/// Rend (durée totale, écritures effectuées).
fn run(peers: usize, iterations: usize) -> (std::time::Duration, usize) {
    let engine = ForwardingEngine::new();
    let sinks: Vec<Arc<CountingSink>> = (0..peers)
        .map(|i| {
            let sink = Arc::new(CountingSink::default());
            engine.add_peer(ROOM.to_string(), format!("peer-{i}"), sink.clone());
            sink
        })
        .collect();

    // Tour à blanc : crée les down_tracks hors mesure, pour mesurer le
    // régime établi et non la montée en charge.
    engine.forward_rtp("peer-0", packet());

    let template = packet();
    let start = Instant::now();
    for _ in 0..iterations {
        engine.forward_rtp("peer-0", black_box(template.clone()));
    }
    let elapsed = start.elapsed();

    let writes: usize = sinks
        .iter()
        .map(|s| s.writes.load(Ordering::Relaxed))
        .sum();

    (elapsed, writes)
}

fn main() {
    const ITERATIONS: usize = 20_000;

    println!(
        "\nForwarding — {ITERATIONS} paquets publiés par un peer, payload 1200 o\n"
    );
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

    // Débit soutenable : un flux 1080p ~ 150 paquets/s par publisher.
    println!("\nCapacité estimée sur un cœur (150 paquets/s par publisher) :\n");
    println!("{:>6} {:>18} {:>16}", "peers", "µs/s de CPU", "charge cœur");
    println!("{}", "-".repeat(42));

    for peers in [5, 10, 20, 50] {
        let (elapsed, _) = run(peers, ITERATIONS);
        let us_per_packet = elapsed.as_secs_f64() * 1e6 / ITERATIONS as f64;
        // chaque peer publie 150 paquets/s
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
