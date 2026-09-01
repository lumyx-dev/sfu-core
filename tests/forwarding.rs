//! Tests for the forwarding engine, without a network.
//!
//! The engine only talks to the `RtpSink` trait: we inject in-memory sinks and
//! observe what comes out. No socket, no handshake, no async runtime.
//!
//! The subscriptions are declared explicitly, exactly as the negotiator does
//! once a peer has answered the SFU's re-offer: `subscribe(track, subscriber,
//! target_mid)`. The `target_mid` is the m-line **allocated on the
//! subscriber's connection** — the whole point of the model, since it is what
//! keeps two publishers from landing in a single decoder.

use lumyx_sfu::media::{ForwardingEngine, RtpPacketData, RtpSink, TrackKey};
use std::sync::Arc;
use std::sync::Mutex;
use std::time::Instant;
use str0m::format::{Codec, CodecSpec, PayloadParams};
use str0m::media::{Frequency, Mid, Pt};

/// Test sink: keeps everything written to it.
#[derive(Default)]
struct RecordingSink {
    packets: Mutex<Vec<RtpPacketData>>,
    keyframe_requests: Mutex<Vec<Mid>>,
}

impl RecordingSink {
    fn new() -> Arc<Self> {
        Arc::new(RecordingSink::default())
    }

    fn received(&self) -> Vec<RtpPacketData> {
        self.packets.lock().expect("sink non empoisonné").clone()
    }

    fn count(&self) -> usize {
        self.packets.lock().expect("sink non empoisonné").len()
    }

    /// The mids the packets landed on, in order.
    fn mids(&self) -> Vec<Mid> {
        self.received().iter().map(|p| p.mid).collect()
    }

    fn keyframe_requests(&self) -> Vec<Mid> {
        self.keyframe_requests
            .lock()
            .expect("sink non empoisonné")
            .clone()
    }
}

impl RtpSink for RecordingSink {
    fn write_rtp(&self, packet: RtpPacketData) {
        self.packets
            .lock()
            .expect("sink non empoisonné")
            .push(packet);
    }

    fn request_keyframe(&self, mid: Mid) {
        self.keyframe_requests
            .lock()
            .expect("sink non empoisonné")
            .push(mid);
    }
}

fn vp8() -> PayloadParams {
    PayloadParams::new(
        Pt::from(96),
        None,
        CodecSpec {
            codec: Codec::Vp8,
            clock_rate: Frequency::NINETY_KHZ,
            channels: None,
            format: Default::default(),
        },
    )
}

/// A plausible video packet, published on the given m-line.
fn video_packet(payload: &[u8], mid: &str) -> RtpPacketData {
    RtpPacketData {
        params: vp8(),
        payload: Arc::from(payload),
        mid: Mid::from(mid),
        network_time: Instant::now(),
        rtp_time: 90_000,
        is_video: true,
    }
}

/// The room used by the scenarios that involve only one.
const ROOM: &str = "standup";

/// Every peer in these tests publishes on the same m-line — as every browser
/// does, which is exactly why the mid alone cannot identify a track.
const PUBLISH_MID: &str = "1";

fn peer(id: &str) -> Arc<str> {
    Arc::from(id)
}

fn track(publisher: &str) -> TrackKey {
    TrackKey::new(peer(publisher), Mid::from(PUBLISH_MID))
}

/// Makes a peer join `room_id`, and returns the sink assigned to it.
fn join(engine: &ForwardingEngine, room_id: &str, peer_id: &str) -> Arc<RecordingSink> {
    let sink = RecordingSink::new();
    engine.add_peer(room_id.to_string(), peer(peer_id), sink.clone());
    sink
}

/// Builds an engine with the named peers in a single room, and returns their
/// sinks in order.
fn engine_with(peers: &[&str]) -> (Arc<ForwardingEngine>, Vec<Arc<RecordingSink>>) {
    let engine = ForwardingEngine::new();
    let sinks: Vec<Arc<RecordingSink>> = peers.iter().map(|id| join(&engine, ROOM, id)).collect();
    (engine, sinks)
}

/// Publishes `publisher`'s track and wires it to `subscriber` on `target_mid`,
/// the way the negotiator does once the answer is in.
fn wire(engine: &ForwardingEngine, publisher: &str, subscriber: &str, target_mid: &str) {
    let key = track(publisher);
    engine.publish_track(key.clone(), true);
    assert!(
        engine.subscribe(&key, &peer(subscriber), Mid::from(target_mid)),
        "l'abonnement de {} à {} doit réussir",
        subscriber,
        publisher
    );
}

// --- Basic routing ---------------------------------------------------------

#[test]
fn a_publisher_never_receives_its_own_stream() {
    let (engine, sinks) = engine_with(&["alice", "bob"]);
    let (alice, bob) = (&sinks[0], &sinks[1]);
    wire(&engine, "alice", "bob", "2");

    engine.forward_rtp(&peer("alice"), video_packet(b"frame", PUBLISH_MID));

    assert_eq!(alice.count(), 0, "alice ne doit pas se recevoir elle-même");
    assert_eq!(bob.count(), 1);
}

#[test]
fn the_payload_reaches_the_subscriber_intact() {
    let (engine, sinks) = engine_with(&["alice", "bob"]);
    wire(&engine, "alice", "bob", "2");

    engine.forward_rtp(&peer("alice"), video_packet(b"hello", PUBLISH_MID));

    let received = sinks[1].received();
    assert_eq!(&received[0].payload[..], b"hello");
    assert_eq!(received[0].params.pt(), Pt::from(96));
    assert!(received[0].is_video);
}

#[test]
fn an_unsubscribed_peer_receives_nothing() {
    // The engine no longer subscribes anybody on its own: without an m-line
    // negotiated on the subscriber, there is nowhere to write.
    let (engine, sinks) = engine_with(&["alice", "bob"]);

    engine.forward_rtp(&peer("alice"), video_packet(b"frame", PUBLISH_MID));

    assert_eq!(sinks[1].count(), 0);
}

#[test]
fn a_lone_peer_forwards_to_nobody() {
    let (engine, sinks) = engine_with(&["alice"]);

    engine.forward_rtp(&peer("alice"), video_packet(b"frame", PUBLISH_MID));

    assert_eq!(sinks[0].count(), 0);
}

// --- One m-line per source: the defect this model exists to prevent --------

#[test]
fn two_publishers_land_on_two_distinct_m_lines() {
    // Alice and Bob both publish on their own mid "1" — every browser numbers
    // its m-lines identically. Forwarding that mid as is put both encodings
    // into a single stream on Carol, which decodes to noise.
    let (engine, sinks) = engine_with(&["alice", "bob", "carol"]);
    let carol = &sinks[2];

    wire(&engine, "alice", "carol", "2");
    wire(&engine, "bob", "carol", "3");

    engine.forward_rtp(&peer("alice"), video_packet(b"alice", PUBLISH_MID));
    engine.forward_rtp(&peer("bob"), video_packet(b"bob", PUBLISH_MID));

    let received = carol.received();
    assert_eq!(received.len(), 2);
    assert_eq!(received[0].mid, Mid::from("2"), "alice sur sa m-line");
    assert_eq!(received[1].mid, Mid::from("3"), "bob sur la sienne");
    assert_eq!(&received[0].payload[..], b"alice");
    assert_eq!(&received[1].payload[..], b"bob");
}

#[test]
fn one_source_reaches_each_subscriber_on_its_own_m_line() {
    // The same publisher, two subscribers: each has negotiated its own m-line
    // numbering, and the packet must be stamped per destination.
    let (engine, sinks) = engine_with(&["alice", "bob", "carol"]);

    wire(&engine, "alice", "bob", "2");
    wire(&engine, "alice", "carol", "9");

    engine.forward_rtp(&peer("alice"), video_packet(b"frame", PUBLISH_MID));

    assert_eq!(sinks[1].mids(), vec![Mid::from("2")]);
    assert_eq!(sinks[2].mids(), vec![Mid::from("9")]);
}

#[test]
fn audio_and_video_of_one_publisher_are_routed_separately() {
    let (engine, sinks) = engine_with(&["alice", "bob"]);

    let audio = TrackKey::new(peer("alice"), Mid::from("0"));
    let video = TrackKey::new(peer("alice"), Mid::from("1"));
    engine.publish_track(audio.clone(), false);
    engine.publish_track(video.clone(), true);
    engine.subscribe(&audio, &peer("bob"), Mid::from("2"));
    engine.subscribe(&video, &peer("bob"), Mid::from("3"));

    engine.forward_rtp(&peer("alice"), video_packet(b"son", "0"));
    engine.forward_rtp(&peer("alice"), video_packet(b"image", "1"));

    assert_eq!(sinks[1].mids(), vec![Mid::from("2"), Mid::from("3")]);
}

#[test]
fn a_packet_on_an_unpublished_mid_reaches_nobody() {
    let (engine, sinks) = engine_with(&["alice", "bob"]);
    wire(&engine, "alice", "bob", "2");

    // Alice's mid "7" was never announced, so nobody subscribed to it.
    engine.forward_rtp(&peer("alice"), video_packet(b"frame", "7"));

    assert_eq!(sinks[1].count(), 0);
}

// --- Room isolation --------------------------------------------------------

#[test]
fn two_rooms_do_not_see_each_other() {
    let engine = ForwardingEngine::new();
    join(&engine, "room-a", "alice");
    let bob = join(&engine, "room-a", "bob");
    let carol = join(&engine, "room-b", "carol");

    wire(&engine, "alice", "bob", "2");
    // Carol is in another room: the engine must refuse to wire her at all.
    assert!(
        !engine.subscribe(&track("alice"), &peer("carol"), Mid::from("2")),
        "un abonnement inter-room ne doit pas exister"
    );

    engine.forward_rtp(&peer("alice"), video_packet(b"frame", PUBLISH_MID));

    assert_eq!(bob.count(), 1, "bob est dans la room d'alice");
    assert_eq!(carol.count(), 0, "carol est dans une autre room");
}

#[test]
fn a_peer_that_joined_no_room_forwards_to_nobody() {
    let (engine, sinks) = engine_with(&["alice"]);

    engine.forward_rtp(&peer("ghost"), video_packet(b"frame", PUBLISH_MID));

    assert_eq!(sinks[0].count(), 0, "ghost n'a rejoint aucune room");
}

#[test]
fn a_peer_that_joined_no_room_cannot_be_subscribed() {
    let engine = ForwardingEngine::new();
    join(&engine, ROOM, "alice");
    engine.publish_track(track("alice"), true);

    // Bob's sink exists from his WebSocket connection onwards — his writer task
    // is running — but the engine only learns about it from `Join` onwards.
    assert!(!engine.subscribe(&track("alice"), &peer("bob"), Mid::from("2")));
}

#[test]
fn a_publisher_moving_to_another_room_leaves_its_subscribers_behind() {
    let engine = ForwardingEngine::new();
    let alice_sink = RecordingSink::new();
    engine.add_peer("room-a".to_string(), peer("alice"), alice_sink.clone());
    let bob = join(&engine, "room-a", "bob");
    wire(&engine, "alice", "bob", "2");

    engine.forward_rtp(&peer("alice"), video_packet(b"avant", PUBLISH_MID));
    let bob_before = bob.count();

    engine.add_peer("room-b".to_string(), peer("alice"), alice_sink);
    engine.forward_rtp(&peer("alice"), video_packet(b"apres", PUBLISH_MID));

    assert_eq!(bob.count(), bob_before, "bob est resté dans la room-a");
}

// --- Keyframes -------------------------------------------------------------

#[test]
fn a_keyframe_is_requested_on_the_publishers_own_m_line() {
    // The PLI travels to the publisher and names *its* inbound mid — not the
    // destination m-line the subscriber watches.
    let (engine, sinks) = engine_with(&["alice", "bob"]);
    let alice = &sinks[0];
    wire(&engine, "alice", "bob", "2");

    engine
        .sink_of("alice")
        .expect("alice a un sink")
        .request_keyframe(Mid::from(PUBLISH_MID));

    assert_eq!(alice.keyframe_requests(), vec![Mid::from(PUBLISH_MID)]);
    assert!(sinks[1].keyframe_requests().is_empty());
}

// --- Departures ------------------------------------------------------------

#[test]
fn removing_a_peer_takes_it_out_of_the_engine() {
    let (engine, _sinks) = engine_with(&["alice", "bob"]);
    wire(&engine, "alice", "bob", "2");

    engine.remove_peer("bob");

    assert_eq!(engine.peer_count(), 1);
}

#[test]
fn the_last_peer_leaving_drops_the_room() {
    let (engine, _sinks) = engine_with(&["alice", "bob"]);

    engine.remove_peer("alice");
    engine.remove_peer("bob");

    assert_eq!(
        engine.room_count(),
        0,
        "une room vide ne doit pas subsister"
    );
}

#[test]
fn removing_a_publisher_drops_every_track_it_published() {
    let (engine, _sinks) = engine_with(&["alice", "bob"]);
    let audio = TrackKey::new(peer("alice"), Mid::from("0"));
    let video = TrackKey::new(peer("alice"), Mid::from("1"));
    engine.publish_track(audio.clone(), false);
    engine.publish_track(video.clone(), true);

    engine.remove_peer("alice");

    assert!(engine.up_track(&audio).is_none());
    assert!(engine.up_track(&video).is_none());
}

#[test]
fn a_departed_peer_stops_receiving_while_others_publish() {
    let (engine, sinks) = engine_with(&["alice", "bob", "carol"]);
    wire(&engine, "alice", "bob", "2");
    wire(&engine, "alice", "carol", "2");

    engine.forward_rtp(&peer("alice"), video_packet(b"avant", PUBLISH_MID));
    let bob_before = sinks[1].count();

    engine.remove_peer("bob");
    engine.forward_rtp(&peer("alice"), video_packet(b"apres", PUBLISH_MID));

    assert_eq!(
        sinks[1].count(),
        bob_before,
        "bob ne doit plus rien recevoir après son départ"
    );
    assert_eq!(sinks[2].count(), 2, "carol continue de recevoir");
}

#[test]
fn a_departure_releases_the_down_tracks_other_publishers_held_on_it() {
    // Every down_track keeps an `Arc` on the subscriber's sink, hence on its
    // writer task and its `PeerConnection`: forgetting them would leak on every
    // departure.
    let (engine, _sinks) = engine_with(&["alice", "bob", "carol"]);
    wire(&engine, "alice", "bob", "2");
    wire(&engine, "alice", "carol", "2");

    let alice_track = engine.up_track(&track("alice")).expect("alice publie");
    assert_eq!(alice_track.subscriber_count(), 2);

    engine.remove_peer("bob");

    assert_eq!(
        alice_track.subscriber_count(),
        1,
        "le down_track vers bob doit être libéré"
    );
}

// --- Cost of the writes ----------------------------------------------------
//
// A published packet costs exactly one write per subscriber.

#[test]
fn a_packet_costs_one_write_per_subscriber() {
    let (engine, sinks) = engine_with(&["alice", "bob", "carol"]);
    wire(&engine, "alice", "bob", "2");
    wire(&engine, "alice", "carol", "2");

    let written = engine.forward_rtp(&peer("alice"), video_packet(b"frame", PUBLISH_MID));

    assert_eq!(written, 2, "S écritures pour S = 2 subscribers");
    assert_eq!(sinks[1].count(), 1, "bob reçoit une seule copie");
    assert_eq!(sinks[2].count(), 1, "carol aussi");
}

#[test]
fn the_write_count_is_what_metrics_records() {
    // The media layer has no access to `Metrics`; it reports, the session
    // records. A wrong count here is a wrong `/metrics`.
    let (engine, _sinks) = engine_with(&["alice", "bob"]);

    assert_eq!(
        engine.forward_rtp(&peer("alice"), video_packet(b"frame", PUBLISH_MID)),
        0,
        "sans abonné, rien n'est écrit"
    );

    wire(&engine, "alice", "bob", "2");
    assert_eq!(
        engine.forward_rtp(&peer("alice"), video_packet(b"frame", PUBLISH_MID)),
        1
    );
}

#[test]
fn the_payload_is_shared_not_copied_between_subscribers() {
    // The fanout must not copy the payload per subscriber: `Arc<[u8]>` is a
    // shared buffer, so the slices bob and carol receive must point at the same
    // base address as the one alice published.
    let (engine, sinks) = engine_with(&["alice", "bob", "carol"]);
    wire(&engine, "alice", "bob", "2");
    wire(&engine, "alice", "carol", "3");

    let packet = video_packet(&[0xABu8; 1200], PUBLISH_MID);
    let source_ptr = packet.payload.as_ptr();

    engine.forward_rtp(&peer("alice"), packet);

    let bob = sinks[1].received();
    let carol = sinks[2].received();

    assert_eq!(
        bob[0].payload.as_ptr(),
        source_ptr,
        "bob doit voir le tampon publié, pas une copie"
    );
    assert_eq!(
        carol[0].payload.as_ptr(),
        source_ptr,
        "carol doit voir le même tampon que bob"
    );
}

// --- Idempotence -----------------------------------------------------------

#[test]
fn publishing_the_same_track_twice_keeps_its_subscribers() {
    // `MediaAdded` and the first packet both announce the track: the second
    // announcement must not wipe the subscriptions built on the first.
    let (engine, sinks) = engine_with(&["alice", "bob"]);
    wire(&engine, "alice", "bob", "2");

    engine.publish_track(track("alice"), true);
    engine.forward_rtp(&peer("alice"), video_packet(b"frame", PUBLISH_MID));

    assert_eq!(sinks[1].count(), 1);
}

#[test]
fn resubscribing_moves_the_stream_to_the_new_m_line() {
    // A renegotiation can hand the same source a different m-line; the last
    // one wins, and there is still only one down_track.
    let (engine, sinks) = engine_with(&["alice", "bob"]);
    wire(&engine, "alice", "bob", "2");
    wire(&engine, "alice", "bob", "5");

    engine.forward_rtp(&peer("alice"), video_packet(b"frame", PUBLISH_MID));

    assert_eq!(sinks[1].mids(), vec![Mid::from("5")]);
    assert_eq!(
        engine.up_track(&track("alice")).unwrap().subscriber_count(),
        1
    );
}
