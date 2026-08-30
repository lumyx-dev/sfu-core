//! Optional telemetry persistence.
//!
//! Off unless `SFU_DATABASE_URL` is set. The write path never touches the
//! media hot path: producers enqueue through [`TelemetrySink`], and a
//! background task batches one second of entries into a single transaction.

pub mod batch;
pub mod entry;
pub mod sink;

pub use batch::Batch;
pub use entry::{Entry, EventKind, EventRecord, PeerSample, Severity, TrackKind, TrackSample};
pub use sink::{MemorySink, NoopSink, TelemetrySink};
