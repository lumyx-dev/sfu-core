//! Lumyx SFU — WebRTC conferencing server.
//!
//! Three layers, stacked from the bottom up:
//!
//! - [`transport`] — WebRTC and UDP (str0m). One connection per peer.
//! - [`media`] — RTP packet routing. Knows only the [`media::RtpSink`] trait,
//!   so it is testable without a network.
//! - [`signaling`] — JSON WebSocket protocol and session lifecycle.
//!
//! [`room`] holds peer membership, [`app`] the shared state and the HTTP
//! router.

pub mod app;
pub mod config;
pub mod error;
pub mod http;
pub mod media;
pub mod metrics;
pub mod room;
pub mod signaling;
pub mod telemetry;
pub mod transport;
