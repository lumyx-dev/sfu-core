//! Protocole de signaling, sérialisé en JSON avec un champ discriminant `type`.

use serde::{Deserialize, Serialize};

/// Client → serveur.
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientMessage {
    Join {
        room_id: String,
        peer_id: String,
    },
    /// Offer SDP à destination du SFU.
    SfuOffer {
        sdp: String,
    },
    /// Candidat ICE à destination du SFU.
    SfuIceCandidate {
        candidate: String,
    },
    Leave,

    // --- Relais P2P, hérité du mode maillé ---
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
}

/// Serveur → client.
#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMessage {
    /// Session WebSocket établie, peer_id attribué.
    Connected {
        peer_id: String,
    },
    /// Room rejointe, avec les peers déjà présents.
    JoinedRoom {
        room_id: String,
        peers: Vec<String>,
    },
    PeerJoined {
        peer_id: String,
    },
    PeerLeft {
        peer_id: String,
    },
    /// Answer SDP du SFU.
    SfuAnswer {
        sdp: String,
    },
    SfuOffer {
        sdp: String,
    },
    SfuIceCandidate {
        candidate: String,
    },
    /// Offer relayée d'un autre peer (mode maillé).
    Offer {
        sdp: String,
        from_peer_id: String,
    },
    Error {
        message: String,
    },
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(json: &str) -> ClientMessage {
        serde_json::from_str(json).expect("message client valide")
    }

    #[test]
    fn join_is_tagged_snake_case() {
        let msg = parse(r#"{"type":"join","room_id":"standup","peer_id":"alice"}"#);
        match msg {
            ClientMessage::Join { room_id, peer_id } => {
                assert_eq!(room_id, "standup");
                assert_eq!(peer_id, "alice");
            }
            other => panic!("attendu Join, reçu {:?}", other),
        }
    }

    #[test]
    fn sfu_offer_and_candidate_parse() {
        assert!(matches!(
            parse(r#"{"type":"sfu_offer","sdp":"v=0"}"#),
            ClientMessage::SfuOffer { .. }
        ));
        assert!(matches!(
            parse(r#"{"type":"sfu_ice_candidate","candidate":"candidate:1 1 udp"}"#),
            ClientMessage::SfuIceCandidate { .. }
        ));
    }

    #[test]
    fn leave_is_a_unit_variant() {
        assert!(matches!(parse(r#"{"type":"leave"}"#), ClientMessage::Leave));
    }

    #[test]
    fn unknown_type_is_rejected() {
        assert!(serde_json::from_str::<ClientMessage>(r#"{"type":"nope"}"#).is_err());
    }

    #[test]
    fn missing_field_is_rejected() {
        assert!(serde_json::from_str::<ClientMessage>(r#"{"type":"join","room_id":"r"}"#).is_err());
    }

    #[test]
    fn server_messages_serialize_with_a_type_tag() {
        let json = serde_json::to_string(&ServerMessage::Connected {
            peer_id: "alice".into(),
        })
        .unwrap();
        assert_eq!(json, r#"{"type":"connected","peer_id":"alice"}"#);

        let json = serde_json::to_string(&ServerMessage::JoinedRoom {
            room_id: "standup".into(),
            peers: vec!["bob".into()],
        })
        .unwrap();
        assert_eq!(
            json,
            r#"{"type":"joined_room","room_id":"standup","peers":["bob"]}"#
        );
    }

    #[test]
    fn sfu_answer_uses_the_snake_case_tag_the_client_expects() {
        let json = serde_json::to_string(&ServerMessage::SfuAnswer { sdp: "v=0".into() }).unwrap();
        assert_eq!(json, r#"{"type":"sfu_answer","sdp":"v=0"}"#);
    }
}
