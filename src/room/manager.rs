//! A room, and the global room registry.

use super::peer::RoomPeer;
use crate::signaling::ServerMessage;
use dashmap::DashMap;
use std::sync::Arc;
use uuid::Uuid;

/// A group of peers that see one another.
pub struct Room {
    pub id: String,
    /// Identity of this occupancy period. A room row in the database is one
    /// period, not the name — two successive meetings under the same name
    /// never merge.
    pub session_id: Uuid,
    peers: DashMap<String, RoomPeer>,
}

impl Room {
    pub fn new(id: String) -> Self {
        Room {
            id,
            session_id: Uuid::new_v4(),
            peers: DashMap::new(),
        }
    }

    /// Adds a peer, notifies the occupants, and returns those already present.
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

    /// Removes a peer and notifies the remaining occupants.
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

/// What a join tells the caller, so it can record the lifecycle.
pub struct JoinOutcome {
    pub occupants: Vec<String>,
    /// Identity of the room's current occupancy period.
    pub room_session: Uuid,
    pub room_created: bool,
    /// Identity of this peer's occupancy of the room — a fresh uuid on every
    /// `join_room` call. This is what `telemetry.peers.id` names: not the
    /// connection, but this particular membership of it (Task 6 review,
    /// finding 3 — a connection that visits two rooms is two occupancies).
    pub peer_session: Uuid,
    /// The room this peer was in before this join, if switching rooms closed
    /// it. `join_room` calls `leave_room` on the caller's behalf when a peer
    /// switches rooms, and that departure never reaches `session.rs`'s
    /// teardown — it has to be surfaced here or it is lost (Task 6 review,
    /// finding 1.2).
    pub previous: Option<LeaveOutcome>,
}

/// What a departure tells the caller.
pub struct LeaveOutcome {
    pub room_session: Uuid,
    pub room_dropped: bool,
    /// Identity of the occupancy that just ended.
    pub peer_session: Uuid,
}

/// Owns the rooms and knows which one each peer is in.
///
/// Empty rooms are dropped automatically when the last peer leaves.
pub struct RoomManager {
    rooms: DashMap<String, Arc<Room>>,
    /// peer_id → (room_id, occupancy uuid). One entry per active membership;
    /// the two values live in the same map slot so they can never drift out
    /// of sync with one another.
    peer_room_index: DashMap<String, (String, Uuid)>,
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

    /// Brings a peer into a room, creating it if needed.
    ///
    /// A peer already present in another room leaves it first. Without that it
    /// would stay there forever: listed by `peer_ids`, notified of arrivals and
    /// departures, returned to newcomers as an occupant, and keeping the room
    /// from ever being considered empty — only the index moved, so that a later
    /// `leave_room` would remove it from the last room only. Same precaution as
    /// [`crate::media::ForwardingEngine::add_peer`]. That departure is returned
    /// as `JoinOutcome.previous` rather than swallowed, so the caller can still
    /// record it (Task 6 review, finding 1.2).
    ///
    /// A fresh occupancy uuid is minted on every call, even one that rejoins
    /// the room the peer is already in: `join_room` runs once per `Join`
    /// message, and each is its own occupancy period.
    pub fn join_room(&self, room_id: &str, peer: RoomPeer) -> JoinOutcome {
        let peer_id = peer.peer_id.clone();

        // The `Ref` is released before `leave_room`, which writes to the same map.
        let previous_room = self.peer_room_index.get(&peer_id).map(|r| r.0.clone());
        let previous = if previous_room.is_some_and(|previous| previous != room_id) {
            self.leave_room(&peer_id)
        } else {
            None
        };

        let mut created = false;
        let room = self
            .rooms
            .entry(room_id.to_string())
            .or_insert_with(|| {
                created = true;
                Arc::new(Room::new(room_id.to_string()))
            })
            .clone();

        let peer_session = Uuid::new_v4();
        self.peer_room_index
            .insert(peer_id, (room_id.to_string(), peer_session));

        JoinOutcome {
            occupants: room.add_peer(peer),
            room_session: room.session_id,
            room_created: created,
            peer_session,
            previous,
        }
    }

    /// Takes a peer out of its room, and drops the room if it becomes empty.
    ///
    /// `None` if the peer had no room to leave.
    pub fn leave_room(&self, peer_id: &str) -> Option<LeaveOutcome> {
        let (_, (room_id, peer_session)) = self.peer_room_index.remove(peer_id)?;
        // On clone l'`Arc<Room>` plutôt que de garder la `Ref` de la DashMap :
        // la tenir pendant le `self.rooms.remove` qui suit garderait le verrou
        // du shard qu'on modifie — la même famille de blocage que celle
        // documentée dans CONTEXT.md pour le négociateur.
        let room = self.rooms.get(&room_id)?.clone();

        room.remove_peer(peer_id);

        let dropped = room.is_empty();
        if dropped {
            self.rooms.remove(&room_id);
            tracing::info!("Room {} supprimée", room_id);
        }

        Some(LeaveOutcome {
            room_session: room.session_id,
            room_dropped: dropped,
            peer_session,
        })
    }

    /// Sends a message to a peer, wherever it is.
    pub fn send_to(&self, peer_id: &str, msg: ServerMessage) {
        let Some(entry) = self.peer_room_index.get(peer_id) else {
            return;
        };
        if let Some(room) = self.rooms.get(entry.0.as_str()) {
            room.send_to(peer_id, msg);
        }
    }

    /// A peer's room, if it has one.
    pub fn get_room(&self, peer_id: &str) -> Option<Arc<Room>> {
        let entry = self.peer_room_index.get(peer_id)?;
        self.rooms.get(entry.0.as_str()).map(|r| r.clone())
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
        assert_eq!(
            mgr.join_room("standup", bob).occupants,
            vec!["alice".to_string()]
        );
    }

    #[test]
    fn rooms_are_isolated_from_one_another() {
        let mgr = RoomManager::new();
        let (alice, _a) = peer("alice");
        let (bob, _b) = peer("bob");

        mgr.join_room("room-a", alice);
        assert!(mgr.join_room("room-b", bob).occupants.is_empty());
        assert_eq!(mgr.room_count(), 2);
    }

    #[test]
    fn the_last_peer_leaving_drops_the_room() {
        let mgr = RoomManager::new();
        let (alice, _a) = peer("alice");

        mgr.join_room("standup", alice);
        let _ = mgr.leave_room("alice");

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
        let _ = mgr.leave_room("alice");

        assert_eq!(mgr.room_count(), 1);
        assert_eq!(mgr.peer_count(), 1);
    }

    #[test]
    fn leaving_twice_is_harmless() {
        let mgr = RoomManager::new();
        let (alice, _a) = peer("alice");

        mgr.join_room("standup", alice);
        let _ = mgr.leave_room("alice");
        let _ = mgr.leave_room("alice");

        assert_eq!(mgr.peer_count(), 0);
    }

    #[test]
    fn leaving_without_ever_joining_is_harmless() {
        let _ = RoomManager::new().leave_room("ghost");
    }

    #[test]
    fn the_first_peer_creates_the_room_and_says_so() {
        let manager = RoomManager::new();
        let (alice, _a) = peer("alice");
        let outcome = manager.join_room("salon", alice);
        assert!(outcome.room_created);
        assert!(outcome.occupants.is_empty());
    }

    #[test]
    fn the_second_peer_does_not_create_the_room() {
        let manager = RoomManager::new();
        let (alice, _a) = peer("alice");
        let first = manager.join_room("salon", alice);
        let (bob, _b) = peer("bob");
        let second = manager.join_room("salon", bob);

        assert!(!second.room_created);
        // La session de room est la même tant que la room vit : c'est elle qui
        // porte l'identité en base.
        assert_eq!(second.room_session, first.room_session);
        assert_eq!(second.occupants, vec!["alice".to_string()]);
    }

    #[test]
    fn the_last_departure_reports_the_room_as_dropped() {
        let manager = RoomManager::new();
        let (alice, _a) = peer("alice");
        let joined = manager.join_room("salon", alice);

        let left = manager
            .leave_room("alice")
            .expect("alice était dans une room");
        assert!(left.room_dropped);
        assert_eq!(left.room_session, joined.room_session);
    }

    #[test]
    fn a_departure_that_leaves_occupants_does_not_drop_the_room() {
        let manager = RoomManager::new();
        let (alice, _a) = peer("alice");
        manager.join_room("salon", alice);
        let (bob, _b) = peer("bob");
        manager.join_room("salon", bob);

        let left = manager
            .leave_room("alice")
            .expect("alice était dans une room");
        assert!(!left.room_dropped);
    }

    #[test]
    fn a_room_reused_after_emptying_gets_a_new_session() {
        // Décision 4.5 : une ligne de `rooms` est une période d'occupation. Deux
        // réunions successives du même nom ne doivent jamais fusionner.
        let manager = RoomManager::new();
        let (alice, _a) = peer("alice");
        let first = manager.join_room("salon", alice);
        let _ = manager.leave_room("alice");

        let (bob, _b) = peer("bob");
        let second = manager.join_room("salon", bob);
        assert_ne!(first.room_session, second.room_session);
    }

    #[test]
    fn leaving_without_a_room_reports_nothing() {
        let manager = RoomManager::new();
        assert!(manager.leave_room("fantome").is_none());
    }

    #[test]
    fn joining_reports_the_ended_occupancy() {
        let manager = RoomManager::new();
        let (alice, _a) = peer("alice");
        let joined = manager.join_room("salon", alice);

        let left = manager
            .leave_room("alice")
            .expect("alice était dans une room");
        assert_eq!(left.peer_session, joined.peer_session);
    }

    #[test]
    fn every_join_mints_a_fresh_occupancy() {
        // Décision : chaque `Join` est sa propre période d'occupation, même un
        // second join du même connecteur dans la même room (Task 6 review,
        // finding 3).
        let manager = RoomManager::new();
        let (alice, _a) = peer("alice");
        let (alice_again, _a2) = peer("alice");

        let first = manager.join_room("salon", alice);
        let second = manager.join_room("salon", alice_again);

        assert_ne!(first.peer_session, second.peer_session);
    }

    #[test]
    fn a_first_join_has_no_previous_departure() {
        let manager = RoomManager::new();
        let (alice, _a) = peer("alice");
        assert!(manager.join_room("salon", alice).previous.is_none());
    }

    #[test]
    fn switching_rooms_surfaces_the_departure_from_the_previous_one() {
        // Sans ce champ, la room quittée en changeant de room ne repasse
        // jamais par un `leave_room` observable de l'extérieur : elle se
        // vide en silence (Task 6 review, finding 1.2).
        let mgr = RoomManager::new();
        let (alice, _a) = peer("alice");
        let (alice_again, _a2) = peer("alice");

        let first = mgr.join_room("room-a", alice);
        let second = mgr.join_room("room-b", alice_again);

        let previous = second
            .previous
            .expect("alice quittait room-a en rejoignant room-b");
        assert_eq!(previous.room_session, first.room_session);
        assert_eq!(previous.peer_session, first.peer_session);
        assert!(
            previous.room_dropped,
            "room-a n'avait qu'alice, elle doit se vider"
        );
    }

    #[test]
    fn switching_rooms_when_the_previous_one_survives_reports_it() {
        let mgr = RoomManager::new();
        let (alice, _a) = peer("alice");
        let (bob, _b) = peer("bob");
        let (alice_again, _a2) = peer("alice");

        mgr.join_room("room-a", alice);
        mgr.join_room("room-a", bob);
        let second = mgr.join_room("room-b", alice_again);

        let previous = second
            .previous
            .expect("alice quittait room-a en rejoignant room-b");
        assert!(
            !previous.room_dropped,
            "room-a survit grâce à bob"
        );
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
