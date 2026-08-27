//! Flux entrant d'un publisher, et ses subscribers.

use super::down_track::DownTrack;
use super::packet::RtpPacketData;
use dashmap::DashMap;
use std::sync::Arc;

/// Le flux publié par un peer, avec la liste des [`DownTrack`] qui le consomment.
pub struct UpTrack {
    pub track_id: String,
    pub peer_id: String,
    pub is_video: bool,
    down_tracks: DashMap<String, Arc<DownTrack>>,
}

impl UpTrack {
    pub fn new(track_id: String, peer_id: String, is_video: bool) -> Self {
        UpTrack {
            track_id,
            peer_id,
            is_video,
            down_tracks: DashMap::new(),
        }
    }

    pub fn get_down_track(&self, peer_id: &str) -> Option<Arc<DownTrack>> {
        self.down_tracks.get(peer_id).map(|d| d.clone())
    }

    pub fn add_subscriber(&self, peer_id: String, down_track: Arc<DownTrack>) {
        self.down_tracks.insert(peer_id, down_track);
    }

    pub fn remove_subscriber(&self, peer_id: &str) {
        self.down_tracks.remove(peer_id);
    }

    /// Diffuse un paquet à tous les subscribers.
    pub fn forward(&self, packet: &RtpPacketData) {
        for entry in self.down_tracks.iter() {
            entry.value().write_rtp(packet);
        }
    }

    pub fn subscriber_count(&self) -> usize {
        self.down_tracks.len()
    }
}
