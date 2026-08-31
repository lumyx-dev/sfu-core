//! A published track, and the subscribers consuming it.

use super::down_track::DownTrack;
use super::packet::RtpPacketData;
use super::track::TrackKey;
use dashmap::DashMap;
use std::sync::Arc;

/// One track published by one peer, with the [`DownTrack`]s consuming it.
///
/// There is one of these per `(publisher, mid)` pair, not one per publisher: a
/// peer publishes audio and video at once, and each needs its own fanout and
/// its own outbound m-line on every subscriber.
pub struct UpTrack {
    pub key: TrackKey,
    pub is_video: bool,
    /// Subscribers, by peer_id. One down_track per subscriber and per source.
    down_tracks: DashMap<Arc<str>, Arc<DownTrack>>,
}

impl UpTrack {
    pub fn new(key: TrackKey, is_video: bool) -> Self {
        UpTrack {
            key,
            is_video,
            down_tracks: DashMap::new(),
        }
    }

    pub fn get_down_track(&self, peer_id: &str) -> Option<Arc<DownTrack>> {
        self.down_tracks.get(peer_id).map(|d| d.clone())
    }

    pub fn add_subscriber(&self, peer_id: Arc<str>, down_track: Arc<DownTrack>) {
        self.down_tracks.insert(peer_id, down_track);
    }

    pub fn remove_subscriber(&self, peer_id: &str) {
        self.down_tracks.remove(peer_id);
    }

    /// Broadcasts a packet to every subscriber, and reports how many writes it
    /// cost.
    ///
    /// The count is what the session layer turns into the `/metrics` counter:
    /// the media layer has no access to `Metrics`, so it reports rather than
    /// records.
    pub fn forward(&self, packet: &RtpPacketData) -> usize {
        let mut written = 0;
        for entry in self.down_tracks.iter() {
            entry.value().write_rtp(packet);
            written += 1;
        }
        written
    }

    pub fn subscriber_count(&self) -> usize {
        self.down_tracks.len()
    }
}
