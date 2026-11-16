//! Media packets the SFU itself discards.
//!
//! Every place the SFU can lose a packet — by design or by failure — counts it
//! here, per peer, per point and per media kind. This is what lets the Phase 0
//! gate (`docs/phase-0-gate.md`, threshold B1b) tell a loss the network caused
//! from one the SFU added.
//!
//! Recording is a relaxed atomic increment: drops happen in bursts of hundreds
//! per second when a queue saturates, and counting them must not cost more
//! than the drop itself.

use serde::Serialize;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};

/// Where a packet was discarded.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DropPoint {
    /// Transport → forwarding engine queue full (`transport/event_loop.rs`).
    IngressQueue,
    /// Publisher's payload type absent from the codec config
    /// (`PeerConnection::to_packet`).
    UnknownPayloadType,
    /// A subscriber's `PeerSink` queue full (`transport/sink.rs`).
    EgressQueue,
    /// No payload type on the subscriber's m-line for this codec
    /// (`PeerConnection::write_rtp`).
    NoPayloadType,
    /// str0m refused the write (`PeerConnection::write_rtp`).
    WriteFailed,
}

impl DropPoint {
    const ALL: [DropPoint; 5] = [
        DropPoint::IngressQueue,
        DropPoint::UnknownPayloadType,
        DropPoint::EgressQueue,
        DropPoint::NoPayloadType,
        DropPoint::WriteFailed,
    ];

    fn index(self) -> usize {
        self as usize
    }

    /// Whether the packet was lost on its way in from its publisher, as
    /// opposed to on its way out to a subscriber.
    pub fn is_ingress(self) -> bool {
        matches!(
            self,
            DropPoint::IngressQueue | DropPoint::UnknownPayloadType
        )
    }
}

/// Audio or video. The gate's B1b threshold is about audio only, so every
/// counter is split by kind.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MediaType {
    Audio,
    Video,
}

impl MediaType {
    fn index(self) -> usize {
        self as usize
    }

    pub fn from_is_video(is_video: bool) -> Self {
        if is_video {
            MediaType::Video
        } else {
            MediaType::Audio
        }
    }
}

impl From<str0m::media::MediaKind> for MediaType {
    fn from(kind: str0m::media::MediaKind) -> Self {
        match kind {
            str0m::media::MediaKind::Audio => MediaType::Audio,
            str0m::media::MediaKind::Video => MediaType::Video,
        }
    }
}

/// Live drop counters of one peer's connection, shared by everything that can
/// drop one of its packets: its event loop, its `PeerConnection`, its sink.
#[derive(Debug, Default)]
pub struct DropCounters {
    counts: [[AtomicU64; 2]; 5],
}

impl DropCounters {
    pub fn new() -> Arc<Self> {
        Arc::new(Self::default())
    }

    /// Counts one dropped packet and returns the running total for that point
    /// and kind.
    pub fn record(&self, point: DropPoint, kind: MediaType) -> u64 {
        self.counts[point.index()][kind.index()].fetch_add(1, Ordering::Relaxed) + 1
    }

    /// Adds a whole set of counts at once — how per-peer drops are folded
    /// into the server-wide total.
    pub fn add(&self, delta: &DropCounts) {
        for (counters, values) in self.counts.iter().zip(&delta.counts) {
            for (counter, value) in counters.iter().zip(values) {
                if *value > 0 {
                    counter.fetch_add(*value, Ordering::Relaxed);
                }
            }
        }
    }

    pub fn snapshot(&self) -> DropCounts {
        let mut out = DropCounts::default();
        for (row, counters) in out.counts.iter_mut().zip(&self.counts) {
            for (value, counter) in row.iter_mut().zip(counters) {
                *value = counter.load(Ordering::Relaxed);
            }
        }
        out
    }
}

/// A plain copy of drop counters: cumulative totals, or the delta between two
/// of them.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct DropCounts {
    pub(crate) counts: [[u64; 2]; 5],
}

impl DropCounts {
    pub fn get(&self, point: DropPoint, kind: MediaType) -> u64 {
        self.counts[point.index()][kind.index()]
    }

    /// All packets lost on their way in, for this kind.
    pub fn ingress(&self, kind: MediaType) -> u64 {
        self.sum(kind, true)
    }

    /// All packets lost on their way out, for this kind.
    pub fn egress(&self, kind: MediaType) -> u64 {
        self.sum(kind, false)
    }

    pub fn total(&self) -> u64 {
        self.counts.iter().flatten().sum()
    }

    /// What was dropped since `earlier`, clamped at zero.
    pub fn since(&self, earlier: &DropCounts) -> DropCounts {
        let mut out = *self;
        for (row, before) in out.counts.iter_mut().zip(&earlier.counts) {
            for (value, b) in row.iter_mut().zip(before) {
                *value = value.saturating_sub(*b);
            }
        }
        out
    }

    pub fn add(&mut self, other: &DropCounts) {
        for (row, more) in self.counts.iter_mut().zip(&other.counts) {
            for (value, m) in row.iter_mut().zip(more) {
                *value = value.saturating_add(*m);
            }
        }
    }

    fn sum(&self, kind: MediaType, ingress: bool) -> u64 {
        DropPoint::ALL
            .iter()
            .filter(|p| p.is_ingress() == ingress)
            .map(|p| self.get(*p, kind))
            .sum()
    }
}

/// One drop point, split by kind — the shape it takes on `/metrics`.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize)]
pub struct ByKind {
    pub audio: u64,
    pub video: u64,
}

/// Every drop point, as `/metrics` reports it.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize)]
pub struct DropsSnapshot {
    pub ingress_queue: ByKind,
    pub unknown_payload_type: ByKind,
    pub egress_queue: ByKind,
    pub no_payload_type: ByKind,
    pub write_failed: ByKind,
}

impl From<&DropCounts> for DropsSnapshot {
    fn from(c: &DropCounts) -> Self {
        let by = |p| ByKind {
            audio: c.get(p, MediaType::Audio),
            video: c.get(p, MediaType::Video),
        };
        DropsSnapshot {
            ingress_queue: by(DropPoint::IngressQueue),
            unknown_payload_type: by(DropPoint::UnknownPayloadType),
            egress_queue: by(DropPoint::EgressQueue),
            no_payload_type: by(DropPoint::NoPayloadType),
            write_failed: by(DropPoint::WriteFailed),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn counters_start_at_zero() {
        let d = DropCounters::new();
        assert_eq!(d.snapshot(), DropCounts::default());
        assert_eq!(d.snapshot().total(), 0);
    }

    #[test]
    fn each_point_and_kind_is_counted_separately() {
        let d = DropCounters::new();
        d.record(DropPoint::IngressQueue, MediaType::Video);
        d.record(DropPoint::IngressQueue, MediaType::Video);
        d.record(DropPoint::EgressQueue, MediaType::Audio);

        let s = d.snapshot();
        assert_eq!(s.get(DropPoint::IngressQueue, MediaType::Video), 2);
        assert_eq!(s.get(DropPoint::IngressQueue, MediaType::Audio), 0);
        assert_eq!(s.get(DropPoint::EgressQueue, MediaType::Audio), 1);
        assert_eq!(s.total(), 3);
    }

    #[test]
    fn record_returns_the_running_total_of_its_point_and_kind() {
        // Sert au log de début de rafale, qui affiche le total courant.
        let d = DropCounters::new();
        assert_eq!(d.record(DropPoint::EgressQueue, MediaType::Video), 1);
        assert_eq!(d.record(DropPoint::EgressQueue, MediaType::Video), 2);
        assert_eq!(d.record(DropPoint::EgressQueue, MediaType::Audio), 1);
    }

    #[test]
    fn points_fold_into_their_direction() {
        // La télémétrie stocke le sens, pas le point : à l'entrée, la file et
        // le PT inconnu ; à la sortie, la file, l'absence de PT et l'écriture.
        let d = DropCounters::new();
        d.record(DropPoint::IngressQueue, MediaType::Audio);
        d.record(DropPoint::UnknownPayloadType, MediaType::Audio);
        d.record(DropPoint::EgressQueue, MediaType::Audio);
        d.record(DropPoint::NoPayloadType, MediaType::Audio);
        d.record(DropPoint::WriteFailed, MediaType::Video);

        let s = d.snapshot();
        assert_eq!(s.ingress(MediaType::Audio), 2);
        assert_eq!(s.egress(MediaType::Audio), 2);
        assert_eq!(s.egress(MediaType::Video), 1);
        assert_eq!(s.ingress(MediaType::Video), 0);
    }

    #[test]
    fn the_difference_of_two_snapshots_is_what_happened_in_between() {
        let d = DropCounters::new();
        d.record(DropPoint::EgressQueue, MediaType::Audio);
        let before = d.snapshot();
        d.record(DropPoint::EgressQueue, MediaType::Audio);
        d.record(DropPoint::WriteFailed, MediaType::Video);

        let delta = d.snapshot().since(&before);
        assert_eq!(delta.get(DropPoint::EgressQueue, MediaType::Audio), 1);
        assert_eq!(delta.get(DropPoint::WriteFailed, MediaType::Video), 1);
        assert_eq!(delta.total(), 2);
    }

    #[test]
    fn a_snapshot_older_than_its_baseline_yields_zero_rather_than_wrapping() {
        let mut later = DropCounts::default();
        later.counts[0][0] = 5;
        assert_eq!(DropCounts::default().since(&later).total(), 0);
    }

    #[test]
    fn adding_snapshots_accumulates_them() {
        let mut a = DropCounts::default();
        a.counts[2][1] = 3;
        let mut b = DropCounts::default();
        b.counts[2][1] = 4;
        a.add(&b);
        assert_eq!(a.get(DropPoint::EgressQueue, MediaType::Video), 7);
    }
}
