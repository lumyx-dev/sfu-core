//! Signaling WebSocket : protocole JSON, session par peer, dispatch.

pub mod dispatch;
pub mod messages;
pub mod session;

pub use messages::{ClientMessage, ServerMessage};
pub use session::handle_socket;
