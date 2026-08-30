//! Media layer: routing RTP packets from publishers to subscribers.
//!
//! This module knows nothing about UDP or WebSocket. It only talks to the
//! [`RtpSink`] trait, which makes it testable without a network. The only
//! thing it borrows from str0m is the `Mid` type carried by
//! [`RtpPacketData`], to avoid one allocation per packet per subscriber.

pub mod down_track;
pub mod engine;
pub mod packet;
pub mod sink;
pub mod up_track;

pub use down_track::DownTrack;
pub use engine::ForwardingEngine;
pub use packet::RtpPacketData;
pub use sink::RtpSink;
pub use up_track::UpTrack;
