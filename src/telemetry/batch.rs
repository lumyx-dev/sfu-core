//! Grouping a second of entries into one write.
//!
//! Pure and synchronous, which is the point: the shape of what gets written is
//! tested without a database, exactly as RTP routing is tested without a
//! socket.

use super::entry::{Entry, EventRecord, PeerSample, TrackKind, TrackSample};
use chrono::{DateTime, Utc};
use std::collections::HashSet;
use uuid::Uuid;

#[derive(Debug, Default)]
pub struct Batch {
    pub rooms_opened: Vec<(Uuid, String, DateTime<Utc>)>,
    pub rooms_closed: Vec<(Uuid, DateTime<Utc>, &'static str)>,
    pub peers_joined: Vec<(Uuid, Uuid, DateTime<Utc>)>,
    pub peers_left: Vec<(Uuid, DateTime<Utc>, Option<i32>)>,
    pub ice_states: Vec<(Uuid, String, DateTime<Utc>)>,
    pub tracks_published: Vec<(Uuid, Uuid, String, TrackKind, DateTime<Utc>)>,
    pub track_codecs: Vec<(Uuid, String, i32)>,
    pub tracks_ended: Vec<(Uuid, DateTime<Utc>)>,
    pub track_samples: Vec<TrackSample>,
    pub peer_samples: Vec<PeerSample>,
    pub events: Vec<EventRecord>,
}

impl Batch {
    pub fn from_entries(entries: Vec<Entry>) -> Self {
        let mut b = Batch::default();
        for entry in entries {
            match entry {
                Entry::RoomOpened { id, name, at } => b.rooms_opened.push((id, name, at)),
                Entry::RoomClosed { id, at, reason } => b.rooms_closed.push((id, at, reason)),
                Entry::PeerJoined { id, room_id, at } => b.peers_joined.push((id, room_id, at)),
                Entry::PeerLeft { id, at, close_code } => b.peers_left.push((id, at, close_code)),
                Entry::IceState { peer_id, state, at } => b.ice_states.push((peer_id, state, at)),
                Entry::TrackPublished { id, peer_id, mid, kind, at } => {
                    b.tracks_published.push((id, peer_id, mid, kind, at))
                }
                Entry::TrackCodec { id, codec, clock_rate } => {
                    b.track_codecs.push((id, codec, clock_rate))
                }
                Entry::TrackEnded { id, at } => b.tracks_ended.push((id, at)),
                Entry::TrackSample(s) => b.track_samples.push(s),
                Entry::PeerSample(s) => b.peer_samples.push(s),
                Entry::Event(e) => b.events.push(e),
            }
        }
        b
    }

    pub fn len(&self) -> usize {
        self.rooms_opened.len()
            + self.rooms_closed.len()
            + self.peers_joined.len()
            + self.peers_left.len()
            + self.ice_states.len()
            + self.tracks_published.len()
            + self.track_codecs.len()
            + self.tracks_ended.len()
            + self.track_samples.len()
            + self.peer_samples.len()
            + self.events.len()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// The rooms this batch touched, deduplicated — the `NOTIFY` payload.
    pub fn touched_rooms(&self) -> Vec<Uuid> {
        let mut seen: HashSet<Uuid> = HashSet::new();
        seen.extend(self.rooms_opened.iter().map(|(id, _, _)| *id));
        seen.extend(self.rooms_closed.iter().map(|(id, _, _)| *id));
        seen.extend(self.peers_joined.iter().map(|(_, room, _)| *room));
        seen.extend(self.events.iter().filter_map(|e| e.room_id));
        seen.into_iter().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::telemetry::entry::{EventKind, EventRecord, TrackSample};
    use chrono::Utc;
    use uuid::Uuid;

    #[test]
    fn an_empty_batch_is_empty() {
        let b = Batch::from_entries(vec![]);
        assert!(b.is_empty());
        assert_eq!(b.len(), 0);
    }

    #[test]
    fn each_entry_lands_in_its_own_bucket() {
        let room = Uuid::new_v4();
        let peer = Uuid::new_v4();
        let now = Utc::now();

        let b = Batch::from_entries(vec![
            Entry::RoomOpened { id: room, name: "test-room".into(), at: now },
            Entry::PeerJoined { id: peer, room_id: room, at: now },
            Entry::Event(EventRecord::new(EventKind::RoomCreated, now).room(room)),
        ]);

        assert_eq!(b.rooms_opened.len(), 1);
        assert_eq!(b.peers_joined.len(), 1);
        assert_eq!(b.events.len(), 1);
        assert_eq!(b.tracks_published.len(), 0);
        assert_eq!(b.len(), 3);
        assert!(!b.is_empty());
    }

    #[test]
    fn the_order_inside_a_bucket_is_preserved() {
        // L'ordre compte : deux échantillons du même track à la même seconde
        // violeraient la clé primaire, et c'est le dernier qui doit gagner.
        let track = Uuid::new_v4();
        let now = Utc::now();
        let b = Batch::from_entries(vec![
            Entry::TrackSample(sample(track, now, 10)),
            Entry::TrackSample(sample(track, now, 20)),
        ]);
        assert_eq!(b.track_samples.len(), 2);
        assert_eq!(b.track_samples[0].bytes, 10);
        assert_eq!(b.track_samples[1].bytes, 20);
    }

    #[test]
    fn touched_rooms_deduplicates() {
        // La charge utile du NOTIFY ne doit pas répéter une room parce que
        // trois peers y ont bougé dans la même seconde.
        let a = Uuid::new_v4();
        let b_room = Uuid::new_v4();
        let now = Utc::now();
        let batch = Batch::from_entries(vec![
            Entry::RoomOpened { id: a, name: "a".into(), at: now },
            Entry::PeerJoined { id: Uuid::new_v4(), room_id: a, at: now },
            Entry::PeerJoined { id: Uuid::new_v4(), room_id: b_room, at: now },
            Entry::RoomClosed { id: a, at: now, reason: "empty" },
        ]);

        let mut touched = batch.touched_rooms();
        touched.sort();
        let mut expected = vec![a, b_room];
        expected.sort();
        assert_eq!(touched, expected);
    }

    fn sample(track_id: Uuid, at: chrono::DateTime<Utc>, bytes: i64) -> TrackSample {
        TrackSample {
            track_id,
            at,
            bytes,
            packets: 1,
            nacks: 0,
            plis: 0,
            firs: 0,
            jitter_ms: None,
            loss: None,
            rtt_ms: None,
        }
    }
}
