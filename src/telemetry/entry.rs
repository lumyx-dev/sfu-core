//! What the SFU can hand to telemetry.
//!
//! One flat enum rather than a method per record type: the queue between the
//! producers and the writer carries a single type, and adding a record later
//! means adding a variant, not widening a trait every implementation has to
//! follow.

use chrono::{DateTime, Utc};
use serde_json::Value;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrackKind {
    Audio,
    Video,
}

impl TrackKind {
    /// The `telemetry.track_kind` label this maps to.
    pub fn as_str(self) -> &'static str {
        match self {
            TrackKind::Audio => "audio",
            TrackKind::Video => "video",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Severity {
    Info,
    Warning,
    Critical,
}

impl Severity {
    pub fn as_str(self) -> &'static str {
        match self {
            Severity::Info => "info",
            Severity::Warning => "warning",
            Severity::Critical => "critical",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EventKind {
    InstanceStarted,
    InstanceRecovered,
    RoomCreated,
    RoomEnded,
    PeerJoined,
    PeerLeft,
    TrackPublished,
    TrackEnded,
    IceConnected,
    IceDisconnected,
    IceFailed,
    Renegotiated,
    ThresholdBreached,
    ThresholdCleared,
}

impl EventKind {
    pub fn as_str(self) -> &'static str {
        match self {
            EventKind::InstanceStarted => "instance_started",
            EventKind::InstanceRecovered => "instance_recovered",
            EventKind::RoomCreated => "room_created",
            EventKind::RoomEnded => "room_ended",
            EventKind::PeerJoined => "peer_joined",
            EventKind::PeerLeft => "peer_left",
            EventKind::TrackPublished => "track_published",
            EventKind::TrackEnded => "track_ended",
            EventKind::IceConnected => "ice_connected",
            EventKind::IceDisconnected => "ice_disconnected",
            EventKind::IceFailed => "ice_failed",
            EventKind::Renegotiated => "renegotiated",
            EventKind::ThresholdBreached => "threshold_breached",
            EventKind::ThresholdCleared => "threshold_cleared",
        }
    }

    /// The severity a given kind carries by default.
    pub fn severity(self) -> Severity {
        match self {
            EventKind::IceFailed | EventKind::ThresholdBreached => Severity::Critical,
            EventKind::IceDisconnected => Severity::Warning,
            _ => Severity::Info,
        }
    }
}

/// One second of a track, as **deltas** — never cumulative counters.
///
/// str0m reports totals since the start of the connection; the sampler
/// subtracts the previous reading. A delta sums and averages over any window;
/// a total needs a window function on every query and goes wrong the moment a
/// row is missing, which will happen since the queue drops.
#[derive(Debug, Clone, PartialEq)]
pub struct TrackSample {
    pub track_id: Uuid,
    pub at: DateTime<Utc>,
    pub bytes: i64,
    pub packets: i64,
    pub nacks: i32,
    pub plis: i32,
    pub firs: i32,
    /// Converted from RTP clock units. `None` until a report has arrived.
    pub jitter_ms: Option<f32>,
    /// Fraction between 0 and 1.
    pub loss: Option<f32>,
    pub rtt_ms: Option<f32>,
}

/// One second of a peer's transport, as deltas.
#[derive(Debug, Clone, PartialEq)]
pub struct PeerSample {
    pub peer_id: Uuid,
    pub at: DateTime<Utc>,
    pub bytes_rx: i64,
    pub bytes_tx: i64,
    pub transport_bytes_rx: i64,
    pub transport_bytes_tx: i64,
    pub egress_loss: Option<f32>,
    pub bwe_bps: Option<i64>,
}

#[derive(Debug, Clone)]
pub struct EventRecord {
    pub at: DateTime<Utc>,
    pub kind: EventKind,
    pub severity: Severity,
    pub room_id: Option<Uuid>,
    pub peer_id: Option<Uuid>,
    pub track_id: Option<Uuid>,
    pub payload: Value,
}

impl EventRecord {
    /// An event with the kind's default severity and an empty payload.
    pub fn new(kind: EventKind, at: DateTime<Utc>) -> Self {
        EventRecord {
            at,
            kind,
            severity: kind.severity(),
            room_id: None,
            peer_id: None,
            track_id: None,
            payload: Value::Object(Default::default()),
        }
    }

    pub fn room(mut self, id: Uuid) -> Self {
        self.room_id = Some(id);
        self
    }

    pub fn peer(mut self, id: Uuid) -> Self {
        self.peer_id = Some(id);
        self
    }

    pub fn track(mut self, id: Uuid) -> Self {
        self.track_id = Some(id);
        self
    }

    pub fn payload(mut self, payload: Value) -> Self {
        self.payload = payload;
        self
    }
}

#[derive(Debug, Clone)]
pub enum Entry {
    RoomOpened {
        id: Uuid,
        name: String,
        at: DateTime<Utc>,
    },
    RoomClosed {
        id: Uuid,
        at: DateTime<Utc>,
        /// `"empty"` or `"instance_restart"`.
        reason: &'static str,
    },
    /// `id` is the **occupancy** — one row per membership of a room, minted
    /// fresh on every join (Task 6 review, finding 3). `peer_id` is the
    /// **connection** — the WebSocket's uuid, what the dashboard displays.
    /// A single connection visiting two rooms produces two `PeerJoined`, one
    /// `id` each, sharing one `peer_id`.
    PeerJoined {
        id: Uuid,
        peer_id: Uuid,
        room_id: Uuid,
        at: DateTime<Utc>,
    },
    /// `id` is the occupancy that just ended, not the connection.
    PeerLeft {
        id: Uuid,
        at: DateTime<Utc>,
        close_code: Option<i32>,
    },
    /// `peer_id` here is the occupancy, despite the field name kept for
    /// symmetry with `TrackPublished.peer_id` — both reference `telemetry.peers.id`.
    IceState {
        peer_id: Uuid,
        state: String,
        at: DateTime<Utc>,
    },
    /// `peer_id` is the occupancy: a track published in room A and one
    /// published in room B by the same connection are two different tracks.
    TrackPublished {
        id: Uuid,
        peer_id: Uuid,
        mid: String,
        kind: TrackKind,
        at: DateTime<Utc>,
    },
    /// Resolved on the track's first packet: `MediaAdded` does not carry the
    /// codec, only the first `PayloadParams` does.
    TrackCodec {
        id: Uuid,
        codec: String,
        clock_rate: i32,
    },
    TrackEnded {
        id: Uuid,
        at: DateTime<Utc>,
    },
    TrackSample(TrackSample),
    PeerSample(PeerSample),
    Event(EventRecord),
}
