mod drops;

pub use drops::{DropCounts, DropSite, KindCounts, PacketDrops};

use dashmap::DashMap;
use serde::Serialize;
use std::collections::BTreeMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};

#[derive(Debug, Default)]
pub struct Metrics {
    pub rtp_packets_forwarded: AtomicU64,
    pub bytes_forwarded: AtomicU64,
    pub keyframe_requests: AtomicU64,
    pub peers_connected: AtomicU64,
    pub peers_disconnected: AtomicU64,
    pub telemetry_entries_dropped: AtomicU64,
    /// Drop counters of the peers currently connected.
    peer_drops: DashMap<Arc<str>, Arc<PacketDrops>>,
    /// Server totals since startup, departed peers included. Every peer's
    /// counters count into it as they drop (see [`PacketDrops::with_totals`]).
    drop_totals: Arc<PacketDrops>,
}

impl Metrics {
    pub fn new() -> Arc<Self> {
        Arc::new(Self::default())
    }

    pub fn record_rtp(&self, bytes: u64) {
        self.rtp_packets_forwarded.fetch_add(1, Ordering::Relaxed);
        self.bytes_forwarded.fetch_add(bytes, Ordering::Relaxed);
    }

    pub fn record_keyframe(&self) {
        self.keyframe_requests.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_connect(&self) {
        self.peers_connected.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_disconnect(&self) {
        self.peers_disconnected.fetch_add(1, Ordering::Relaxed);
    }

    /// An entry telemetry could not enqueue.
    ///
    /// Deliberate: a database must never be able to degrade a live call. Same
    /// doctrine as the media queues.
    pub fn record_telemetry_drop(&self) {
        self.telemetry_entries_dropped
            .fetch_add(1, Ordering::Relaxed);
    }

    /// Creates the drop counters of a new peer and lists them on `/metrics`.
    ///
    /// The returned `Arc` is what the peer's event loop and `PeerSink` count
    /// into.
    pub fn register_peer_drops(&self, peer_id: &Arc<str>) -> Arc<PacketDrops> {
        let drops = Arc::new(PacketDrops::with_totals(Arc::clone(&self.drop_totals)));
        self.peer_drops
            .insert(Arc::clone(peer_id), Arc::clone(&drops));
        drops
    }

    /// Removes a departing peer from the per-peer list of `/metrics`.
    ///
    /// Its drops stay in the server totals, and so do those its event loop
    /// and sink make after this call: they count into the totals directly.
    pub fn retire_peer_drops(&self, peer_id: &str) {
        self.peer_drops.remove(peer_id);
    }

    pub fn snapshot(&self) -> MetricsSnapshot {
        // `BTreeMap` : un ordre stable, pour que deux lectures de /metrics se
        // comparent à l'œil.
        let peers: BTreeMap<String, DropCounts> = self
            .peer_drops
            .iter()
            .map(|e| (e.key().to_string(), e.value().snapshot()))
            .collect();
        let totals = self.drop_totals.snapshot();

        MetricsSnapshot {
            rtp_packets_forwarded: self.rtp_packets_forwarded.load(Ordering::Relaxed),
            bytes_forwarded: self.bytes_forwarded.load(Ordering::Relaxed),
            keyframe_requests: self.keyframe_requests.load(Ordering::Relaxed),
            peers_connected: self.peers_connected.load(Ordering::Relaxed),
            peers_disconnected: self.peers_disconnected.load(Ordering::Relaxed),
            telemetry_entries_dropped: self.telemetry_entries_dropped.load(Ordering::Relaxed),
            packet_drops: PacketDropsSnapshot { totals, peers },
        }
    }
}

#[derive(Debug, Serialize)]
pub struct MetricsSnapshot {
    pub rtp_packets_forwarded: u64,
    pub bytes_forwarded: u64,
    pub keyframe_requests: u64,
    pub peers_connected: u64,
    pub peers_disconnected: u64,
    pub telemetry_entries_dropped: u64,
    pub packet_drops: PacketDropsSnapshot,
}

/// The packets the SFU dropped: server totals since startup, and the detail
/// of every connected peer.
#[derive(Debug, Serialize)]
pub struct PacketDropsSnapshot {
    pub totals: DropCounts,
    pub peers: BTreeMap<String, DropCounts>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn counters_start_at_zero() {
        let snap = Metrics::new().snapshot();
        assert_eq!(snap.rtp_packets_forwarded, 0);
        assert_eq!(snap.bytes_forwarded, 0);
        assert_eq!(snap.keyframe_requests, 0);
        assert_eq!(snap.peers_connected, 0);
        assert_eq!(snap.peers_disconnected, 0);
    }

    #[test]
    fn rtp_accumulates_packets_and_bytes() {
        let m = Metrics::new();
        m.record_rtp(100);
        m.record_rtp(250);

        let snap = m.snapshot();
        assert_eq!(snap.rtp_packets_forwarded, 2);
        assert_eq!(snap.bytes_forwarded, 350);
    }

    #[test]
    fn connect_and_disconnect_are_tracked_separately() {
        let m = Metrics::new();
        m.record_connect();
        m.record_connect();
        m.record_disconnect();
        m.record_keyframe();

        let snap = m.snapshot();
        assert_eq!(snap.peers_connected, 2);
        assert_eq!(snap.peers_disconnected, 1);
        assert_eq!(snap.keyframe_requests, 1);
    }

    #[test]
    fn snapshot_does_not_reset_the_counters() {
        let m = Metrics::new();
        m.record_connect();
        m.snapshot();
        assert_eq!(m.snapshot().peers_connected, 1);
    }

    #[test]
    fn telemetry_drops_are_counted_separately() {
        let m = Metrics::new();
        m.record_telemetry_drop();
        m.record_telemetry_drop();
        let snap = m.snapshot();
        assert_eq!(snap.telemetry_entries_dropped, 2);
        // Les compteurs média ne doivent pas bouger : /metrics doit rester lisible.
        assert_eq!(snap.rtp_packets_forwarded, 0);
    }

    #[test]
    fn drops_are_listed_per_peer() {
        let m = Metrics::new();
        let alice = m.register_peer_drops(&Arc::from("alice"));
        let bob = m.register_peer_drops(&Arc::from("bob"));
        alice.record(DropSite::EgressQueue, false);
        bob.record(DropSite::IngressQueue, true);

        let snap = m.snapshot().packet_drops;
        assert_eq!(snap.peers["alice"].egress_queue.audio, 1);
        assert_eq!(snap.peers["alice"].ingress_queue.video, 0);
        assert_eq!(snap.peers["bob"].ingress_queue.video, 1);
        assert_eq!(snap.totals.egress_queue.audio, 1);
        assert_eq!(snap.totals.ingress_queue.video, 1);
    }

    #[test]
    fn a_departing_peer_leaves_the_list_but_not_the_totals() {
        let m = Metrics::new();
        let alice = m.register_peer_drops(&Arc::from("alice"));
        alice.record(DropSite::UnknownPt, false);
        alice.record(DropSite::UnknownPt, false);

        m.retire_peer_drops("alice");

        let snap = m.snapshot().packet_drops;
        assert!(!snap.peers.contains_key("alice"));
        assert_eq!(snap.totals.unknown_pt.audio, 2);
    }

    #[test]
    fn a_drop_after_the_departure_still_reaches_the_totals() {
        // L'event loop et le sink survivent un instant à la session : ce
        // qu'ils jettent après `retire_peer_drops` doit rester compté.
        let m = Metrics::new();
        let alice = m.register_peer_drops(&Arc::from("alice"));
        alice.record(DropSite::EgressQueue, false);

        m.retire_peer_drops("alice");
        alice.record(DropSite::EgressQueue, false);

        assert_eq!(m.snapshot().packet_drops.totals.egress_queue.audio, 2);
    }

    #[test]
    fn no_drop_means_every_counter_at_zero() {
        let m = Metrics::new();
        m.register_peer_drops(&Arc::from("alice"));
        let snap = m.snapshot().packet_drops;
        assert_eq!(snap.totals, DropCounts::default());
        assert_eq!(snap.peers["alice"], DropCounts::default());
    }
}
