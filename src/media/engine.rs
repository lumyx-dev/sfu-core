//! Forwarding engine: routes RTP packets between peers of the same room.

use super::down_track::DownTrack;
use super::packet::RtpPacketData;
use super::sink::RtpSink;
use super::up_track::UpTrack;
use dashmap::DashMap;
use std::sync::Arc;

/// The reachable peers of a room, indexed by peer_id.
///
/// The sink is stored here rather than in a global index: the fanout then
/// iterates over the members of that room alone, without scanning the whole
/// server.
type RoomSinks = DashMap<String, Arc<dyn RtpSink>>;

/// Routes a publisher's RTP packets to the other peers of its room.
///
/// The `room_id` is only a grouping key here: the engine knows nothing about
/// the `room/` module and handles nothing but `Arc<dyn RtpSink>` values.
pub struct ForwardingEngine {
    /// What each peer publishes, indexed by peer_id.
    up_tracks: DashMap<String, Arc<UpTrack>>,
    /// Where to write to reach the peers, grouped by room_id.
    rooms: DashMap<String, Arc<RoomSinks>>,
    /// peer_id → room_id index, to find a peer's room in O(1).
    peer_rooms: DashMap<String, String>,
}

impl ForwardingEngine {
    pub fn new() -> Arc<Self> {
        Arc::new(ForwardingEngine {
            up_tracks: DashMap::new(),
            rooms: DashMap::new(),
            peer_rooms: DashMap::new(),
        })
    }

    /// Declares a peer as reachable within a room.
    ///
    /// Called when the peer actually joins a room, not on connection: as long
    /// as it has joined nobody, it receives nothing and broadcasts nothing. A
    /// peer already registered elsewhere is first removed from its old room.
    pub fn add_peer(&self, room_id: String, peer_id: String, sink: Arc<dyn RtpSink>) {
        // The `Ref` is released before `remove_peer`, which writes to the same map.
        let previous = self.peer_rooms.get(&peer_id).map(|r| r.clone());
        if previous.is_some_and(|previous| previous != room_id) {
            self.remove_peer(&peer_id);
        }

        let room = self
            .rooms
            .entry(room_id.clone())
            .or_insert_with(|| Arc::new(RoomSinks::new()))
            .clone();

        room.insert(peer_id.clone(), sink);
        self.peer_rooms.insert(peer_id.clone(), room_id.clone());

        tracing::info!(
            "ForwardingEngine — peer {} enregistré dans la room {}",
            peer_id,
            room_id
        );
    }

    /// Removes a peer: its sink, the stream it was publishing, and the
    /// down_tracks the other publishers of its room held on it.
    ///
    /// That last point is what frees its writer task: every down_track keeps
    /// an `Arc` on its sink.
    pub fn remove_peer(&self, peer_id: &str) {
        // The leaver's down_tracks fall with its up_track.
        self.up_tracks.remove(peer_id);

        let Some((_, room_id)) = self.peer_rooms.remove(peer_id) else {
            return;
        };

        let Some(room) = self.rooms.get(&room_id).map(|r| Arc::clone(&*r)) else {
            return;
        };
        room.remove(peer_id);

        // Only the peers still in the room could have subscribed to it.
        for entry in room.iter() {
            if let Some(up_track) = self.up_tracks.get(entry.key()) {
                up_track.remove_subscriber(peer_id);
            }
        }

        if room.is_empty() {
            self.rooms.remove(&room_id);
        }

        tracing::info!(
            "ForwardingEngine — peer {} retiré de la room {}",
            peer_id,
            room_id
        );
    }

    /// Number of reachable peers, across all rooms.
    pub fn peer_count(&self) -> usize {
        self.peer_rooms.len()
    }

    /// Number of rooms holding at least one peer.
    pub fn room_count(&self) -> usize {
        self.rooms.len()
    }

    /// Stream published by a peer, if it has one.
    pub fn up_track(&self, peer_id: &str) -> Option<Arc<UpTrack>> {
        self.up_tracks.get(peer_id).map(|t| t.clone())
    }

    /// Receives a packet from a publisher and distributes it to the other
    /// peers of its room.
    ///
    /// A peer that has joined no room broadcasts to nobody: the packet is then
    /// dropped, without even creating an up_track.
    ///
    /// The publisher's stream and the subscriptions are created lazily, on the
    /// first packet: that is the only moment we know a peer is actually
    /// publishing. Every new subscription triggers a keyframe request on the
    /// source side, without which the subscriber would wait for the next
    /// spontaneous keyframe.
    pub fn forward_rtp(&self, from_peer_id: &str, packet: RtpPacketData) {
        // Resolved before any iteration: we clone the `Arc` and drop the `Ref`
        // — which holds a shard lock — right away.
        let Some(room_id) = self.peer_rooms.get(from_peer_id).map(|r| r.clone()) else {
            return;
        };
        let Some(room) = self.rooms.get(&room_id).map(|r| Arc::clone(&*r)) else {
            return;
        };

        // `entry` demands an owned key: calling it upfront would allocate a
        // `String` for every packet, including — and especially — when the
        // up_track already exists. A `get()` first reduces the steady state to
        // a plain lookup; the `Ref`, which holds a shard lock, is released at
        // the end of this line, before the write that touches the same map.
        let existing = self.up_tracks.get(from_peer_id).map(|t| t.clone());

        let up_track = match existing {
            Some(up_track) => up_track,
            None => self
                .up_tracks
                .entry(from_peer_id.to_string())
                .or_insert_with(|| {
                    let is_video = packet.payload_type >= 96;
                    Arc::new(UpTrack::new(
                        format!("{}-track", from_peer_id),
                        from_peer_id.to_string(),
                        is_video,
                    ))
                })
                .clone(),
        };

        // Same precaution: `room.get()` during `room.iter()` is a re-entrant
        // access to the DashMap, liable to deadlock if a writer is waiting on
        // the same shard.
        let source_sink = room.get(from_peer_id).map(|r| Arc::clone(&*r));

        // This loop does nothing but create the missing down_tracks.
        for entry in room.iter() {
            let subscriber_id = entry.key();
            if subscriber_id == from_peer_id {
                continue;
            }

            if up_track.get_down_track(subscriber_id).is_none() {
                let down_track = Arc::new(DownTrack::new(
                    subscriber_id.clone(),
                    format!("{}->{}", from_peer_id, subscriber_id),
                    entry.value().clone(),
                ));
                up_track.add_subscriber(subscriber_id.clone(), down_track);

                // One request per new subscription, not one per packet.
                if let Some(source) = &source_sink {
                    source.request_keyframe();
                }
            }
        }

        // A single broadcast per packet: `forward()` already writes to every
        // down_track. Calling it inside the loop would cost S² writes.
        up_track.forward(&packet);
    }
}
