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

use dashmap::DashMap;
use std::sync::Arc;
use uuid::Uuid;

/// The façade the rest of the SFU talks to.
///
/// It owns the `(peer, mid) → track_id` registry, because samples arrive keyed
/// by mid while the database is keyed by a track uuid. The registry mirrors the
/// lifetime of the connection: entries are born when a track is published and
/// released when the peer leaves.
pub struct Telemetry {
    sink: Arc<dyn TelemetrySink>,
    tracks: DashMap<(Uuid, String), Uuid>,
}

impl Telemetry {
    pub fn new(sink: Arc<dyn TelemetrySink>) -> Arc<Self> {
        Arc::new(Telemetry {
            sink,
            tracks: DashMap::new(),
        })
    }

    pub fn record(&self, entry: Entry) {
        self.sink.record(entry);
    }

    /// The track uuid for `(peer, mid)`, minted on first use.
    pub fn track_id(&self, peer: Uuid, mid: &str) -> Uuid {
        *self
            .tracks
            .entry((peer, mid.to_string()))
            .or_insert_with(Uuid::new_v4)
    }

    /// Releases a peer's tracks and returns them, so the caller can close them.
    pub fn forget_peer(&self, peer: Uuid) -> Vec<Uuid> {
        let keys: Vec<(Uuid, String)> = self
            .tracks
            .iter()
            .filter(|e| e.key().0 == peer)
            .map(|e| e.key().clone())
            .collect();
        // On collecte les clés avant de retirer : itérer une DashMap en la
        // modifiant garde le verrou du shard, exactement le blocage documenté
        // dans CONTEXT.md pour le négociateur.
        keys.into_iter()
            .filter_map(|k| self.tracks.remove(&k).map(|(_, id)| id))
            .collect()
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
