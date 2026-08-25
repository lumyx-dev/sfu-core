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

    pub fn snapshot(&self) -> MetricsSnapshot {
        MetricsSnapshot {
            rtp_packets_forwarded: self.rtp_packets_forwarded.load(Ordering::Relaxed),
            bytes_forwarded: self.bytes_forwarded.load(Ordering::Relaxed),
            keyframe_requests: self.keyframe_requests.load(Ordering::Relaxed),
            peers_connected: self.peers_connected.load(Ordering::Relaxed),
            peers_disconnected: self.peers_disconnected.load(Ordering::Relaxed),
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
}
