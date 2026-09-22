//! Turning str0m's cumulative counters into per-second deltas.
//!
//! Pure and synchronous: no str0m type crosses this boundary, which is what
//! lets the arithmetic — the part most likely to be wrong — be tested without
//! a peer connection.

use std::collections::HashMap;

/// One reading of an inbound m-line, as str0m reports it.
#[derive(Debug, Clone)]
pub struct IngressReading {
    pub bytes: u64,
    pub packets: u64,
    pub nacks: u64,
    pub plis: u64,
    pub firs: u64,
    /// Interarrival jitter, in RTP clock units.
    pub jitter: u32,
    /// The codec's clock rate, needed to make sense of `jitter`.
    pub clock_rate: u32,
    pub loss: Option<f32>,
    pub rtt_ms: Option<f32>,
}

/// One reading of a peer's transport.
#[derive(Debug, Clone)]
pub struct PeerReading {
    pub bytes_rx: u64,
    pub bytes_tx: u64,
    pub transport_bytes_rx: u64,
    pub transport_bytes_tx: u64,
    pub egress_loss: Option<f32>,
    pub bwe_bps: Option<i64>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Deltas {
    pub bytes: i64,
    pub packets: i64,
    pub nacks: i32,
    pub plis: i32,
    pub firs: i32,
    pub jitter_ms: Option<f32>,
    pub loss: Option<f32>,
    pub rtt_ms: Option<f32>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PeerDeltas {
    pub bytes_rx: i64,
    pub bytes_tx: i64,
    pub transport_bytes_rx: i64,
    pub transport_bytes_tx: i64,
    pub egress_loss: Option<f32>,
    pub bwe_bps: Option<i64>,
}

/// Converts str0m's jitter into milliseconds.
///
/// str0m reports interarrival jitter in RTP clock units — 48 000 Hz for Opus,
/// 90 000 Hz for video. Getting this wrong is silent: the numbers stay
/// plausible while being off by nearly a factor of two.
pub fn jitter_to_ms(jitter_rtp_units: u32, clock_rate: u32) -> Option<f32> {
    if clock_rate == 0 {
        return None;
    }
    Some(jitter_rtp_units as f32 * 1000.0 / clock_rate as f32)
}

/// Subtracts `previous` from `current`, clamping at zero.
fn delta(current: u64, previous: u64) -> i64 {
    current.saturating_sub(previous) as i64
}

#[derive(Default)]
pub struct Sampler {
    ingress: HashMap<String, IngressReading>,
    peer: Option<PeerReading>,
}

impl Sampler {
    pub fn new() -> Self {
        Self::default()
    }

    /// Records a reading and returns the delta since the previous one.
    ///
    /// `None` on the very first reading: a cumulative total on its own says
    /// nothing, and emitting it would make the first sample equal the whole
    /// connection and wreck every chart's scale.
    pub fn ingress(&mut self, mid: &str, reading: &IngressReading) -> Option<Deltas> {
        let previous = self.ingress.insert(mid.to_string(), reading.clone())?;
        Some(Deltas {
            bytes: delta(reading.bytes, previous.bytes),
            packets: delta(reading.packets, previous.packets),
            nacks: delta(reading.nacks, previous.nacks) as i32,
            plis: delta(reading.plis, previous.plis) as i32,
            firs: delta(reading.firs, previous.firs) as i32,
            // Jitter, loss et RTT sont des états instantanés, pas des cumuls :
            // ils se lisent tels quels.
            jitter_ms: jitter_to_ms(reading.jitter, reading.clock_rate),
            loss: reading.loss,
            rtt_ms: reading.rtt_ms,
        })
    }

    pub fn peer(&mut self, reading: &PeerReading) -> Option<PeerDeltas> {
        let previous = self.peer.replace(reading.clone())?;
        Some(PeerDeltas {
            bytes_rx: delta(reading.bytes_rx, previous.bytes_rx),
            bytes_tx: delta(reading.bytes_tx, previous.bytes_tx),
            transport_bytes_rx: delta(reading.transport_bytes_rx, previous.transport_bytes_rx),
            transport_bytes_tx: delta(reading.transport_bytes_tx, previous.transport_bytes_tx),
            egress_loss: reading.egress_loss,
            bwe_bps: reading.bwe_bps,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn jitter_converts_from_rtp_units_to_milliseconds() {
        // 48 kHz : 480 unités = 10 ms. C'est la conversion audio.
        assert_eq!(jitter_to_ms(480, 48_000), Some(10.0));
        // 90 kHz : 900 unités = 10 ms. C'est la conversion vidéo.
        assert_eq!(jitter_to_ms(900, 90_000), Some(10.0));
    }

    #[test]
    fn a_zero_clock_rate_yields_nothing_rather_than_infinity() {
        // Un clock rate inconnu vaut 0 ; diviser produirait +inf, que Postgres
        // accepterait en `real` et qui polluerait tous les graphes.
        assert_eq!(jitter_to_ms(480, 0), None);
    }

    #[test]
    fn the_first_reading_produces_no_delta() {
        // Un cumul seul ne dit rien : il faut deux relevés pour une différence.
        // Sans cette règle, le premier échantillon vaudrait le total depuis le
        // début de la connexion et écraserait l'échelle de tous les graphes.
        let mut s = Sampler::new();
        assert!(s.ingress("0", &reading(1000, 10, 1, 2, 3)).is_none());
    }

    #[test]
    fn the_second_reading_is_the_difference() {
        let mut s = Sampler::new();
        s.ingress("0", &reading(1000, 10, 1, 2, 3));
        let d = s.ingress("0", &reading(1500, 15, 2, 2, 4)).expect("un delta");
        assert_eq!(d.bytes, 500);
        assert_eq!(d.packets, 5);
        assert_eq!(d.nacks, 1);
        assert_eq!(d.plis, 0);
        assert_eq!(d.firs, 1);
    }

    #[test]
    fn a_counter_going_backwards_yields_zero_rather_than_a_negative() {
        // str0m ne fait pas repartir ses compteurs en arrière, mais une
        // renégociation qui remplace un flux le pourrait. Un octet négatif
        // rendrait toute somme fausse ; zéro est faux d'un échantillon.
        let mut s = Sampler::new();
        s.ingress("0", &reading(1000, 10, 0, 0, 0));
        let d = s.ingress("0", &reading(500, 5, 0, 0, 0)).expect("un delta");
        assert_eq!(d.bytes, 0);
        assert_eq!(d.packets, 0);
    }

    #[test]
    fn two_mids_are_sampled_independently() {
        let mut s = Sampler::new();
        s.ingress("0", &reading(1000, 10, 0, 0, 0));
        s.ingress("1", &reading(5000, 50, 0, 0, 0));
        let d = s.ingress("0", &reading(1100, 11, 0, 0, 0)).expect("un delta");
        assert_eq!(d.bytes, 100, "le mid 1 ne doit pas contaminer le mid 0");
    }

    fn reading(bytes: u64, packets: u64, nacks: u64, plis: u64, firs: u64) -> IngressReading {
        IngressReading {
            bytes,
            packets,
            nacks,
            plis,
            firs,
            jitter: 0,
            clock_rate: 90_000,
            loss: None,
            rtt_ms: None,
        }
    }
}
