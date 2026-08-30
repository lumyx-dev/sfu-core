//! Where telemetry entries go.
//!
//! The trait is **synchronous and never does I/O**, deliberately mirroring
//! `RtpSink`: producers call it from the middle of a lock or a hot loop, so it
//! may only enqueue. All database work happens in the writer task.
//!
//! `NoopSink` is what runs when persistence is off. Having it means no
//! `if let Some(db)` scattered across the codebase: there is always a sink.

use super::entry::Entry;
use crate::metrics::Metrics;
use std::sync::Arc;
use std::sync::Mutex;
use tokio::sync::mpsc;

pub trait TelemetrySink: Send + Sync {
    /// Records an entry. Must never block and never fail.
    fn record(&self, entry: Entry);
}

/// Persistence disabled.
pub struct NoopSink;

impl TelemetrySink for NoopSink {
    fn record(&self, _entry: Entry) {}
}

/// Collects entries in memory, for tests.
#[derive(Default)]
pub struct MemorySink {
    entries: Mutex<Vec<Entry>>,
}

impl MemorySink {
    pub fn new() -> Self {
        Self::default()
    }

    /// Takes everything recorded so far, leaving the sink empty.
    pub fn drain(&self) -> Vec<Entry> {
        std::mem::take(&mut *self.entries.lock().expect("MemorySink non empoisonné"))
    }
}

impl TelemetrySink for MemorySink {
    fn record(&self, entry: Entry) {
        self.entries
            .lock()
            .expect("MemorySink non empoisonné")
            .push(entry);
    }
}

/// Enqueues towards the writer task, dropping when the queue is full.
///
/// `try_send`, never `send().await`: producers call this from synchronous
/// code and sometimes while holding a lock. Full means the entry is dropped,
/// deliberately — the same trade-off the media queues already make, for a
/// stronger reason: a database must never be able to degrade a live call.
pub struct QueueSink {
    tx: mpsc::Sender<Entry>,
    metrics: Arc<Metrics>,
}

impl QueueSink {
    /// Returns the sink and the receiving end the writer task consumes.
    pub fn new(depth: usize, metrics: Arc<Metrics>) -> (Arc<Self>, mpsc::Receiver<Entry>) {
        let (tx, rx) = mpsc::channel(depth);
        (Arc::new(QueueSink { tx, metrics }), rx)
    }
}

impl TelemetrySink for QueueSink {
    fn record(&self, entry: Entry) {
        if self.tx.try_send(entry).is_err() {
            // Une seule métrique, pas de log par entrée : sous rafale, logger
            // chaque perte coûterait plus cher que l'écriture qu'on évite.
            // La tâche d'écriture log une fois par rafale.
            self.metrics.record_telemetry_drop();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::telemetry::entry::{Entry, TrackKind};
    use chrono::Utc;
    use uuid::Uuid;

    fn a_track() -> Entry {
        Entry::TrackPublished {
            id: Uuid::new_v4(),
            peer_id: Uuid::new_v4(),
            mid: "0".to_string(),
            kind: TrackKind::Video,
            at: Utc::now(),
        }
    }

    #[test]
    fn the_noop_sink_swallows_everything() {
        // Aucune assertion possible sur un puits : ce test existe pour qu'un
        // futur NoopSink qui paniquerait ou allouerait soit repéré.
        let sink = NoopSink;
        for _ in 0..1000 {
            sink.record(a_track());
        }
    }

    #[test]
    fn the_memory_sink_keeps_what_it_is_given_in_order() {
        let sink = MemorySink::new();
        let first = a_track();
        let second = a_track();
        let (id_first, id_second) = (entry_id(&first), entry_id(&second));

        sink.record(first);
        sink.record(second);

        let drained = sink.drain();
        assert_eq!(drained.len(), 2);
        assert_eq!(entry_id(&drained[0]), id_first);
        assert_eq!(entry_id(&drained[1]), id_second);
    }

    #[test]
    fn draining_empties_the_memory_sink() {
        let sink = MemorySink::new();
        sink.record(a_track());
        assert_eq!(sink.drain().len(), 1);
        assert_eq!(sink.drain().len(), 0);
    }

    fn entry_id(e: &Entry) -> Uuid {
        match e {
            Entry::TrackPublished { id, .. } => *id,
            _ => panic!("le test ne fabrique que des TrackPublished"),
        }
    }

    #[test]
    fn a_full_queue_drops_and_counts_instead_of_blocking() {
        let metrics = crate::metrics::Metrics::new();
        let (sink, _rx) = QueueSink::new(2, metrics.clone());

        // La file accepte deux entrées, puis jette. Aucun de ces appels ne doit
        // bloquer : ils viennent parfois du milieu d'un verrou.
        sink.record(a_track());
        sink.record(a_track());
        sink.record(a_track());
        sink.record(a_track());

        assert_eq!(metrics.snapshot().telemetry_entries_dropped, 2);
    }

    #[test]
    fn nothing_is_dropped_while_the_queue_has_room() {
        let metrics = crate::metrics::Metrics::new();
        let (sink, _rx) = QueueSink::new(8, metrics.clone());
        sink.record(a_track());
        assert_eq!(metrics.snapshot().telemetry_entries_dropped, 0);
    }
}
