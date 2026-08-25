use crate::signaling::ServerMessage;
use dashmap::DashMap;
use std::sync::Arc;
use tokio::sync::broadcast;

/// Un peer connecté dans une room
#[derive(Debug, Clone)]
pub struct RoomPeer {
    pub peer_id: String,
    pub sender: broadcast::Sender<ServerMessage>,
}

impl RoomPeer {
    pub fn send(&self, msg: ServerMessage) {
        let _ = self.sender.send(msg);
    }
}

/// Une room — contient les peers connectés
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

    /// Ajoute un peer — retourne la liste des peers déjà présents
    pub fn add_peer(&self, peer: RoomPeer) -> Vec<String> {
        let existing: Vec<String> = self.peers.iter().map(|p| p.peer_id.clone()).collect();

        // notifie les peers existants
        for p in self.peers.iter() {
            p.send(ServerMessage::PeerJoined {
                peer_id: peer.peer_id.clone(),
            });
        }

        self.peers.insert(peer.peer_id.clone(), peer);
        existing
    }

    /// Retire un peer — notifie les autres
    pub fn remove_peer(&self, peer_id: &str) {
        self.peers.remove(peer_id);
        for p in self.peers.iter() {
            p.send(ServerMessage::PeerLeft {
                peer_id: peer_id.to_string(),
            });
        }
    }

    /// Envoie un message à un peer spécifique
    pub fn send_to(&self, peer_id: &str, msg: ServerMessage) {
        if let Some(peer) = self.peers.get(peer_id) {
            peer.send(msg);
        }
    }

    /// Liste les peer_ids
    pub fn peer_ids(&self) -> Vec<String> {
        self.peers.iter().map(|p| p.peer_id.clone()).collect()
    }

    pub fn is_empty(&self) -> bool {
        self.peers.is_empty()
    }
}

/// Gestionnaire global des rooms
pub struct RoomManager {
    rooms: DashMap<String, Arc<Room>>,
    /// index peer_id → room_id pour accès rapide
    peer_room_index: DashMap<String, String>,
}

impl RoomManager {
    pub fn new() -> Self {
        RoomManager {
            rooms: DashMap::new(),
            peer_room_index: DashMap::new(),
        }
    }

    /// Crée ou rejoint une room
    pub fn join_room(&self, room_id: &str, peer: RoomPeer) -> Vec<String> {
        let peer_id = peer.peer_id.clone();

        let room = self
            .rooms
            .entry(room_id.to_string())
            .or_insert_with(|| Arc::new(Room::new(room_id.to_string())))
            .clone();

        self.peer_room_index.insert(peer_id, room_id.to_string());

        room.add_peer(peer)
    }

    /// Retire un peer de sa room
    pub fn leave_room(&self, peer_id: &str) {
        if let Some((_, room_id)) = self.peer_room_index.remove(peer_id) {
            if let Some(room) = self.rooms.get(&room_id) {
                room.remove_peer(peer_id);
                if room.is_empty() {
                    drop(room);
                    self.rooms.remove(&room_id);
                    tracing::info!("Room {} supprimée", room_id);
                }
            }
        }
    }

    /// Envoie un message à un peer spécifique
    pub fn send_to(&self, peer_id: &str, msg: ServerMessage) {
        if let Some(room_id) = self.peer_room_index.get(peer_id) {
            if let Some(room) = self.rooms.get(room_id.as_str()) {
                room.send_to(peer_id, msg);
            }
        }
    }

    /// Retourne la room d'un peer
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
