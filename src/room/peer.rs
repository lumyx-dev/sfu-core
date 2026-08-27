//! Un peer vu depuis une room.

use crate::signaling::ServerMessage;
use tokio::sync::mpsc;

/// Un peer présent dans une room, avec son canal de signaling.
///
/// Le canal est un `mpsc` borné : plusieurs producteurs (la room, la connexion
/// WebRTC, le dispatch) pour un unique consommateur, la task qui écrit sur la
/// WebSocket du peer.
#[derive(Debug, Clone)]
pub struct RoomPeer {
    pub peer_id: String,
    pub sender: mpsc::Sender<ServerMessage>,
}

impl RoomPeer {
    /// Envoie un message au peer sans jamais bloquer.
    ///
    /// Appelé depuis les méthodes synchrones de `Room`, d'où `try_send`. Un
    /// canal plein trahit un consommateur WebSocket en retard : on le
    /// journalise, perdre un message de signaling n'est jamais anodin. Un canal
    /// fermé est en revanche le cas ordinaire d'un peer qui se déconnecte.
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
        // Canal saturé : cet envoi doit rendre la main sans attendre ni paniquer.
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
