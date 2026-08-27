//! Rooms et appartenance des peers.

pub mod manager;
pub mod peer;

pub use manager::{Room, RoomManager};
pub use peer::RoomPeer;
