//! Une room et le registre global des rooms.

use super::peer::RoomPeer;
use crate::signaling::ServerMessage;
use dashmap::DashMap;
use std::sync::Arc;

/// Un groupe de peers qui se voient mutuellement.
pub struct Room {
    pub id: String,
    peers: DashMap<String, RoomPeer>,
}

impl Room {
    pub fn new(id: String) -> Self {
        Room {
            id,
            peers: DashMap::new(),
        }
    }

    /// Ajoute un peer, notifie les occupants et renvoie ceux déjà présents.
    pub fn add_peer(&self, peer: RoomPeer) -> Vec<String> {
        let existing: Vec<String> = self.peers.iter().map(|p| p.peer_id.clone()).collect();

        for p in self.peers.iter() {
            p.send(ServerMessage::PeerJoined {
                peer_id: peer.peer_id.clone(),
            });
        }

        self.peers.insert(peer.peer_id.clone(), peer);
        existing
    }

    /// Retire un peer et notifie les occupants restants.
    pub fn remove_peer(&self, peer_id: &str) {
        self.peers.remove(peer_id);
        for p in self.peers.iter() {
            p.send(ServerMessage::PeerLeft {
                peer_id: peer_id.to_string(),
            });
        }
    }

    pub fn send_to(&self, peer_id: &str, msg: ServerMessage) {
        if let Some(peer) = self.peers.get(peer_id) {
            peer.send(msg);
        }
    }

    pub fn peer_ids(&self) -> Vec<String> {
        self.peers.iter().map(|p| p.peer_id.clone()).collect()
    }

    pub fn is_empty(&self) -> bool {
        self.peers.is_empty()
    }
}

/// Possède les rooms et sait dans laquelle se trouve chaque peer.
///
/// Les rooms vides sont supprimées automatiquement au départ du dernier peer.
pub struct RoomManager {
    rooms: DashMap<String, Arc<Room>>,
    /// Index peer_id → room_id, pour joindre un peer sans balayer les rooms.
    peer_room_index: DashMap<String, String>,
}

impl Default for RoomManager {
    fn default() -> Self {
        Self::new()
    }
}

impl RoomManager {
    pub fn new() -> Self {
        RoomManager {
            rooms: DashMap::new(),
            peer_room_index: DashMap::new(),
        }
    }

    /// Fait entrer un peer dans une room, en la créant au besoin.
    /// Renvoie les peers déjà présents.
    ///
    /// Un peer déjà présent dans une autre room en sort d'abord. Sans ça il y
    /// resterait indéfiniment : listé par `peer_ids`, notifié des arrivées et
    /// des départs, renvoyé aux nouveaux arrivants comme occupant, et empêchant
    /// la room de jamais être considérée comme vide — seul l'index bougeait, si
    /// bien qu'un `leave_room` ultérieur ne le sortait que de la dernière room.
    /// Même précaution que [`crate::media::ForwardingEngine::add_peer`].
    pub fn join_room(&self, room_id: &str, peer: RoomPeer) -> Vec<String> {
        let peer_id = peer.peer_id.clone();

        // La `Ref` est relâchée avant `leave_room`, qui écrit dans la même map.
        let previous = self.peer_room_index.get(&peer_id).map(|r| r.clone());
        if previous.is_some_and(|previous| previous != room_id) {
            self.leave_room(&peer_id);
        }

        let room = self
            .rooms
            .entry(room_id.to_string())
            .or_insert_with(|| Arc::new(Room::new(room_id.to_string())))
            .clone();

        self.peer_room_index.insert(peer_id, room_id.to_string());

        room.add_peer(peer)
    }

    /// Sort un peer de sa room, et supprime la room si elle devient vide.
    pub fn leave_room(&self, peer_id: &str) {
        let Some((_, room_id)) = self.peer_room_index.remove(peer_id) else {
            return;
        };

        let Some(room) = self.rooms.get(&room_id) else {
            return;
        };

        room.remove_peer(peer_id);

        if room.is_empty() {
            drop(room);
            self.rooms.remove(&room_id);
            tracing::info!("Room {} supprimée", room_id);
        }
    }

    /// Envoie un message à un peer, où qu'il soit.
    pub fn send_to(&self, peer_id: &str, msg: ServerMessage) {
        let Some(room_id) = self.peer_room_index.get(peer_id) else {
            return;
        };
        if let Some(room) = self.rooms.get(room_id.as_str()) {
            room.send_to(peer_id, msg);
        }
    }

    /// Room d'un peer, s'il en a une.
    pub fn get_room(&self, peer_id: &str) -> Option<Arc<Room>> {
        let room_id = self.peer_room_index.get(peer_id)?;
        self.rooms.get(room_id.as_str()).map(|r| r.clone())
    }

    pub fn room_count(&self) -> usize {
        self.rooms.len()
    }

    pub fn peer_count(&self) -> usize {
        self.peer_room_index.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::sync::mpsc::{self, Receiver};

    fn peer(id: &str) -> (RoomPeer, Receiver<ServerMessage>) {
        let (sender, rx) = mpsc::channel(16);
        (
            RoomPeer {
                peer_id: id.to_string(),
                sender,
            },
            rx,
        )
    }

    #[test]
    fn joining_creates_the_room() {
        let mgr = RoomManager::new();
        let (alice, _a) = peer("alice");

        assert_eq!(mgr.room_count(), 0);
        mgr.join_room("standup", alice);
        assert_eq!(mgr.room_count(), 1);
        assert_eq!(mgr.peer_count(), 1);
    }

    #[test]
    fn joining_returns_the_existing_occupants() {
        let mgr = RoomManager::new();
        let (alice, _a) = peer("alice");
        let (bob, _b) = peer("bob");

        mgr.join_room("standup", alice);
        assert_eq!(mgr.join_room("standup", bob), vec!["alice".to_string()]);
    }

    #[test]
    fn rooms_are_isolated_from_one_another() {
        let mgr = RoomManager::new();
        let (alice, _a) = peer("alice");
        let (bob, _b) = peer("bob");

        mgr.join_room("room-a", alice);
        assert!(mgr.join_room("room-b", bob).is_empty());
        assert_eq!(mgr.room_count(), 2);
    }

    #[test]
    fn the_last_peer_leaving_drops_the_room() {
        let mgr = RoomManager::new();
        let (alice, _a) = peer("alice");

        mgr.join_room("standup", alice);
        mgr.leave_room("alice");

        assert_eq!(mgr.room_count(), 0);
        assert_eq!(mgr.peer_count(), 0);
    }

    #[test]
    fn the_room_survives_while_a_peer_remains() {
        let mgr = RoomManager::new();
        let (alice, _a) = peer("alice");
        let (bob, _b) = peer("bob");

        mgr.join_room("standup", alice);
        mgr.join_room("standup", bob);
        mgr.leave_room("alice");

        assert_eq!(mgr.room_count(), 1);
        assert_eq!(mgr.peer_count(), 1);
    }

    #[test]
    fn leaving_twice_is_harmless() {
        let mgr = RoomManager::new();
        let (alice, _a) = peer("alice");

        mgr.join_room("standup", alice);
        mgr.leave_room("alice");
        mgr.leave_room("alice");

        assert_eq!(mgr.peer_count(), 0);
    }

    #[test]
    fn leaving_without_ever_joining_is_harmless() {
        RoomManager::new().leave_room("ghost");
    }

    #[test]
    fn send_to_routes_through_the_index() {
        let mgr = RoomManager::new();
        let (alice, mut alice_rx) = peer("alice");
        mgr.join_room("standup", alice);

        mgr.send_to(
            "alice",
            ServerMessage::Connected {
                peer_id: "alice".into(),
            },
        );

        assert!(matches!(
            alice_rx.try_recv(),
            Ok(ServerMessage::Connected { .. })
        ));
    }

    #[test]
    fn send_to_an_unknown_peer_is_a_noop() {
        RoomManager::new().send_to(
            "ghost",
            ServerMessage::Error {
                message: "boo".into(),
            },
        );
    }

    #[test]
    fn get_room_finds_the_peers_room() {
        let mgr = RoomManager::new();
        let (alice, _a) = peer("alice");
        mgr.join_room("standup", alice);

        assert_eq!(
            mgr.get_room("alice").map(|r| r.id.clone()).as_deref(),
            Some("standup")
        );
        assert!(mgr.get_room("ghost").is_none());
    }

    #[test]
    fn rejoining_another_room_repoints_the_index() {
        let mgr = RoomManager::new();
        let (alice, _a) = peer("alice");
        let (alice_again, _a2) = peer("alice");

        mgr.join_room("room-a", alice);
        mgr.join_room("room-b", alice_again);

        assert_eq!(
            mgr.get_room("alice").map(|r| r.id.clone()).as_deref(),
            Some("room-b")
        );
        assert_eq!(mgr.peer_count(), 1);
    }

    #[test]
    fn rejoining_another_room_removes_the_peer_from_the_previous_one() {
        let mgr = RoomManager::new();
        let (alice, _a) = peer("alice");
        let (bob, _b) = peer("bob");
        let (alice_again, _a2) = peer("alice");

        mgr.join_room("room-a", alice);
        mgr.join_room("room-a", bob);
        mgr.join_room("room-b", alice_again);

        let room_a = mgr
            .rooms
            .get("room-a")
            .map(|r| r.clone())
            .expect("room-a tient encore grâce à bob");
        assert_eq!(
            room_a.peer_ids(),
            vec!["bob".to_string()],
            "alice ne doit plus figurer parmi les occupants de son ancienne room"
        );
    }

    #[test]
    fn rejoining_another_room_drops_the_previous_one_when_it_empties() {
        let mgr = RoomManager::new();
        let (alice, _a) = peer("alice");
        let (alice_again, _a2) = peer("alice");

        mgr.join_room("room-a", alice);
        mgr.join_room("room-b", alice_again);

        assert_eq!(
            mgr.room_count(),
            1,
            "room-a est vide après le départ d'alice, elle doit disparaître"
        );
    }

    #[test]
    fn rejoining_another_room_notifies_the_remaining_occupants() {
        let mgr = RoomManager::new();
        let (alice, _a) = peer("alice");
        let (bob, mut bob_rx) = peer("bob");
        let (alice_again, _a2) = peer("alice");

        mgr.join_room("room-a", alice);
        mgr.join_room("room-a", bob);
        mgr.join_room("room-b", alice_again);

        match bob_rx.try_recv() {
            Ok(ServerMessage::PeerLeft { peer_id }) => assert_eq!(peer_id, "alice"),
            other => panic!("attendu PeerLeft(alice), reçu {:?}", other),
        }
    }

    #[test]
    fn rejoining_the_same_room_keeps_the_peer_in_it() {
        let mgr = RoomManager::new();
        let (alice, _a) = peer("alice");
        let (alice_again, _a2) = peer("alice");

        mgr.join_room("standup", alice);
        mgr.join_room("standup", alice_again);

        assert_eq!(
            mgr.get_room("alice").map(|r| r.peer_ids()),
            Some(vec!["alice".to_string()])
        );
    }

    // --- Room ---

    #[test]
    fn first_peer_sees_an_empty_room() {
        let room = Room::new("r".into());
        let (alice, _rx) = peer("alice");
        assert!(room.add_peer(alice).is_empty());
    }

    #[test]
    fn joining_peer_receives_the_existing_occupants() {
        let room = Room::new("r".into());
        let (alice, _a) = peer("alice");
        let (bob, _b) = peer("bob");

        room.add_peer(alice);
        assert_eq!(room.add_peer(bob), vec!["alice".to_string()]);
    }

    #[test]
    fn occupants_are_notified_of_a_new_peer() {
        let room = Room::new("r".into());
        let (alice, mut alice_rx) = peer("alice");
        let (bob, _b) = peer("bob");

        room.add_peer(alice);
        room.add_peer(bob);

        match alice_rx.try_recv() {
            Ok(ServerMessage::PeerJoined { peer_id }) => assert_eq!(peer_id, "bob"),
            other => panic!("attendu PeerJoined(bob), reçu {:?}", other),
        }
    }

    #[test]
    fn remaining_occupants_are_notified_of_a_departure() {
        let room = Room::new("r".into());
        let (alice, mut alice_rx) = peer("alice");
        let (bob, _b) = peer("bob");

        room.add_peer(alice);
        room.add_peer(bob);
        let _ = alice_rx.try_recv(); // PeerJoined(bob)

        room.remove_peer("bob");

        match alice_rx.try_recv() {
            Ok(ServerMessage::PeerLeft { peer_id }) => assert_eq!(peer_id, "bob"),
            other => panic!("attendu PeerLeft(bob), reçu {:?}", other),
        }
    }

    #[test]
    fn a_departing_peer_is_not_notified_of_its_own_departure() {
        let room = Room::new("r".into());
        let (alice, mut alice_rx) = peer("alice");

        room.add_peer(alice);
        room.remove_peer("alice");

        assert!(alice_rx.try_recv().is_err());
        assert!(room.is_empty());
    }

    #[test]
    fn a_room_ignores_send_to_for_an_absent_peer() {
        let room = Room::new("r".into());
        room.send_to(
            "ghost",
            ServerMessage::Error {
                message: "boo".into(),
            },
        );
    }

    #[test]
    fn send_to_reaches_the_targeted_peer_only() {
        let room = Room::new("r".into());
        let (alice, mut alice_rx) = peer("alice");
        let (bob, mut bob_rx) = peer("bob");

        room.add_peer(alice);
        room.add_peer(bob);
        let _ = alice_rx.try_recv(); // PeerJoined(bob)

        room.send_to(
            "alice",
            ServerMessage::Error {
                message: "pour alice".into(),
            },
        );

        assert!(matches!(
            alice_rx.try_recv(),
            Ok(ServerMessage::Error { .. })
        ));
        assert!(bob_rx.try_recv().is_err());
    }

    #[test]
    fn peer_ids_lists_the_occupants() {
        let room = Room::new("r".into());
        let (alice, _a) = peer("alice");
        let (bob, _b) = peer("bob");
        room.add_peer(alice);
        room.add_peer(bob);

        let mut ids = room.peer_ids();
        ids.sort();
        assert_eq!(ids, vec!["alice".to_string(), "bob".to_string()]);
    }
}
