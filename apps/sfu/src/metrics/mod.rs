use serde::Serialize;
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
        self.telemetry_entries_dropped.fetch_add(1, Ordering::Relaxed);
    }

    pub fn snapshot(&self) -> MetricsSnapshot {
        MetricsSnapshot {
            rtp_packets_forwarded: self.rtp_packets_forwarded.load(Ordering::Relaxed),
            bytes_forwarded: self.bytes_forwarded.load(Ordering::Relaxed),
            keyframe_requests: self.keyframe_requests.load(Ordering::Relaxed),
            peers_connected: self.peers_connected.load(Ordering::Relaxed),
            peers_disconnected: self.peers_disconnected.load(Ordering::Relaxed),
            telemetry_entries_dropped: self.telemetry_entries_dropped.load(Ordering::Relaxed),
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
}
