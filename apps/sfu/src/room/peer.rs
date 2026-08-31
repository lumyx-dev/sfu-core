//! A peer as seen from a room.

use crate::signaling::ServerMessage;
use tokio::sync::mpsc;

/// A peer present in a room, along with its signaling channel.
///
/// The channel is a bounded `mpsc`: several producers (the room, the WebRTC
/// connection, the dispatch) for a single consumer, the task writing to the
/// peer's WebSocket.
#[derive(Debug, Clone)]
pub struct RoomPeer {
    pub peer_id: String,
    pub sender: mpsc::Sender<ServerMessage>,
}

impl RoomPeer {
    /// Sends a message to the peer without ever blocking.
    ///
    /// Called from `Room`'s synchronous methods, hence `try_send`. A full
    /// channel betrays a WebSocket consumer falling behind: we log it, since
    /// losing a signaling message is never harmless. A closed channel, on the
    /// other hand, is the ordinary case of a peer disconnecting.
    pub fn send(&self, msg: ServerMessage) {
        match self.sender.try_send(msg) {
            Ok(()) => {}
            Err(mpsc::error::TrySendError::Full(_)) => {
                tracing::warn!(
                    "Peer {} — canal de signaling plein, message perdu",
                    self.peer_id
                );
            }
            Err(mpsc::error::TrySendError::Closed(_)) => {
                tracing::debug!(
                    "Peer {} — canal de signaling fermé, message ignoré",
                    self.peer_id
                );
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn send_reaches_the_receiver() {
        let (sender, mut rx) = mpsc::channel(4);
        let peer = RoomPeer {
            peer_id: "alice".into(),
            sender,
        };

        peer.send(ServerMessage::Connected {
            peer_id: "alice".into(),
        });

        assert!(matches!(rx.try_recv(), Ok(ServerMessage::Connected { .. })));
    }

    #[test]
    fn send_without_a_receiver_is_harmless() {
        let (sender, rx) = mpsc::channel(4);
        drop(rx);

        RoomPeer {
            peer_id: "alice".into(),
            sender,
        }
        .send(ServerMessage::PeerLeft {
            peer_id: "bob".into(),
        });
    }

    #[test]
    fn send_on_a_full_channel_drops_the_message_instead_of_blocking() {
        let (sender, mut rx) = mpsc::channel(1);
        let peer = RoomPeer {
            peer_id: "alice".into(),
            sender,
        };

        peer.send(ServerMessage::PeerJoined {
            peer_id: "bob".into(),
        });
        // Saturated channel: this send must return without waiting or panicking.
        peer.send(ServerMessage::PeerJoined {
            peer_id: "carol".into(),
        });

        let _ = rx.try_recv(); // PeerJoined(bob)
        assert!(
            rx.try_recv().is_err(),
            "le message excédentaire doit être abandonné, pas mis en attente"
        );
    }
}
