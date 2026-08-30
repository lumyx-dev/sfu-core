//! Forwarding engine: routes RTP packets between peers of the same room.

use super::down_track::DownTrack;
use super::packet::RtpPacketData;
use super::sink::RtpSink;
use super::track::TrackKey;
use super::up_track::UpTrack;
use dashmap::DashMap;
use std::sync::Arc;
use str0m::media::Mid;

/// The reachable peers of a room, indexed by peer_id.
///
/// The sink is stored here rather than in a global index: the fanout then
/// iterates over the members of that room alone, without scanning the whole
/// server.
type RoomSinks = DashMap<Arc<str>, Arc<dyn RtpSink>>;

/// Routes a publisher's RTP packets to the other peers of its room.
///
/// The `room_id` is only a grouping key here: the engine knows nothing about
/// the `room/` module and handles nothing but `Arc<dyn RtpSink>` values.
///
/// # What the engine does not do
///
/// It does not create subscriptions. Subscribing means allocating an m-line on
/// the subscriber's connection and renegotiating with it — an asynchronous
/// round trip that has no business on a synchronous per-packet path. The
/// engine is told about a subscription once it exists, through
/// [`Self::subscribe`], and the orchestration lives in
/// [`crate::signaling::Negotiator`].
#[derive(Default)]
pub struct ForwardingEngine {
    /// Published tracks, by `(publisher, publisher's mid)`.
    up_tracks: DashMap<TrackKey, Arc<UpTrack>>,
    /// Where to write to reach the peers, grouped by room_id.
    rooms: DashMap<String, Arc<RoomSinks>>,
    /// peer_id → room_id index, to find a peer's room in O(1).
    peer_rooms: DashMap<Arc<str>, String>,
}

impl ForwardingEngine {
    pub fn new() -> Arc<Self> {
        Arc::new(ForwardingEngine::default())
    }

    /// Declares a peer as reachable within a room.
    ///
    /// Called when the peer actually joins a room, not on connection: as long
    /// as it has joined nobody, it receives nothing and broadcasts nothing. A
    /// peer already registered elsewhere is first removed from its old room.
    pub fn add_peer(&self, room_id: String, peer_id: Arc<str>, sink: Arc<dyn RtpSink>) {
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

        room.insert(Arc::clone(&peer_id), sink);
        self.peer_rooms.insert(Arc::clone(&peer_id), room_id.clone());

        tracing::info!(
            "ForwardingEngine — peer {} enregistré dans la room {}",
            peer_id,
            room_id
        );
    }

    /// Removes a peer: its sink, the tracks it published, and the down_tracks
    /// the other publishers of its room held on it.
    ///
    /// That last point is what frees its writer task: every down_track keeps
    /// an `Arc` on its sink.
    pub fn remove_peer(&self, peer_id: &str) {
        // The leaver's down_tracks fall with its up_tracks.
        self.up_tracks
            .retain(|key, _| key.peer_id.as_ref() != peer_id);

        let Some((_, room_id)) = self.peer_rooms.remove(peer_id) else {
            return;
        };

        let Some(room) = self.rooms.get(&room_id).map(|r| Arc::clone(&*r)) else {
            return;
        };
        room.remove(peer_id);

        // Whatever is still published in the room could have been feeding it.
        for entry in self.up_tracks.iter() {
            entry.value().remove_subscriber(peer_id);
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

    /// Declares a track as published. Idempotent — the same mid announced
    /// twice yields the same [`UpTrack`].
    pub fn publish_track(&self, key: TrackKey, is_video: bool) -> Arc<UpTrack> {
        if let Some(existing) = self.up_tracks.get(&key) {
            return existing.clone();
        }

        self.up_tracks
            .entry(key.clone())
            .or_insert_with(|| Arc::new(UpTrack::new(key, is_video)))
            .clone()
    }

    /// Wires a published track to a subscriber, on the m-line that subscriber
    /// negotiated for it.
    ///
    /// Returns `false` — without wiring anything — when the track is unknown,
    /// when the subscriber has joined no room, or when the two are not in the
    /// same room. The first two are the ordinary race of a peer leaving while
    /// its answer was in flight; the last is the room boundary, enforced here
    /// rather than trusted from the caller: this is the only door into the
    /// routing table, and a stream crossing rooms is a leak, not a bug.
    pub fn subscribe(&self, key: &TrackKey, subscriber: &Arc<str>, target_mid: Mid) -> bool {
        let Some(up_track) = self.up_tracks.get(key).map(|t| t.clone()) else {
            return false;
        };

        let Some(room_id) = self.peer_rooms.get(subscriber).map(|r| r.clone()) else {
            return false;
        };

        let publisher_room = self.peer_rooms.get(&key.peer_id).map(|r| r.clone());
        if publisher_room.as_deref() != Some(room_id.as_str()) {
            tracing::warn!(
                "ForwardingEngine — abonnement refusé : {} et {} ne sont pas dans la même room",
                subscriber,
                key
            );
            return false;
        }

        let Some(sink) = self
            .rooms
            .get(&room_id)
            .and_then(|room| room.get(subscriber.as_ref()).map(|s| Arc::clone(&*s)))
        else {
            return false;
        };

        up_track.add_subscriber(
            Arc::clone(subscriber),
            Arc::new(DownTrack::new(Arc::clone(subscriber), target_mid, sink)),
        );

        tracing::info!(
            "ForwardingEngine — {} abonné à {} sur mid={}",
            subscriber,
            key,
            target_mid
        );
        true
    }

    /// Receives a packet from a publisher and distributes it to that track's
    /// subscribers. Returns the number of writes it cost.
    ///
    /// The up_track is created lazily if it is not known yet: a packet must
    /// never be lost because the `MediaAdded` announcement has not been
    /// processed. It arrives without subscribers, so this costs nothing and
    /// triggers nothing.
    ///
    /// `from_peer_id` is taken as `&Arc<str>` and not `&str`: the lookup key is
    /// built once per packet, and building it must be a refcount bump rather
    /// than an allocation.
    pub fn forward_rtp(&self, from_peer_id: &Arc<str>, packet: RtpPacketData) -> usize {
        // A peer that has joined no room broadcasts to nobody.
        if !self.peer_rooms.contains_key(from_peer_id.as_ref()) {
            return 0;
        }

        // `entry` demands an owned key: calling it upfront would allocate on
        // every packet, including — and especially — when the track already
        // exists. A `get()` first reduces the steady state to a plain lookup;
        // the `Ref`, which holds a shard lock, is released at the end of the
        // statement, before any write touching the same map.
        let key = TrackKey::new(Arc::clone(from_peer_id), packet.mid);
        let existing = self.up_tracks.get(&key).map(|t| t.clone());

        let up_track = match existing {
            Some(up_track) => up_track,
            None => self.publish_track(key, packet.is_video),
        };

        up_track.forward(&packet)
    }

    /// Tracks published inside a room, with their video flag.
    pub fn tracks_in_room(&self, room_id: &str) -> Vec<(TrackKey, bool)> {
        let Some(room) = self.rooms.get(room_id).map(|r| Arc::clone(&*r)) else {
            return Vec::new();
        };

        self.up_tracks
            .iter()
            .filter(|entry| room.contains_key(entry.key().peer_id.as_ref()))
            .map(|entry| (entry.key().clone(), entry.value().is_video))
            .collect()
    }

    /// Tracks published by one peer.
    pub fn tracks_of(&self, peer_id: &str) -> Vec<(TrackKey, bool)> {
        self.up_tracks
            .iter()
            .filter(|entry| entry.key().peer_id.as_ref() == peer_id)
            .map(|entry| (entry.key().clone(), entry.value().is_video))
            .collect()
    }

    /// Members of a room.
    pub fn peers_in_room(&self, room_id: &str) -> Vec<Arc<str>> {
        self.rooms
            .get(room_id)
            .map(|room| room.iter().map(|e| Arc::clone(e.key())).collect())
            .unwrap_or_default()
    }

    /// Room a peer belongs to, if it joined one.
    pub fn room_of(&self, peer_id: &str) -> Option<String> {
        self.peer_rooms.get(peer_id).map(|r| r.clone())
    }

    /// Sink of a peer that joined a room.
    pub fn sink_of(&self, peer_id: &str) -> Option<Arc<dyn RtpSink>> {
        let room_id = self.peer_rooms.get(peer_id).map(|r| r.clone())?;
        self.rooms
            .get(&room_id)?
            .get(peer_id)
            .map(|s| Arc::clone(&*s))
    }

    /// Number of reachable peers, across all rooms.
    pub fn peer_count(&self) -> usize {
        self.peer_rooms.len()
    }

    /// Number of rooms holding at least one peer.
    pub fn room_count(&self) -> usize {
        self.rooms.len()
    }

    /// A published track, if it exists.
    pub fn up_track(&self, key: &TrackKey) -> Option<Arc<UpTrack>> {
        self.up_tracks.get(key).map(|t| t.clone())
    }
}
