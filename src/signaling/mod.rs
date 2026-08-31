//! WebSocket signaling: JSON protocol, per-peer session, SDP renegotiation.

pub mod dispatch;
pub mod messages;
pub mod negotiation;
pub mod session;

pub use messages::{ClientMessage, ServerMessage};
pub use negotiation::{NegotiationEvent, Negotiator};
pub use session::handle_socket;
