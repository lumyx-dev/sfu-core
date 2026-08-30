//! Handling of a single client message.

use super::messages::{ClientMessage, ServerMessage};
use super::negotiation::NegotiationEvent;
use crate::app::AppState;
use crate::media::RtpSink;
use crate::room::RoomPeer;
use crate::telemetry::{Entry, EventKind, EventRecord};
use crate::transport::PeerConnection;
use std::sync::Arc;
use tokio::sync::{Mutex, mpsc};

/// Applies a message received from the client.
///
/// `tx` is the sending peer's signaling channel; `conn` its WebRTC connection;
/// `sink` the destination of its RTP packets, handed to the forwarding engine
/// on `Join`.
pub async fn handle_message(
    msg: ClientMessage,
    peer_id: &Arc<str>,
    tx: &mpsc::Sender<ServerMessage>,
    state: &AppState,
    conn: &Arc<Mutex<PeerConnection>>,
    sink: &Arc<dyn RtpSink>,
) {
    match msg {
        ClientMessage::Join { room_id, .. } => {
            let outcome = state.rooms.join_room(
                &room_id,
                RoomPeer {
                    peer_id: peer_id.to_string(),
                    sender: tx.clone(),
                },
            );

            // Le cycle de vie n'est enregistré que si le peer_id est un uuid — il l'est
            // toujours, `http/ws.rs` le génère. La télémétrie ne peut pas casser une session.
            if let Some(peer_uuid) = crate::telemetry::peer_uuid(peer_id) {
                let now = chrono::Utc::now();

                // Un changement de room ferme la précédente à l'intérieur même
                // de `join_room` ; ce départ ne passe jamais par le teardown de
                // `session.rs`, donc c'est ici ou nulle part qu'il faut
                // l'enregistrer (Task 6 review, finding 1.2).
                if let Some(previous) = &outcome.previous {
                    state.telemetry.record_departure(
                        previous.peer_session,
                        previous.room_session,
                        previous.room_dropped,
                        now,
                    );
                }

                state.telemetry.set_occupancy(peer_uuid, outcome.peer_session);

                if outcome.room_created {
                    state.telemetry.record(Entry::RoomOpened {
                        id: outcome.room_session,
                        name: room_id.to_string(),
                        at: now,
                    });
                    state.telemetry.record(Entry::Event(
                        EventRecord::new(EventKind::RoomCreated, now).room(outcome.room_session),
                    ));
                }
                state.telemetry.record(Entry::PeerJoined {
                    id: outcome.peer_session,
                    peer_id: peer_uuid,
                    room_id: outcome.room_session,
                    at: now,
                });
                state.telemetry.record(Entry::Event(
                    EventRecord::new(EventKind::PeerJoined, now)
                        .room(outcome.room_session)
                        .peer(outcome.peer_session),
                ));
            }

            // Forwarding is scoped to the room: the peer only becomes
            // reachable here, and only to the members of that room.
            state
                .engine
                .add_peer(room_id.clone(), Arc::clone(peer_id), sink.clone());

            let _ = tx
                .send(ServerMessage::JoinedRoom {
                    room_id: room_id.clone(),
                    peers: outcome.occupants,
                })
                .await;

            // Both directions of the wiring — what the room already publishes,
            // and what this peer may already be publishing — are the
            // negotiator's job.
            state.negotiator.notify(NegotiationEvent::PeerJoined {
                peer: Arc::clone(peer_id),
                room_id,
            });

            tracing::info!("Peer {} a rejoint la room", peer_id);
        }

        ClientMessage::SfuOffer { sdp } => {
            tracing::info!("Peer {} — SFU offer reçue", peer_id);

            // Bound in a `let` before the `match`: a scrutinee's temporary
            // `MutexGuard` lives until the end of the `match` expression, which
            // would keep the `PeerConnection` locked during logging and while
            // sending the reply. Here it drops at the end of this line.
            // (Clippy: `significant_drop_in_scrutinee`.)
            let outcome = conn.lock().await.handle_offer(&sdp);

            match outcome {
                Ok(_) => tracing::info!("Peer {} — offer traitée ✅", peer_id),
                Err(e) => {
                    tracing::error!("Peer {} — erreur offer : {}", peer_id, e);
                    let _ = tx
                        .send(ServerMessage::Error {
                            message: format!("Erreur offer : {}", e),
                        })
                        .await;
                }
            }
        }

        ClientMessage::SfuAnswer { sdp } => {
            // Applied by the negotiator rather than here: it is the step that
            // turns queued subscriptions into live down_tracks, and it has to
            // stay ordered with respect to every other negotiation event.
            state.negotiator.notify(NegotiationEvent::AnswerReceived {
                peer: Arc::clone(peer_id),
                sdp,
            });
        }

        ClientMessage::SfuIceCandidate { candidate } => {
            tracing::debug!("Peer {} — ICE candidate reçu", peer_id);
            conn.lock().await.add_remote_candidate(&candidate);
        }

        ClientMessage::Leave => {
            let departure = state.rooms.leave_room(peer_id);

            // Contrairement à ce que le rapport de la Task 6 supposait, la
            // connexion qui reste ouverte n'empêche pas l'*occupation* de se
            // terminer : c'est elle que la ligne `telemetry.peers` représente
            // depuis la Task 6 review (finding 3), pas la connexion. Un
            // `leave` explicite ferme donc bien le peer et ses tracks, comme
            // le teardown de session.rs ; seule la connexion survit, pour un
            // éventuel `Join` suivant qui ouvrira une occupation neuve.
            if let Some(peer_uuid) = crate::telemetry::peer_uuid(peer_id) {
                let _ = state.telemetry.clear_occupancy(peer_uuid);
                if let Some(d) = &departure {
                    state.telemetry.record_departure(
                        d.peer_session,
                        d.room_session,
                        d.room_dropped,
                        chrono::Utc::now(),
                    );
                }
            }

            state.engine.remove_peer(peer_id);
            state.negotiator.notify(NegotiationEvent::PeerLeft {
                peer: Arc::clone(peer_id),
            });
            tracing::info!("Peer {} a quitté la room", peer_id);
        }

        // --- P2P relay, inherited from the mesh mode ---
        // Kept for client compatibility; the SFU does not depend on it.
        ClientMessage::Answer {
            sdp,
            target_peer_id,
        } => {
            state.rooms.send_to(
                &target_peer_id,
                ServerMessage::Offer {
                    sdp,
                    from_peer_id: peer_id.to_string(),
                },
            );
        }

        ClientMessage::Offer { .. } => {
            tracing::debug!("Peer {} — offer P2P reçue", peer_id);
        }

        ClientMessage::IceCandidate { target_peer_id, .. } => {
            tracing::debug!("Peer {} — ICE candidate pour {}", peer_id, target_peer_id);
        }
    }
}

#[cfg(test)]
mod tests {
    //! `MemorySink` behind `AppState.telemetry`, driving the real
    //! `handle_message` — not a reimplementation of its logic — so a swapped
    //! id or a reordering in the `Join`/`Leave` wiring fails a test instead of
    //! silently passing the rest of the suite (Task 6 review, finding 2).

    use super::*;
    use crate::app::AppState;
    use crate::config::Config;
    use crate::media::RtpPacketData;
    use crate::telemetry::{Entry, EventKind, MemorySink, Telemetry};
    use str0m::media::Mid;
    use uuid::Uuid;

    struct NullSink;

    impl RtpSink for NullSink {
        fn write_rtp(&self, _packet: RtpPacketData) {}
        fn request_keyframe(&self, _mid: Mid) {}
    }

    /// An `AppState` wired to a drainable sink instead of the production
    /// `NoopSink`.
    fn state_with_memory_sink() -> (AppState, Arc<MemorySink>) {
        let mut state = AppState::new(Config::default());
        let sink = Arc::new(MemorySink::new());
        state.telemetry = Telemetry::new(sink.clone());
        (state, sink)
    }

    /// A real `PeerConnection` — an ephemeral UDP bind, no actual signaling —
    /// because `handle_message`'s signature demands one even though the
    /// `Join`/`Leave` arms never touch it. Same pattern as
    /// `negotiation::tests::Harness`.
    async fn a_connection(
        peer_id: &Arc<str>,
    ) -> (
        Arc<Mutex<PeerConnection>>,
        mpsc::Sender<ServerMessage>,
        mpsc::Receiver<ServerMessage>,
    ) {
        let (tx, rx) = mpsc::channel(16);
        let conn = Arc::new(Mutex::new(
            PeerConnection::new(Arc::clone(peer_id), tx.clone(), "127.0.0.1".into()).await,
        ));
        (conn, tx, rx)
    }

    fn a_peer() -> Arc<str> {
        Arc::from(Uuid::new_v4().to_string().as_str())
    }

    async fn join(
        state: &AppState,
        peer_id: &Arc<str>,
        tx: &mpsc::Sender<ServerMessage>,
        conn: &Arc<Mutex<PeerConnection>>,
        sink: &Arc<dyn RtpSink>,
        room_id: &str,
    ) {
        handle_message(
            ClientMessage::Join {
                room_id: room_id.to_string(),
                peer_id: peer_id.to_string(),
            },
            peer_id,
            tx,
            state,
            conn,
            sink,
        )
        .await;
    }

    #[tokio::test]
    async fn joining_emits_room_opened_then_peer_joined_in_order() {
        let (state, sink) = state_with_memory_sink();
        let peer_id = a_peer();
        let peer_uuid: Uuid = peer_id.parse().unwrap();
        let (conn, tx, _rx) = a_connection(&peer_id).await;
        let rtp_sink: Arc<dyn RtpSink> = Arc::new(NullSink);

        join(&state, &peer_id, &tx, &conn, &rtp_sink, "salon").await;

        let entries = sink.drain();
        assert_eq!(entries.len(), 4);
        let room_session = match &entries[0] {
            Entry::RoomOpened { id, name, .. } => {
                assert_eq!(name, "salon");
                *id
            }
            other => panic!("attendu RoomOpened en 1re position, reçu {other:?}"),
        };
        assert!(matches!(&entries[1], Entry::Event(e) if e.kind == EventKind::RoomCreated));
        match &entries[2] {
            Entry::PeerJoined { id, peer_id: pid, room_id, .. } => {
                assert_eq!(*pid, peer_uuid, "peer_id doit être la connexion");
                assert_ne!(*id, *pid, "id doit être une occupation, distincte de la connexion");
                assert_eq!(*room_id, room_session);
            }
            other => panic!("attendu PeerJoined en 3e position, reçu {other:?}"),
        }
        assert!(matches!(&entries[3], Entry::Event(e) if e.kind == EventKind::PeerJoined));
    }

    #[tokio::test]
    async fn a_second_peer_joining_does_not_reopen_the_room() {
        let (state, sink) = state_with_memory_sink();

        let alice_id = a_peer();
        let (alice_conn, alice_tx, _alice_rx) = a_connection(&alice_id).await;
        let bob_id = a_peer();
        let (bob_conn, bob_tx, _bob_rx) = a_connection(&bob_id).await;
        let rtp_sink: Arc<dyn RtpSink> = Arc::new(NullSink);

        join(&state, &alice_id, &alice_tx, &alice_conn, &rtp_sink, "salon").await;
        sink.drain();

        join(&state, &bob_id, &bob_tx, &bob_conn, &rtp_sink, "salon").await;

        let entries = sink.drain();
        assert_eq!(entries.len(), 2, "pas de RoomOpened : bob rejoint une room déjà ouverte");
        assert!(matches!(entries[0], Entry::PeerJoined { .. }));
        assert!(matches!(&entries[1], Entry::Event(e) if e.kind == EventKind::PeerJoined));
    }

    #[tokio::test]
    async fn leaving_the_last_peer_closes_the_room() {
        // Régression directe de la finding 1.1 : avant ce correctif, le
        // `Leave` explicite jetait le `LeaveOutcome` avec `let _ =` et
        // `RoomClosed` ne partait jamais pour cette room.
        let (state, sink) = state_with_memory_sink();
        let peer_id = a_peer();
        let (conn, tx, _rx) = a_connection(&peer_id).await;
        let rtp_sink: Arc<dyn RtpSink> = Arc::new(NullSink);

        join(&state, &peer_id, &tx, &conn, &rtp_sink, "salon").await;
        sink.drain();

        handle_message(ClientMessage::Leave, &peer_id, &tx, &state, &conn, &rtp_sink).await;

        let entries = sink.drain();
        assert_eq!(entries.len(), 4);
        assert!(matches!(entries[0], Entry::PeerLeft { .. }));
        assert!(matches!(&entries[1], Entry::Event(e) if e.kind == EventKind::PeerLeft));
        assert!(matches!(entries[2], Entry::RoomClosed { .. }));
        assert!(matches!(&entries[3], Entry::Event(e) if e.kind == EventKind::RoomEnded));
    }

    #[tokio::test]
    async fn leaving_while_occupants_remain_does_not_close_the_room() {
        let (state, sink) = state_with_memory_sink();
        let alice_id = a_peer();
        let (alice_conn, alice_tx, _alice_rx) = a_connection(&alice_id).await;
        let bob_id = a_peer();
        let (bob_conn, bob_tx, _bob_rx) = a_connection(&bob_id).await;
        let rtp_sink: Arc<dyn RtpSink> = Arc::new(NullSink);

        join(&state, &alice_id, &alice_tx, &alice_conn, &rtp_sink, "salon").await;
        join(&state, &bob_id, &bob_tx, &bob_conn, &rtp_sink, "salon").await;
        sink.drain();

        handle_message(ClientMessage::Leave, &alice_id, &alice_tx, &state, &alice_conn, &rtp_sink)
            .await;

        let entries = sink.drain();
        assert_eq!(entries.len(), 2, "la room survit grâce à bob : pas de RoomClosed");
        assert!(matches!(entries[0], Entry::PeerLeft { .. }));
        assert!(matches!(&entries[1], Entry::Event(e) if e.kind == EventKind::PeerLeft));
    }

    #[tokio::test]
    async fn switching_rooms_closes_the_room_left_behind_before_opening_the_new_one() {
        // Régression directe de la finding 1.2 : avant ce correctif, le
        // `leave_room` interne à `join_room` avait son résultat jeté avec
        // `let _ =`, et room-a ne se refermait jamais.
        let (state, sink) = state_with_memory_sink();
        let peer_id = a_peer();
        let (conn, tx, _rx) = a_connection(&peer_id).await;
        let rtp_sink: Arc<dyn RtpSink> = Arc::new(NullSink);

        join(&state, &peer_id, &tx, &conn, &rtp_sink, "room-a").await;
        sink.drain();

        join(&state, &peer_id, &tx, &conn, &rtp_sink, "room-b").await;

        let entries = sink.drain();
        assert_eq!(entries.len(), 8);
        assert!(matches!(entries[0], Entry::PeerLeft { .. }), "départ de room-a");
        assert!(matches!(&entries[1], Entry::Event(e) if e.kind == EventKind::PeerLeft));
        assert!(matches!(entries[2], Entry::RoomClosed { .. }), "room-a se vide");
        assert!(matches!(&entries[3], Entry::Event(e) if e.kind == EventKind::RoomEnded));
        assert!(matches!(entries[4], Entry::RoomOpened { .. }), "room-b s'ouvre");
        assert!(matches!(&entries[5], Entry::Event(e) if e.kind == EventKind::RoomCreated));
        assert!(matches!(entries[6], Entry::PeerJoined { .. }));
        assert!(matches!(&entries[7], Entry::Event(e) if e.kind == EventKind::PeerJoined));
    }
}
