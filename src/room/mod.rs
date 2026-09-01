//! Rooms and peer membership.

pub mod manager;
pub mod peer;

pub use manager::{JoinOutcome, LeaveOutcome, Room, RoomManager};
pub use peer::RoomPeer;
