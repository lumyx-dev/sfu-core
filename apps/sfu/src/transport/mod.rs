//! Transport layer: WebRTC (str0m) and UDP sockets.
//!
//! One peer = one str0m `Rtc` + one UDP socket + one event-loop task.
//! [`PeerSink`] is the bridge towards the media layer; [`TransportEvent`] is
//! what the event loop reports back to the session.

pub mod event_loop;
pub mod peer_connection;
pub mod sink;

pub use event_loop::TransportEvent;
pub use peer_connection::PeerConnection;
pub use sink::PeerSink;
