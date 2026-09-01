//! Optional telemetry persistence.
//!
//! Off unless `SFU_DATABASE_URL` is set. The write path never touches the
//! media hot path: producers enqueue through [`TelemetrySink`], and a
//! background task batches one second of entries into a single transaction.

pub mod batch;
pub mod entry;
pub mod pg;
pub mod sink;
pub mod tasks;

pub use batch::Batch;
pub use entry::{Entry, EventKind, EventRecord, PeerSample, Severity, TrackKind, TrackSample};
pub use pg::PgWriter;
pub use sink::{MemorySink, NoopSink, QueueSink, TelemetrySink};

use chrono::{DateTime, Utc};
use dashmap::DashMap;
use std::sync::Arc;
use uuid::Uuid;

/// The façade the rest of the SFU talks to.
///
/// It owns the `(occupancy, mid) → track_id` registry, because samples arrive
/// keyed by mid while the database is keyed by a track uuid. The registry
/// mirrors the lifetime of an occupancy, not of the connection: a track
/// published in one room and one published in another by the same connection
/// are two different tracks (Task 6 review, finding 3), so entries are born
/// when a track is published and released when that occupancy ends.
///
/// It also owns the `connection → current occupancy` mirror. `RoomManager`
/// mints the occupancy uuid and hands it to `dispatch.rs` in `JoinOutcome`,
/// but `spawn_transport_pump` only ever sees the connection uuid on a
/// `TrackAdded` event and has no `RoomManager` to ask (deliberately: threading
/// it in would give the hot transport-event loop a second registry to lock).
/// The mirror is that lookup.
pub struct Telemetry {
    sink: Arc<dyn TelemetrySink>,
    tracks: DashMap<(Uuid, String), Uuid>,
    occupancy: DashMap<Uuid, Uuid>,
}

impl Telemetry {
    pub fn new(sink: Arc<dyn TelemetrySink>) -> Arc<Self> {
        Arc::new(Telemetry {
            sink,
            tracks: DashMap::new(),
            occupancy: DashMap::new(),
        })
    }

    pub fn record(&self, entry: Entry) {
        self.sink.record(entry);
    }

    /// The track uuid for `(occupancy, mid)`, minted on first use.
    pub fn track_id(&self, occupancy: Uuid, mid: &str) -> Uuid {
        *self
            .tracks
            .entry((occupancy, mid.to_string()))
            .or_insert_with(Uuid::new_v4)
    }

    /// Releases an occupancy's tracks and returns them, so the caller can
    /// close them.
    pub fn forget_peer(&self, occupancy: Uuid) -> Vec<Uuid> {
        let keys: Vec<(Uuid, String)> = self
            .tracks
            .iter()
            .filter(|e| e.key().0 == occupancy)
            .map(|e| e.key().clone())
            .collect();
        // On collecte les clés avant de retirer : itérer une DashMap en la
        // modifiant garde le verrou du shard, exactement le blocage documenté
        // dans CONTEXT.md pour le négociateur.
        keys.into_iter()
            .filter_map(|k| self.tracks.remove(&k).map(|(_, id)| id))
            .collect()
    }

    /// Records that `connection` currently occupies `occupancy`. Called on
    /// every join — a room switch simply overwrites the previous value.
    pub fn set_occupancy(&self, connection: Uuid, occupancy: Uuid) {
        self.occupancy.insert(connection, occupancy);
    }

    /// The occupancy currently mirrored for a connection, if any.
    pub fn occupancy_of(&self, connection: Uuid) -> Option<Uuid> {
        self.occupancy.get(&connection).map(|entry| *entry)
    }

    /// Clears the mirror for a connection that just left its room. Without
    /// this, a stale entry would attribute a later `TrackAdded` to an
    /// occupancy that has already been closed.
    pub fn clear_occupancy(&self, connection: Uuid) -> Option<Uuid> {
        self.occupancy.remove(&connection).map(|(_, o)| o)
    }

    /// Records the end of an occupancy: its tracks, the peer row, and the
    /// room it was in if this departure emptied it.
    ///
    /// Centralised so the three places a peer leaves a room — an explicit
    /// `leave`, a room switch, and the WebSocket teardown — cannot drift out
    /// of sync with one another (Task 6 review, finding 2): a swapped id or a
    /// reordering here would be caught once, for all three.
    pub fn record_departure(
        &self,
        peer_session: Uuid,
        room_session: Uuid,
        room_dropped: bool,
        at: DateTime<Utc>,
    ) {
        for track in self.forget_peer(peer_session) {
            self.record(Entry::TrackEnded { id: track, at });
        }
        self.record(Entry::PeerLeft {
            id: peer_session,
            at,
            // Axum ne remonte pas le code de fermeture jusqu'ici : la boucle
            // `while let Some(Ok(msg))` de `session.rs` avale `Message::Close`.
            // Le récupérer demanderait de restructurer la boucle ; c'est hors
            // périmètre et la colonne reste nullable pour cette raison. Une
            // room quittée explicitement ou par changement de room n'a de
            // toute façon jamais eu de code de fermeture à rapporter.
            close_code: None,
        });
        self.record(Entry::Event(
            EventRecord::new(EventKind::PeerLeft, at)
                .room(room_session)
                .peer(peer_session),
        ));
        if room_dropped {
            self.record(Entry::RoomClosed {
                id: room_session,
                at,
                reason: "empty",
            });
            self.record(Entry::Event(
                EventRecord::new(EventKind::RoomEnded, at).room(room_session),
            ));
        }
    }
}

/// Parses a peer_id into the uuid the schema uses.
///
/// Peer ids are minted by `http/ws.rs` with `Uuid::new_v4`, so this never
/// fails in practice; returning `Option` keeps telemetry from being able to
/// panic a session.
pub fn peer_uuid(peer_id: &str) -> Option<Uuid> {
    Uuid::parse_str(peer_id).ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use uuid::Uuid;

    #[test]
    fn a_connection_s_occupancy_round_trips() {
        let t = Telemetry::new(Arc::new(NoopSink));
        let connection = Uuid::new_v4();
        let occupancy = Uuid::new_v4();

        assert!(t.occupancy_of(connection).is_none());
        t.set_occupancy(connection, occupancy);
        assert_eq!(t.occupancy_of(connection), Some(occupancy));
    }

    #[test]
    fn switching_rooms_overwrites_the_mirrored_occupancy() {
        let t = Telemetry::new(Arc::new(NoopSink));
        let connection = Uuid::new_v4();
        let first = Uuid::new_v4();
        let second = Uuid::new_v4();

        t.set_occupancy(connection, first);
        t.set_occupancy(connection, second);
        assert_eq!(t.occupancy_of(connection), Some(second));
    }

    #[test]
    fn clearing_the_occupancy_removes_it() {
        let t = Telemetry::new(Arc::new(NoopSink));
        let connection = Uuid::new_v4();
        let occupancy = Uuid::new_v4();
        t.set_occupancy(connection, occupancy);

        assert_eq!(t.clear_occupancy(connection), Some(occupancy));
        assert!(t.occupancy_of(connection).is_none());
        assert!(t.clear_occupancy(connection).is_none());
    }

    #[test]
    fn record_departure_closes_tracks_before_the_peer_and_skips_the_room_when_it_survives() {
        // L'ordre compte : `TrackEnded` doit précéder `PeerLeft`, jamais
        // l'inverse (Task 6 review, finding 2 — c'était déjà correct, ce test
        // le verrouille).
        let sink = Arc::new(MemorySink::new());
        let t = Telemetry::new(sink.clone());
        let occupancy = Uuid::new_v4();
        let room = Uuid::new_v4();
        let now = Utc::now();

        t.track_id(occupancy, "0");
        t.track_id(occupancy, "1");

        t.record_departure(occupancy, room, false, now);

        let entries = sink.drain();
        assert_eq!(entries.len(), 4, "2 tracks + PeerLeft + son Event, pas de RoomClosed");
        assert!(matches!(entries[0], Entry::TrackEnded { .. }));
        assert!(matches!(entries[1], Entry::TrackEnded { .. }));
        match &entries[2] {
            Entry::PeerLeft { id, close_code, .. } => {
                assert_eq!(*id, occupancy);
                assert!(close_code.is_none());
            }
            other => panic!("attendu PeerLeft en 3e position, reçu {other:?}"),
        }
        match &entries[3] {
            Entry::Event(e) => {
                assert_eq!(e.kind, EventKind::PeerLeft);
                assert_eq!(e.room_id, Some(room));
                assert_eq!(e.peer_id, Some(occupancy));
            }
            other => panic!("attendu Event(PeerLeft) en 4e position, reçu {other:?}"),
        }
    }

    #[test]
    fn record_departure_closes_the_room_when_it_drops() {
        let sink = Arc::new(MemorySink::new());
        let t = Telemetry::new(sink.clone());
        let occupancy = Uuid::new_v4();
        let room = Uuid::new_v4();
        let now = Utc::now();

        t.record_departure(occupancy, room, true, now);

        let entries = sink.drain();
        assert_eq!(entries.len(), 4, "PeerLeft + son Event + RoomClosed + son Event");
        assert!(matches!(entries[0], Entry::PeerLeft { .. }));
        assert!(matches!(&entries[1], Entry::Event(e) if e.kind == EventKind::PeerLeft));
        match &entries[2] {
            Entry::RoomClosed { id, reason, .. } => {
                assert_eq!(*id, room);
                assert_eq!(*reason, "empty");
            }
            other => panic!("attendu RoomClosed en 3e position, reçu {other:?}"),
        }
        assert!(matches!(&entries[3], Entry::Event(e) if e.kind == EventKind::RoomEnded));
    }

    #[test]
    fn the_same_mid_of_a_peer_keeps_its_track_id() {
        let t = Telemetry::new(Arc::new(NoopSink));
        let peer = Uuid::new_v4();
        assert_eq!(t.track_id(peer, "0"), t.track_id(peer, "0"));
    }

    #[test]
    fn two_mids_of_a_peer_are_two_tracks() {
        let t = Telemetry::new(Arc::new(NoopSink));
        let peer = Uuid::new_v4();
        assert_ne!(t.track_id(peer, "0"), t.track_id(peer, "1"));
    }

    #[test]
    fn the_same_mid_of_two_peers_are_two_tracks() {
        let t = Telemetry::new(Arc::new(NoopSink));
        assert_ne!(t.track_id(Uuid::new_v4(), "0"), t.track_id(Uuid::new_v4(), "0"));
    }

    #[test]
    fn forgetting_a_peer_returns_its_tracks_and_frees_them() {
        let t = Telemetry::new(Arc::new(NoopSink));
        let peer = Uuid::new_v4();
        let audio = t.track_id(peer, "0");
        let video = t.track_id(peer, "1");

        let mut forgotten = t.forget_peer(peer);
        forgotten.sort();
        let mut expected = vec![audio, video];
        expected.sort();
        assert_eq!(forgotten, expected);

        // Le registre est vidé : un peer reconnecté sous le même uuid — ce qui
        // n'arrive pas, mais le registre ne doit pas fuir — repart à neuf.
        assert!(t.forget_peer(peer).is_empty());
        assert_ne!(t.track_id(peer, "0"), audio);
    }
}
