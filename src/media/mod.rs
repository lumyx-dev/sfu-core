//! Couche média : routage des paquets RTP entre publishers et subscribers.
//!
//! Ce module ne connaît ni UDP, ni WebSocket. Il parle uniquement au trait
//! [`RtpSink`], ce qui le rend testable sans réseau. De str0m il n'emprunte
//! que le type `Mid` porté par [`RtpPacketData`], pour éviter une allocation
//! par paquet et par subscriber.

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
