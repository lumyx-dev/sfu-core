//! Tests du moteur de forwarding, sans réseau.
//!
//! Le moteur ne parle qu'au trait `RtpSink` : on lui injecte des sinks en
//! mémoire et on observe ce qui en sort. Aucune socket, aucun handshake,
//! aucun runtime asynchrone.

use sfu::media::{ForwardingEngine, RtpPacketData, RtpSink};
use str0m::media::Mid;
use std::sync::Arc;
use std::sync::Mutex;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Instant;

/// Sink de test : garde tout ce qu'on lui écrit.
#[derive(Default)]
struct RecordingSink {
    packets: Mutex<Vec<RtpPacketData>>,
    keyframe_requests: AtomicUsize,
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

    fn keyframe_requests(&self) -> usize {
        self.keyframe_requests.load(Ordering::Relaxed)
    }
}

impl RtpSink for RecordingSink {
    fn write_rtp(&self, packet: RtpPacketData) {
        self.packets.lock().expect("sink non empoisonné").push(packet);
    }

    fn request_keyframe(&self) {
        self.keyframe_requests.fetch_add(1, Ordering::Relaxed);
    }
}

/// Un paquet vidéo plausible. `payload_type >= 96` est ce sur quoi le moteur
/// se base pour classer le flux en vidéo.
fn video_packet(payload: &[u8]) -> RtpPacketData {
    RtpPacketData {
        payload_type: 96,
        sequence_number: 0,
        timestamp: 1_000,
        ssrc: 0,
        payload: Arc::from(payload),
        is_keyframe: false,
        mid: Mid::from("0"),
        network_time: Instant::now(),
        rtp_time: 90_000,
        is_video: true,
    }
}

/// Room des scénarios qui n'en font intervenir qu'une.
const ROOM: &str = "standup";

/// Fait rejoindre `room_id` à un peer, et rend le sink qui lui a été attribué.
fn join(engine: &ForwardingEngine, room_id: &str, peer_id: &str) -> Arc<RecordingSink> {
    let sink = RecordingSink::new();
    engine.add_peer(room_id.to_string(), peer_id.to_string(), sink.clone());
    sink
}

/// Monte un moteur avec les peers nommés dans une même room, et rend leurs
/// sinks dans l'ordre.
fn engine_with(peers: &[&str]) -> (Arc<ForwardingEngine>, Vec<Arc<RecordingSink>>) {
    let engine = ForwardingEngine::new();
    let sinks: Vec<Arc<RecordingSink>> = peers.iter().map(|id| join(&engine, ROOM, id)).collect();
    (engine, sinks)
}

// --- Routage de base -------------------------------------------------------

#[test]
fn a_publisher_never_receives_its_own_stream() {
    let (engine, sinks) = engine_with(&["alice", "bob"]);
    let (alice, bob) = (&sinks[0], &sinks[1]);

    engine.forward_rtp("alice", video_packet(b"frame"));

    assert_eq!(alice.count(), 0, "alice ne doit pas se recevoir elle-même");
    assert_eq!(bob.count(), 1);
}

#[test]
fn the_payload_reaches_the_subscriber_intact() {
    let (engine, sinks) = engine_with(&["alice", "bob"]);

    engine.forward_rtp("alice", video_packet(b"hello"));

    let received = sinks[1].received();
    assert_eq!(&received[0].payload[..], b"hello");
    assert_eq!(received[0].payload_type, 96);
    assert!(received[0].is_video);
    assert_eq!(received[0].mid, Mid::from("0"));
}

#[test]
fn a_lone_peer_forwards_to_nobody() {
    let (engine, sinks) = engine_with(&["alice"]);

    engine.forward_rtp("alice", video_packet(b"frame"));

    assert_eq!(sinks[0].count(), 0);
}

#[test]
fn a_peer_joining_later_starts_receiving() {
    let engine = ForwardingEngine::new();
    join(&engine, ROOM, "alice");

    engine.forward_rtp("alice", video_packet(b"avant"));

    let bob = join(&engine, ROOM, "bob");
    engine.forward_rtp("alice", video_packet(b"apres"));

    assert_eq!(bob.count(), 1, "bob ne reçoit que ce qui suit son arrivée");
    assert_eq!(&bob.received()[0].payload[..], b"apres");
}

// --- Cloisonnement par room ------------------------------------------------

#[test]
fn two_rooms_do_not_see_each_other() {
    let engine = ForwardingEngine::new();
    join(&engine, "room-a", "alice");
    let bob = join(&engine, "room-a", "bob");
    let carol = join(&engine, "room-b", "carol");

    engine.forward_rtp("alice", video_packet(b"frame"));

    assert_eq!(bob.count(), 1, "bob est dans la room d'alice");
    assert_eq!(carol.count(), 0, "carol est dans une autre room");
}

#[test]
fn a_peer_that_joined_no_room_forwards_to_nobody() {
    let (engine, sinks) = engine_with(&["alice"]);

    engine.forward_rtp("ghost", video_packet(b"frame"));

    assert_eq!(sinks[0].count(), 0, "ghost n'a rejoint aucune room");
}

#[test]
fn a_peer_that_joined_no_room_receives_nothing() {
    let engine = ForwardingEngine::new();
    join(&engine, ROOM, "alice");

    // Le sink de bob existe dès sa connexion WebSocket — sa task d'écriture
    // tourne — mais le moteur ne le connaît qu'à partir du `Join`.
    let bob = RecordingSink::new();
    engine.forward_rtp("alice", video_packet(b"frame"));

    assert_eq!(bob.count(), 0, "bob n'a pas encore rejoint de room");
}

#[test]
fn a_publisher_moving_to_another_room_leaves_its_subscribers_behind() {
    let engine = ForwardingEngine::new();
    let alice_sink = RecordingSink::new();
    engine.add_peer("room-a".to_string(), "alice".to_string(), alice_sink.clone());
    let bob = join(&engine, "room-a", "bob");

    engine.forward_rtp("alice", video_packet(b"avant"));
    let bob_before = bob.count();

    engine.add_peer("room-b".to_string(), "alice".to_string(), alice_sink);
    engine.forward_rtp("alice", video_packet(b"apres"));

    assert_eq!(bob.count(), bob_before, "bob est resté dans la room-a");
}

// --- Keyframes -------------------------------------------------------------

#[test]
fn the_source_is_asked_for_a_keyframe_when_a_subscriber_attaches() {
    let (engine, sinks) = engine_with(&["alice", "bob"]);
    let (alice, bob) = (&sinks[0], &sinks[1]);

    engine.forward_rtp("alice", video_packet(b"frame"));

    assert_eq!(alice.keyframe_requests(), 1, "la demande va au publisher");
    assert_eq!(bob.keyframe_requests(), 0);
}

#[test]
fn the_keyframe_is_requested_once_per_subscription_not_per_packet() {
    let (engine, sinks) = engine_with(&["alice", "bob"]);

    for _ in 0..10 {
        engine.forward_rtp("alice", video_packet(b"frame"));
    }

    assert_eq!(sinks[0].keyframe_requests(), 1);
}

#[test]
fn each_new_subscriber_triggers_its_own_keyframe_request() {
    let engine = ForwardingEngine::new();
    let alice = join(&engine, ROOM, "alice");

    join(&engine, ROOM, "bob");
    engine.forward_rtp("alice", video_packet(b"frame"));

    join(&engine, ROOM, "carol");
    engine.forward_rtp("alice", video_packet(b"frame"));

    assert_eq!(alice.keyframe_requests(), 2);
}

// --- Réécriture par DownTrack ---------------------------------------------

#[test]
fn sequence_numbers_advance_by_one_per_subscriber() {
    let (engine, sinks) = engine_with(&["alice", "bob"]);

    engine.forward_rtp("alice", video_packet(b"a"));
    engine.forward_rtp("alice", video_packet(b"b"));

    let received = sinks[1].received();
    assert_eq!(received.len(), 2);
    assert_eq!(received[1].sequence_number, received[0].sequence_number.wrapping_add(1));
}

#[test]
fn a_subscriber_sees_one_stable_ssrc() {
    let (engine, sinks) = engine_with(&["alice", "bob"]);

    engine.forward_rtp("alice", video_packet(b"a"));
    engine.forward_rtp("alice", video_packet(b"b"));

    let received = sinks[1].received();
    assert_eq!(received[0].ssrc, received[1].ssrc);
    assert_ne!(received[0].ssrc, 0, "le SSRC source doit être réécrit");
}

#[test]
fn two_subscribers_get_distinct_ssrcs() {
    let (engine, sinks) = engine_with(&["alice", "bob", "carol"]);

    engine.forward_rtp("alice", video_packet(b"frame"));

    let bob_ssrc = sinks[1].received()[0].ssrc;
    let carol_ssrc = sinks[2].received()[0].ssrc;
    assert_ne!(bob_ssrc, carol_ssrc);
}

// --- Départs ---------------------------------------------------------------

#[test]
fn removing_a_peer_takes_it_out_of_the_engine() {
    let (engine, _sinks) = engine_with(&["alice", "bob"]);

    engine.forward_rtp("alice", video_packet(b"avant"));
    engine.remove_peer("bob");

    assert_eq!(engine.peer_count(), 1);
}

#[test]
fn the_last_peer_leaving_drops_the_room() {
    let (engine, _sinks) = engine_with(&["alice", "bob"]);

    engine.remove_peer("alice");
    engine.remove_peer("bob");

    assert_eq!(engine.room_count(), 0, "une room vide ne doit pas subsister");
}

#[test]
fn removing_a_publisher_drops_its_up_track() {
    let (engine, _sinks) = engine_with(&["alice", "bob"]);

    engine.forward_rtp("alice", video_packet(b"frame"));
    assert!(engine.up_track("alice").is_some());

    engine.remove_peer("alice");
    assert!(engine.up_track("alice").is_none());
}

// --- Coût des écritures ----------------------------------------------------
//
// Un paquet publié coûte exactement une écriture par subscriber — au premier
// paquet, pendant que les down_tracks se créent, comme en régime établi.

#[test]
fn the_first_packet_reaches_each_subscriber_exactly_once() {
    let (engine, sinks) = engine_with(&["alice", "bob", "carol"]);

    engine.forward_rtp("alice", video_packet(b"frame"));

    assert_eq!(sinks[1].count(), 1, "bob reçoit une seule copie");
    assert_eq!(sinks[2].count(), 1, "carol aussi");
}

#[test]
fn steady_state_costs_one_write_per_subscriber_per_packet() {
    let (engine, sinks) = engine_with(&["alice", "bob", "carol"]);

    engine.forward_rtp("alice", video_packet(b"amorce"));
    let (bob_before, carol_before) = (sinks[1].count(), sinks[2].count());

    engine.forward_rtp("alice", video_packet(b"regime-etabli"));

    let bob = sinks[1].count() - bob_before;
    let carol = sinks[2].count() - carol_before;

    assert_eq!(bob, 1, "bob reçoit une seule copie du paquet");
    assert_eq!(carol, 1, "carol aussi");
    assert_eq!(bob + carol, 2, "S écritures pour S = 2 subscribers");
}

#[test]
fn two_peers_are_spared_the_duplication() {
    let (engine, sinks) = engine_with(&["alice", "bob"]);

    engine.forward_rtp("alice", video_packet(b"frame"));

    assert_eq!(sinks[1].count(), 1);
}

#[test]
fn a_departed_peer_stops_receiving_while_others_publish() {
    let (engine, sinks) = engine_with(&["alice", "bob", "carol"]);

    engine.forward_rtp("alice", video_packet(b"avant"));
    let bob_before = sinks[1].count();

    engine.remove_peer("bob");
    engine.forward_rtp("alice", video_packet(b"apres"));

    assert_eq!(
        sinks[1].count(),
        bob_before,
        "bob ne doit plus rien recevoir après son départ"
    );
}

#[test]
fn a_departure_releases_the_down_tracks_other_publishers_held_on_it() {
    // Chaque down_track garde un `Arc` sur le sink du subscriber, donc sur sa
    // task d'écriture et sa `PeerConnection` : les oublier fuirait à chaque
    // départ.
    let (engine, _sinks) = engine_with(&["alice", "bob", "carol"]);

    engine.forward_rtp("alice", video_packet(b"frame"));
    let alice_track = engine.up_track("alice").expect("alice publie");
    assert_eq!(alice_track.subscriber_count(), 2);

    engine.remove_peer("bob");

    assert_eq!(
        alice_track.subscriber_count(),
        1,
        "le down_track vers bob doit être libéré"
    );
}

#[test]
fn the_payload_is_shared_not_copied_between_subscribers() {
    // Le fanout ne doit pas recopier le payload par subscriber : `Arc<[u8]>` est
    // un tampon partagé, donc les tranches reçues par bob et carol doivent
    // pointer sur la même adresse de base que celle publiée par alice.
    let (engine, sinks) = engine_with(&["alice", "bob", "carol"]);

    let packet = video_packet(&[0xABu8; 1200]);
    let source_ptr = packet.payload.as_ptr();

    engine.forward_rtp("alice", packet);

    let bob = sinks[1].received();
    let carol = sinks[2].received();

    assert_eq!(bob.len(), 1);
    assert_eq!(carol.len(), 1);
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
