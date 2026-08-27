//! Couche transport : WebRTC (str0m) et sockets UDP.
//!
//! Un peer = une `Rtc` str0m + une socket UDP + une task d'event loop.
//! [`PeerSink`] est le pont vers la couche média.

pub mod event_loop;
pub mod peer_connection;
pub mod sink;

pub use peer_connection::PeerConnection;
pub use sink::PeerSink;
