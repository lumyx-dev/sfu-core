//! Renegotiation: keeps every peer's outbound m-lines in step with what its
//! room publishes.
//!
//! # Why a dedicated component
//!
//! Subscribing a peer to a track is not a routing decision, it is an SDP round
//! trip: the SFU has to allocate an m-line on that peer's connection, offer it,
//! and wait for the answer before a single packet can go out. That cannot
//! happen on the forwarding path, which is synchronous and must not await
//! anything.
//!
//! So the media layer only ever learns about subscriptions that already exist
//! ([`ForwardingEngine::subscribe`]), and everything leading up to them lives
//! here.
//!
//! # Why a single task
//!
//! Renegotiation is a state machine with one hard rule — one offer in flight
//! per peer, or str0m rejects the answer. Two publishers appearing in the same
//! millisecond would race for that slot. Serialising every event through one
//! task removes the race outright; the work per event is a lock plus an SDP
//! build, never a network wait, so nothing queues up behind it.

use super::messages::ServerMessage;
use crate::media::{ForwardingEngine, TrackKey};
use crate::transport::PeerConnection;
use dashmap::DashMap;
use std::sync::Arc;
use std::time::Duration;
use str0m::media::{MediaKind, Mid};
use tokio::sync::Mutex;
use tokio::sync::mpsc;

/// Depth of the negotiation event queue.
///
/// These events are rare — a track appearing, a peer joining or leaving, an
/// answer coming back — and none of them may be dropped: a lost event means a
/// participant nobody ever sees. The queue is sized well above any plausible
/// burst (a full room reconnecting at once) and saturating it is logged as an
/// error rather than swallowed.
const EVENT_QUEUE_CAPACITY: usize = 1024;

/// How long a re-offer may wait for room in a peer's signaling channel.
///
/// Generous next to the channel's depth of 100 messages, and finite next to the
/// alternative: one peer that stopped reading would otherwise hold the single
/// negotiation task forever.
const OFFER_SEND_TIMEOUT: Duration = Duration::from_secs(5);

/// What the negotiator reacts to.
#[derive(Debug)]
pub enum NegotiationEvent {
    /// A peer started publishing a track.
    TrackPublished {
        peer: Arc<str>,
        mid: Mid,
        kind: MediaKind,
    },
    /// A peer joined a room — in both directions: it must receive what the
    /// room publishes, and the room must receive what it already publishes.
    PeerJoined { peer: Arc<str>, room_id: String },
    /// A peer answered one of the SFU's re-offers.
    AnswerReceived { peer: Arc<str>, sdp: String },
    /// A peer asked for a keyframe on an m-line the SFU sends it.
    KeyframeRequested { peer: Arc<str>, mid: Mid },
    /// A peer left its room, or disconnected.
    PeerLeft { peer: Arc<str> },
}

/// A peer, as the negotiator needs to reach it.
struct PeerHandle {
    conn: Arc<Mutex<PeerConnection>>,
    signaling: mpsc::Sender<ServerMessage>,
}

/// Drives the SDP renegotiation of every connected peer.
pub struct Negotiator {
    engine: Arc<ForwardingEngine>,
    peers: DashMap<Arc<str>, PeerHandle>,
    events: mpsc::Sender<NegotiationEvent>,
}

impl Negotiator {
    /// Creates the negotiator and starts the task that drains its queue.
    ///
    /// Must be called from within a Tokio runtime.
    pub fn new(engine: Arc<ForwardingEngine>) -> Arc<Self> {
        let (events, rx) = mpsc::channel(EVENT_QUEUE_CAPACITY);

        let negotiator = Arc::new(Negotiator {
            engine,
            peers: DashMap::new(),
            events,
        });

        tokio::spawn(Arc::clone(&negotiator).run(rx));
        negotiator
    }

    /// Makes a peer reachable for renegotiation. Called once its WebRTC
    /// connection exists, before it joins any room.
    pub fn register(
        &self,
        peer: Arc<str>,
        conn: Arc<Mutex<PeerConnection>>,
        signaling: mpsc::Sender<ServerMessage>,
    ) {
        self.peers.insert(peer, PeerHandle { conn, signaling });
    }

    pub fn unregister(&self, peer: &str) {
        self.peers.remove(peer);
    }

    /// Queues an event. Never blocks: called from synchronous paths.
    pub fn notify(&self, event: NegotiationEvent) {
        if let Err(e) = self.events.try_send(event) {
            tracing::error!("Négociation — événement perdu : {}", e);
        }
    }

    async fn run(self: Arc<Self>, mut rx: mpsc::Receiver<NegotiationEvent>) {
        while let Some(event) = rx.recv().await {
            self.handle(event).await;
        }
        tracing::debug!("Négociation — task terminée");
    }

    async fn handle(&self, event: NegotiationEvent) {
        match event {
            NegotiationEvent::TrackPublished { peer, mid, kind } => {
                let key = TrackKey::new(Arc::clone(&peer), mid);
                self.engine
                    .publish_track(key.clone(), kind == MediaKind::Video);

                // A track published before its peer joined a room reaches
                // nobody yet; `PeerJoined` picks it up from the engine later.
                let Some(room_id) = self.engine.room_of(&peer) else {
                    return;
                };

                for subscriber in self.engine.peers_in_room(&room_id) {
                    if subscriber == peer {
                        continue;
                    }
                    self.want(&subscriber, key.clone(), kind).await;
                    self.drive(&subscriber).await;
                }
            }

            NegotiationEvent::PeerJoined { peer, room_id } => {
                // Both directions at once: the newcomer subscribes to the room,
                // and the room subscribes to whatever the newcomer already
                // publishes — `MediaAdded` can perfectly well have fired before
                // the `Join` message was handled.
                for (key, is_video) in self.engine.tracks_in_room(&room_id) {
                    let kind = kind_of(is_video);

                    if key.peer_id == peer {
                        for subscriber in self.engine.peers_in_room(&room_id) {
                            if subscriber == peer {
                                continue;
                            }
                            self.want(&subscriber, key.clone(), kind).await;
                            self.drive(&subscriber).await;
                        }
                    } else {
                        self.want(&peer, key, kind).await;
                    }
                }

                self.drive(&peer).await;
            }

            NegotiationEvent::AnswerReceived { peer, sdp } => {
                let Some(handle) = self.peers.get(&peer) else {
                    return;
                };
                let conn = Arc::clone(&handle.conn);
                drop(handle);

                let live = match conn.lock().await.accept_answer(&sdp) {
                    Ok(live) => live,
                    Err(e) => {
                        tracing::warn!("Peer {} — answer refusée : {}", peer, e);
                        return;
                    }
                };

                for (key, target_mid) in live {
                    if self.engine.subscribe(&key, &peer, target_mid) {
                        // The subscriber joined mid-stream: without a keyframe
                        // it decodes nothing until the publisher happens to
                        // emit one.
                        self.ask_keyframe(&key).await;
                        continue;
                    }

                    // The source left while its m-line was being negotiated.
                    // Closing it now is what keeps a departure from leaving a
                    // dead m-line behind for the rest of the session.
                    tracing::info!("Peer {} — source {} disparue, m-line fermée", peer, key);
                    conn.lock().await.drop_source(&key.peer_id);
                }

                // Anything that piled up while this offer was in flight — new
                // subscriptions, and the m-lines just orphaned above.
                self.drive(&peer).await;
            }

            NegotiationEvent::KeyframeRequested { peer, mid } => {
                // The SFU has no encoder: the request belongs to whoever
                // publishes the source served on that m-line.
                let Some(handle) = self.peers.get(&peer) else {
                    return;
                };
                let conn = Arc::clone(&handle.conn);
                drop(handle);

                let source = conn.lock().await.source_on(mid);
                if let Some(key) = source {
                    self.ask_keyframe(&key).await;
                }
            }

            NegotiationEvent::PeerLeft { peer } => {
                // The engine has already forgotten the peer by the time this is
                // handled, so the room is read from the remaining peers: every
                // connection that held one of its m-lines has to close it.
                //
                // The list is snapshotted before the loop, and that is not a
                // detail: a `DashMap` iterator holds a shard lock for as long as
                // it lives, and the body of this loop awaits — on the peer's
                // mutex, then on `drive`, which reads the same map. Iterating in
                // place deadlocks the negotiation task, and a deadlocked
                // negotiation task means no peer is ever wired again for the
                // rest of the server's life.
                let others = self.snapshot_except(&peer);

                for (subscriber, conn) in others {
                    if conn.lock().await.drop_source(&peer) {
                        self.drive(&subscriber).await;
                    }
                }
            }
        }
    }

    /// Every registered peer but one, as owned handles.
    ///
    /// See the note in the `PeerLeft` arm: nothing may hold a `DashMap`
    /// iterator across an `await` in this file.
    fn snapshot_except(&self, excluded: &Arc<str>) -> Vec<(Arc<str>, Arc<Mutex<PeerConnection>>)> {
        self.peers
            .iter()
            .filter(|entry| entry.key() != excluded)
            .map(|entry| (Arc::clone(entry.key()), Arc::clone(&entry.value().conn)))
            .collect()
    }

    /// Records that `subscriber` should receive `key`.
    async fn want(&self, subscriber: &Arc<str>, key: TrackKey, kind: MediaKind) {
        let Some(handle) = self.peers.get(subscriber) else {
            return;
        };
        let conn = Arc::clone(&handle.conn);
        drop(handle);

        conn.lock().await.queue_subscription(key, kind);
    }

    /// Sends the re-offer covering everything queued on that peer, if any.
    async fn drive(&self, subscriber: &Arc<str>) {
        let Some(handle) = self.peers.get(subscriber) else {
            return;
        };
        let conn = Arc::clone(&handle.conn);
        let signaling = handle.signaling.clone();
        drop(handle);

        let Some(sdp) = conn.lock().await.negotiate() else {
            return;
        };

        // Bounded on purpose. This is the only task negotiating for the whole
        // server, so an unbounded `send().await` would let one peer that has
        // stopped reading its signaling channel stall every other peer's
        // subscriptions — indefinitely, and silently.
        let sent = tokio::time::timeout(
            OFFER_SEND_TIMEOUT,
            signaling.send(ServerMessage::SfuOffer { sdp }),
        )
        .await;

        match sent {
            Ok(Ok(())) => {}
            Ok(Err(_)) => {
                tracing::debug!("Peer {} — re-offer non transmise, session fermée", subscriber)
            }
            Err(_) => tracing::error!(
                "Peer {} — canal de signaling bloqué, re-offer abandonnée",
                subscriber
            ),
        }
    }

    /// Asks a track's publisher for a keyframe.
    async fn ask_keyframe(&self, key: &TrackKey) {
        if let Some(sink) = self.engine.sink_of(&key.peer_id) {
            sink.request_keyframe(key.mid);
        }
    }
}

fn kind_of(is_video: bool) -> MediaKind {
    if is_video {
        MediaKind::Video
    } else {
        MediaKind::Audio
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::media::{RtpPacketData, RtpSink};
    use str0m::media::Mid;

    /// A sink that swallows everything: these tests are about the negotiation
    /// task's liveness, not about media.
    struct NullSink;

    impl RtpSink for NullSink {
        fn write_rtp(&self, _packet: RtpPacketData) {}
        fn request_keyframe(&self, _mid: Mid) {}
    }

    struct Harness {
        negotiator: Arc<Negotiator>,
        engine: Arc<ForwardingEngine>,
        signaling: Vec<mpsc::Receiver<ServerMessage>>,
        peers: Vec<Arc<str>>,
    }

    impl Harness {
        async fn with_peers(count: usize, room: &str) -> Self {
            let engine = ForwardingEngine::new();
            let mut h = Harness {
                negotiator: Negotiator::new(engine.clone()),
                engine,
                signaling: Vec::new(),
                peers: Vec::new(),
            };
            for _ in 0..count {
                h.join(room).await;
            }
            h
        }

        /// Adds one peer to a room, on the same negotiator.
        async fn join(&mut self, room: &str) -> usize {
            let index = self.peers.len();
            let peer: Arc<str> = Arc::from(format!("peer-{index}").as_str());
            let (tx, rx) = mpsc::channel(64);
            let conn = Arc::new(Mutex::new(
                PeerConnection::new(Arc::clone(&peer), tx.clone(), "127.0.0.1".into()).await,
            ));

            self.negotiator.register(Arc::clone(&peer), conn, tx);
            self.engine
                .add_peer(room.to_string(), Arc::clone(&peer), Arc::new(NullSink));

            self.signaling.push(rx);
            self.peers.push(peer);
            index
        }

        /// Takes a peer out, in the exact order `handle_socket` does on
        /// teardown: the departure is queued, then the peer is unregistered.
        ///
        /// That order is the whole point. `unregister` takes a write lock on
        /// the peer map while the negotiator may still be walking it, and the
        /// deadlock only appears when the two meet.
        fn leave(&self, index: usize) {
            self.engine.remove_peer(&self.peers[index]);
            self.negotiator.notify(NegotiationEvent::PeerLeft {
                peer: Arc::clone(&self.peers[index]),
            });
            self.negotiator.unregister(&self.peers[index]);
        }

        /// Waits for a peer to be offered something, or gives up.
        ///
        /// The negotiator runs in its own task, so the assertion has to be
        /// "eventually" rather than "now"; the timeout is what turns a
        /// deadlocked task into a failure instead of a hang.
        async fn expect_offer(&mut self, index: usize) -> bool {
            let deadline = std::time::Instant::now() + Duration::from_secs(2);
            while std::time::Instant::now() < deadline {
                if let Ok(ServerMessage::SfuOffer { .. }) = self.signaling[index].try_recv() {
                    return true;
                }
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
            false
        }
    }

    #[tokio::test]
    async fn a_published_track_makes_the_others_be_offered_an_m_line() {
        let mut h = Harness::with_peers(2, "standup").await;

        h.negotiator.notify(NegotiationEvent::TrackPublished {
            peer: Arc::clone(&h.peers[0]),
            mid: Mid::from("1"),
            kind: MediaKind::Video,
        });

        assert!(h.expect_offer(1).await, "peer-1 doit recevoir une re-offer");
    }

    #[tokio::test]
    async fn a_departure_does_not_wedge_the_negotiation_task() {
        // The regression: `PeerLeft` used to walk the peer map in place, and
        // the loop body awaits on that same map. The task deadlocked on the
        // first departure and never wired another peer for the rest of the
        // server's life — which only showed up, runs later, as "everybody
        // joins, nobody sees anybody".
        let mut h = Harness::with_peers(3, "standup").await;

        h.leave(2);

        // The task must still be alive to serve what comes next.
        h.negotiator.notify(NegotiationEvent::TrackPublished {
            peer: Arc::clone(&h.peers[0]),
            mid: Mid::from("1"),
            kind: MediaKind::Video,
        });

        assert!(
            h.expect_offer(1).await,
            "la task de négociation doit survivre à un départ"
        );
    }

    /// Wide enough that a departure walking the peer map in place is bound to
    /// hit a shard it already holds. The bug is a lock collision, so a handful
    /// of peers reproduces it only by luck.
    const CROWD: usize = 40;

    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn a_room_emptying_does_not_wedge_the_negotiation_task() {
        // The shape of the bug in the wild: a full room disconnects at once,
        // and the next room to open finds a negotiator that no longer answers.
        //
        // Multi-threaded and concurrent on purpose. The deadlock needs
        // `unregister`'s write lock to land while the negotiation task is
        // walking the same map, which never happens if the departures are
        // sequential and the task only runs between them.
        let mut h = Harness::with_peers(CROWD, "standup").await;

        let mut departures = tokio::task::JoinSet::new();
        for index in 0..CROWD {
            let negotiator = Arc::clone(&h.negotiator);
            let engine = Arc::clone(&h.engine);
            let peer = Arc::clone(&h.peers[index]);
            departures.spawn(async move {
                engine.remove_peer(&peer);
                negotiator.notify(NegotiationEvent::PeerLeft {
                    peer: Arc::clone(&peer),
                });
                negotiator.unregister(&peer);
            });
        }
        // A timeout, not a plain await: with the bug in place `unregister`
        // blocks on the shard the negotiation task is holding, and the test
        // would hang instead of failing.
        tokio::time::timeout(Duration::from_secs(10), departures.join_all())
            .await
            .expect("les départs ne doivent pas se bloquer sur la map des peers");

        let a = h.join("retro").await;
        let b = h.join("retro").await;

        h.negotiator.notify(NegotiationEvent::TrackPublished {
            peer: Arc::clone(&h.peers[a]),
            mid: Mid::from("1"),
            kind: MediaKind::Video,
        });

        assert!(
            h.expect_offer(b).await,
            "la room suivante doit encore être négociée"
        );
    }
}
