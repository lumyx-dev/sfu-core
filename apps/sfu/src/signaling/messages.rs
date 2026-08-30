//! Signaling protocol, serialized to JSON with a `type` discriminant field.

use serde::{Deserialize, Serialize};

/// Client → server.
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientMessage {
    Join {
        room_id: String,
        peer_id: String,
    },
    /// SDP offer addressed to the SFU.
    SfuOffer {
        sdp: String,
    },
    /// SDP answer to a re-offer the SFU sent.
    ///
    /// The SFU offers whenever the room gains or loses a published track: each
    /// one needs its own outbound m-line on every other peer.
    SfuAnswer {
        sdp: String,
    },
    /// ICE candidate addressed to the SFU.
    SfuIceCandidate {
        candidate: String,
    },
    Leave,

    // --- P2P relay, inherited from the mesh mode ---
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

/// Server → client.
#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMessage {
    /// WebSocket session established, peer_id assigned.
    Connected {
        peer_id: String,
    },
    /// Room joined, with the peers already present.
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
    /// SDP answer from the SFU.
    SfuAnswer {
        sdp: String,
    },
    SfuOffer {
        sdp: String,
    },
    SfuIceCandidate {
        candidate: String,
    },
    /// Offer relayed from another peer (mesh mode).
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
    fn sfu_answer_parses() {
        assert!(matches!(
            parse(r#"{"type":"sfu_answer","sdp":"v=0"}"#),
            ClientMessage::SfuAnswer { .. }
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
