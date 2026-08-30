//! WebSocket signaling: JSON protocol, per-peer session, dispatch.

pub mod dispatch;
pub mod messages;
pub mod session;

pub use messages::{ClientMessage, ServerMessage};
pub use session::handle_socket;
