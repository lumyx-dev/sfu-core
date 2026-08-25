use serde::{Deserialize, Serialize};

/// Messages entrants — client → serveur
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientMessage {
    Join {
        room_id: String,
        peer_id: String,
    },
    Offer {
        sdp: String,
    },
    Answer {
        sdp: String,
        target_peer_id: String,
    },
    IceCandidate {
        candidate: String,
        target_peer_id: String,
    },
    SfuOffer {
        sdp: String,
    },
    SfuIceCandidate {
        candidate: String,
    },
    Leave,
}

/// Messages sortants — serveur → client
#[derive(Debug, Serialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMessage {
    // Connexion établie
    Connected {
        peer_id: String,
    },
    // Confirmation de join
    JoinedRoom {
        room_id: String,
        peers: Vec<String>, // peer_ids déjà présents
    },
    // Nouveau peer dans la room
    PeerJoined {
        peer_id: String,
    },
    // Peer parti
    PeerLeft {
        peer_id: String,
    },
    // SDP answer du serveur SFU
    SfuAnswer {
        sdp: String,
    },
    // Offer relayée d'un autre peer
    Offer {
        sdp: String,
        from_peer_id: String,
    },
    SfuOffer {
        sdp: String,
    },
    SfuIceCandidate {
        candidate: String,
    },
    // Erreur
    Error {
        message: String,
    },
}
