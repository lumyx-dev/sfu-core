//! Packets the SFU itself dropped, per peer.
//!
//! The SFU drops a media packet in exactly three places, all by design:
//!
//! - **ingress queue** — the transport → forwarding engine queue of the
//!   publisher, full;
//! - **unknown payload type** — `PeerConnection::to_packet` finds no codec for
//!   the packet's PT;
//! - **egress queue** — the `PeerSink` write queue of the subscriber, full.
//!
//! The first two count against the peer that **sent** the packet, the third
//! against the peer that **should have received** it. Each is split by media
//! kind: the Phase 0 gate (B1b) is about audio only, and a video drop burst
//! must not hide — or fake — an audio loss.

use serde::Serialize;
use std::ops::Add;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};

/// Where a packet was dropped.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DropSite {
    /// The publisher's queue towards the forwarding engine was full.
    IngressQueue,
    /// The packet's payload type is absent from the codec config.
    UnknownPt,
    /// The subscriber's write queue was full.
    EgressQueue,
}

impl DropSite {
    fn index(self) -> usize {
        match self {
            DropSite::IngressQueue => 0,
            DropSite::UnknownPt => 1,
            DropSite::EgressQueue => 2,
        }
    }
}

/// One peer's drop counters, cumulative since the connection opened.
///
/// Shared — through an `Arc` — by the peer's event loop (ingress) and its
/// `PeerSink` (egress), and read by `/metrics` and the telemetry sampler.
/// Plain relaxed atomics: each counter is independent and only ever grows.
#[derive(Debug, Default)]
pub struct PacketDrops {
    /// `[site][0 = audio, 1 = video]`.
    counters: [[AtomicU64; 2]; 3],
    /// The server-wide totals, counted into on every drop.
    ///
    /// Counting at the source rather than folding a departing peer's
    /// counters in at disconnect: the event loop and the sink outlive the
    /// session by a few instants, and what they drop then — possibly for a
    /// *remaining* peer's egress queue, saturated by the departure — must
    /// still reach the totals. It also keeps the totals from ever going
    /// backwards under a concurrent `/metrics` read.
    totals: Option<Arc<PacketDrops>>,
}

impl PacketDrops {
    pub fn new() -> Self {
        Self::default()
    }

    /// A peer's counters that also count into the server `totals`.
    pub fn with_totals(totals: Arc<PacketDrops>) -> Self {
        PacketDrops {
            totals: Some(totals),
            ..Self::default()
        }
    }

    /// Counts one dropped packet.
    pub fn record(&self, site: DropSite, is_video: bool) {
        self.counters[site.index()][usize::from(is_video)].fetch_add(1, Ordering::Relaxed);
        if let Some(totals) = &self.totals {
            totals.record(site, is_video);
        }
    }

    /// Packets dropped at `site`, both kinds together.
    pub fn total(&self, site: DropSite) -> u64 {
        let [audio, video] = &self.counters[site.index()];
        audio.load(Ordering::Relaxed) + video.load(Ordering::Relaxed)
    }

    pub fn snapshot(&self) -> DropCounts {
        let read = |site: DropSite| {
            let [audio, video] = &self.counters[site.index()];
            KindCounts {
                audio: audio.load(Ordering::Relaxed),
                video: video.load(Ordering::Relaxed),
            }
        };
        DropCounts {
            ingress_queue: read(DropSite::IngressQueue),
            unknown_pt: read(DropSite::UnknownPt),
            egress_queue: read(DropSite::EgressQueue),
        }
    }
}

/// Audio and video counts of one drop site.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize)]
pub struct KindCounts {
    pub audio: u64,
    pub video: u64,
}

impl Add for KindCounts {
    type Output = KindCounts;

    fn add(self, other: KindCounts) -> KindCounts {
        KindCounts {
            audio: self.audio + other.audio,
            video: self.video + other.video,
        }
    }
}

impl KindCounts {
    /// `self - previous`, clamped at zero.
    fn since(self, previous: KindCounts) -> KindCounts {
        KindCounts {
            audio: self.audio.saturating_sub(previous.audio),
            video: self.video.saturating_sub(previous.video),
        }
    }
}

/// A reading of [`PacketDrops`].
///
/// `ingress_queue` and `unknown_pt` are the **ingress** direction (packets the
/// peer sent), `egress_queue` the **egress** one (packets meant for the peer).
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize)]
pub struct DropCounts {
    pub ingress_queue: KindCounts,
    pub unknown_pt: KindCounts,
    pub egress_queue: KindCounts,
}

impl Add for DropCounts {
    type Output = DropCounts;

    fn add(self, other: DropCounts) -> DropCounts {
        DropCounts {
            ingress_queue: self.ingress_queue + other.ingress_queue,
            unknown_pt: self.unknown_pt + other.unknown_pt,
            egress_queue: self.egress_queue + other.egress_queue,
        }
    }
}

impl DropCounts {
    /// What was dropped between `previous` and `self`, clamped at zero.
    pub fn since(self, previous: DropCounts) -> DropCounts {
        DropCounts {
            ingress_queue: self.ingress_queue.since(previous.ingress_queue),
            unknown_pt: self.unknown_pt.since(previous.unknown_pt),
            egress_queue: self.egress_queue.since(previous.egress_queue),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn each_site_and_kind_counts_separately() {
        let d = PacketDrops::new();
        d.record(DropSite::IngressQueue, false);
        d.record(DropSite::UnknownPt, true);
        d.record(DropSite::UnknownPt, true);
        d.record(DropSite::EgressQueue, false);

        let s = d.snapshot();
        assert_eq!(s.ingress_queue, KindCounts { audio: 1, video: 0 });
        assert_eq!(s.unknown_pt, KindCounts { audio: 0, video: 2 });
        assert_eq!(s.egress_queue, KindCounts { audio: 1, video: 0 });
        assert_eq!(d.total(DropSite::UnknownPt), 2);
    }

    #[test]
    fn a_drop_also_counts_into_the_totals() {
        let totals = Arc::new(PacketDrops::new());
        let a = PacketDrops::with_totals(Arc::clone(&totals));
        let b = PacketDrops::with_totals(Arc::clone(&totals));
        a.record(DropSite::EgressQueue, true);
        b.record(DropSite::EgressQueue, true);
        b.record(DropSite::IngressQueue, false);

        assert_eq!(a.snapshot().egress_queue.video, 1);
        let t = totals.snapshot();
        assert_eq!(t.egress_queue.video, 2);
        assert_eq!(t.ingress_queue.audio, 1);
    }

    #[test]
    fn since_is_the_difference_and_never_negative() {
        let before = DropCounts {
            egress_queue: KindCounts { audio: 5, video: 9 },
            ..Default::default()
        };
        let after = DropCounts {
            egress_queue: KindCounts { audio: 7, video: 3 },
            ..Default::default()
        };
        let d = after.since(before);
        assert_eq!(d.egress_queue, KindCounts { audio: 2, video: 0 });
    }
}
