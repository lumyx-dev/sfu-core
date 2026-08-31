//! Media layer: routing RTP packets from publishers to subscribers.
//!
//! This module knows nothing about UDP or WebSocket. It only talks to the
//! [`RtpSink`] trait, which makes it testable without a network. What it
//! borrows from str0m are two value types carried by [`RtpPacketData`] — `Mid`
//! and `PayloadParams`, both `Copy` — so that a packet can name its
//! destination m-line and its codec without an allocation per subscriber.

pub mod down_track;
pub mod engine;
pub mod packet;
pub mod sink;
pub mod track;
pub mod up_track;

pub use down_track::DownTrack;
pub use engine::ForwardingEngine;
pub use packet::RtpPacketData;
pub use sink::RtpSink;
pub use track::TrackKey;
pub use up_track::UpTrack;
