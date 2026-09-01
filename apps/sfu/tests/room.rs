//! A whole room, end to end, in one process.
//!
//! N str0m instances play the browsers, N [`PeerConnection`]s the SFU, and a
//! virtual network carries their datagrams. ICE, DTLS and SRTP are the real
//! ones — only the sockets are simulated. Media is published, forwarded through
//! the real [`ForwardingEngine`], and decoded back out on the other side.
//!
//! This is the test the bug would have failed. From three peers on, a
//! subscriber receives from two publishers at once; every browser numbers its
//! m-lines identically, and the SFU used to forward the publisher's mid
//! verbatim, so both encodings landed on a single outbound stream. The
//! assertions below are therefore not "media arrives" but **which stream it
//! arrives on, and whose it is**.
//!
//! The same scenario runs at 3, 5, 10 and 15 peers. What grows quadratically is
//! the number of m-lines — at 15 peers each browser negotiates 28 inbound
//! streams and the room holds 420 — so these runs are as much a check on the
//! negotiation batching as on the routing.

use lumyx_sfu::media::{ForwardingEngine, RtpPacketData, RtpSink, TrackKey};
use lumyx_sfu::transport::PeerConnection;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use str0m::media::{Direction, MediaKind, Mid};
use str0m::net::{Protocol, Receive};
use str0m::{Candidate, Event, Input, Output, Rtc, RtcError};
use tokio::sync::mpsc;

const ROOM: &str = "standup";

/// Peers are named `p00`, `p01`, … so a payload can carry its author's name and
/// an assertion can read it straight back out of the decoded frame.
fn peer_name(i: usize) -> String {
    format!("p{i:02}")
}

/// A step of the virtual clock. Small enough that ICE and DTLS retransmits
/// behave, large enough that the handshake completes in a few hundred turns.
const TICK: Duration = Duration::from_millis(1);

// ── The sink: what `PeerSink` does, minus the async ────────────────────────
//
// In production the sink is a bounded queue drained by a writer task. Here the
// packets are collected and written out synchronously between two turns of the
// pump, which keeps the test deterministic while exercising the same
// `write_rtp` on the far side.

#[derive(Default)]
struct QueueSink {
    outbound: Mutex<Vec<RtpPacketData>>,
}

impl RtpSink for QueueSink {
    fn write_rtp(&self, packet: RtpPacketData) {
        self.outbound.lock().unwrap().push(packet);
    }

    /// No-op: str0m's fake publishers here emit a keyframe on every write, so
    /// there is nothing for a PLI to change. Whether keyframes actually reach a
    /// late subscriber is what `scripts/browser-check.ts` measures, against a
    /// real encoder.
    fn request_keyframe(&self, _mid: Mid) {}
}

impl QueueSink {
    fn drain(&self) -> Vec<RtpPacketData> {
        std::mem::take(&mut *self.outbound.lock().unwrap())
    }
}

// ── The browser side ───────────────────────────────────────────────────────

struct Browser {
    rtc: Rtc,
    addr: SocketAddr,
    /// The m-line this browser publishes video on.
    video_mid: Mid,
    /// What it received, by the m-line it arrived on.
    received: HashMap<Mid, Vec<Vec<u8>>>,
    /// Which publisher each inbound m-line belongs to, read from the msid the
    /// SFU set — this is `event.streams[0].id` in a real browser.
    source_of: HashMap<Mid, String>,
}

// ── The SFU side ───────────────────────────────────────────────────────────

struct Sfu {
    peer: Arc<str>,
    conn: PeerConnection,
    addr: SocketAddr,
    sink: Arc<QueueSink>,
}

struct World {
    browsers: Vec<Browser>,
    sfus: Vec<Sfu>,
    engine: Arc<ForwardingEngine>,
    /// Virtual clock. Shared by every node, so the whole room agrees on time
    /// without any of them touching the real one.
    start: Instant,
    now: Instant,
    /// Signaling channels, kept alive so `handle_offer` can push its answer.
    _signaling: Vec<mpsc::Receiver<lumyx_sfu::signaling::ServerMessage>>,
}

impl World {
    async fn new(size: usize) -> Self {
        let engine = ForwardingEngine::new();
        let now = Instant::now();

        let mut browsers = Vec::new();
        let mut sfus = Vec::new();
        let mut signaling = Vec::new();

        for i in 0..size {
            let (tx, rx) = mpsc::channel(64);
            signaling.push(rx);

            let peer: Arc<str> = Arc::from(peer_name(i).as_str());
            let conn = PeerConnection::new(Arc::clone(&peer), tx, "127.0.0.1".to_string()).await;
            let addr = conn.local_ice_addr().expect("adresse ICE du SFU");

            let sink = Arc::new(QueueSink::default());
            engine.add_peer(ROOM.to_string(), Arc::clone(&peer), sink.clone());

            sfus.push(Sfu {
                peer,
                conn,
                addr,
                sink,
            });

            let mut rtc = Rtc::builder().build(now);
            let browser_addr: SocketAddr = format!("10.0.0.1:{}", 9000 + i).parse().unwrap();
            rtc.add_local_candidate(Candidate::host(browser_addr, "udp").unwrap());

            browsers.push(Browser {
                rtc,
                addr: browser_addr,
                video_mid: Mid::from("0"),
                received: HashMap::new(),
                source_of: HashMap::new(),
            });
        }

        World {
            browsers,
            sfus,
            engine,
            start: now,
            now,
            _signaling: signaling,
        }
    }

    /// Each browser offers one audio and one video track, sendonly, exactly as
    /// the test client does.
    fn publish_all(&mut self) {
        for i in 0..self.browsers.len() {
            let (video, offer, pending) = {
                let browser = &mut self.browsers[i];
                let mut api = browser.rtc.sdp_api();
                api.add_media(MediaKind::Audio, Direction::SendOnly, None, None, None);
                let video = api.add_media(MediaKind::Video, Direction::SendOnly, None, None, None);
                let (offer, pending) = api.apply().expect("une offer");
                (video, offer.to_sdp_string(), pending)
            };

            let answer = self.sfus[i]
                .conn
                .handle_offer(&offer)
                .expect("le SFU répond à l'offer");

            let browser = &mut self.browsers[i];
            browser.video_mid = video;
            browser
                .rtc
                .sdp_api()
                .accept_answer(
                    pending,
                    str0m::change::SdpAnswer::from_sdp_string(&answer).unwrap(),
                )
                .expect("le navigateur applique l'answer");
        }
    }

    /// One turn: drain every node's output, deliver the datagrams, advance the
    /// clock. Returns the SFU-side events, which the caller reacts to exactly
    /// as `event_loop` and `Negotiator` do in production.
    fn turn(&mut self) -> Result<Vec<(usize, Event)>, RtcError> {
        let mut transmits = Vec::new();
        let mut sfu_events = Vec::new();
        let mut next = self.now + Duration::from_millis(50);

        for (i, sfu) in self.sfus.iter_mut().enumerate() {
            loop {
                match sfu.conn.rtc.poll_output()? {
                    Output::Timeout(t) => {
                        next = next.min(t);
                        break;
                    }
                    Output::Transmit(t) => transmits.push(t),
                    Output::Event(e) => sfu_events.push((i, e)),
                }
            }
        }

        for browser in self.browsers.iter_mut() {
            loop {
                match browser.rtc.poll_output()? {
                    Output::Timeout(t) => {
                        next = next.min(t);
                        break;
                    }
                    Output::Transmit(t) => transmits.push(t),
                    Output::Event(e) => {
                        browser.absorb(e);
                    }
                }
            }
        }

        for transmit in transmits {
            let receive = |rtc: &mut Rtc| -> Result<(), RtcError> {
                rtc.handle_input(Input::Receive(
                    self.now,
                    Receive {
                        proto: Protocol::Udp,
                        source: transmit.source,
                        destination: transmit.destination,
                        contents: transmit.contents.as_ref().try_into().unwrap(),
                    },
                ))
            };

            if let Some(sfu) = self
                .sfus
                .iter_mut()
                .find(|s| s.addr == transmit.destination)
            {
                receive(&mut sfu.conn.rtc)?;
            } else if let Some(browser) = self
                .browsers
                .iter_mut()
                .find(|b| b.addr == transmit.destination)
            {
                receive(&mut browser.rtc)?;
            }
        }

        self.now = next.max(self.now + TICK);
        for sfu in self.sfus.iter_mut() {
            sfu.conn.rtc.handle_input(Input::Timeout(self.now))?;
        }
        for browser in self.browsers.iter_mut() {
            browser.rtc.handle_input(Input::Timeout(self.now))?;
        }

        Ok(sfu_events)
    }

    /// Reacts to the SFU's events the way the session layer does: a published
    /// track is announced to the engine and subscribed by everyone else, media
    /// is forwarded, and the fanout is written out to each destination.
    fn react(&mut self, events: Vec<(usize, Event)>) {
        for (i, event) in events {
            match event {
                Event::MediaAdded(media) => {
                    self.sfus[i].conn.rx_kind.insert(media.mid, media.kind);

                    let key = TrackKey::new(Arc::clone(&self.sfus[i].peer), media.mid);
                    self.engine
                        .publish_track(key.clone(), media.kind == MediaKind::Video);

                    for j in 0..self.sfus.len() {
                        if j == i {
                            continue;
                        }
                        self.sfus[j]
                            .conn
                            .queue_subscription(key.clone(), media.kind);
                    }
                }
                Event::MediaData(data) => {
                    let peer = Arc::clone(&self.sfus[i].peer);
                    if let Some(packet) = self.sfus[i].conn.to_packet(data) {
                        self.engine.forward_rtp(&peer, packet);
                    }
                }
                _ => {}
            }
        }

        self.flush_sinks();
    }

    /// Writes what the fanout queued, as the `PeerSink` writer task does.
    fn flush_sinks(&mut self) {
        for sfu in self.sfus.iter_mut() {
            for packet in sfu.sink.drain() {
                sfu.conn.write_rtp(&packet).expect("écriture RTP");
            }
        }
    }

    /// Runs every pending re-offer to completion, in one shot per peer.
    fn negotiate_subscriptions(&mut self) {
        for i in 0..self.sfus.len() {
            let Some(offer) = self.sfus[i].conn.negotiate() else {
                continue;
            };

            let answer = self.browsers[i]
                .answer(&offer)
                .expect("le navigateur répond à la re-offer");

            let live = self.sfus[i]
                .conn
                .accept_answer(&answer)
                .expect("l'answer est appliquée");

            let subscriber = Arc::clone(&self.sfus[i].peer);
            for (key, target_mid) in live {
                assert!(
                    self.engine.subscribe(&key, &subscriber, target_mid),
                    "{} doit pouvoir s'abonner à {}",
                    subscriber,
                    key
                );
            }
        }
    }

    fn size(&self) -> usize {
        self.browsers.len()
    }

    fn all_connected(&self) -> bool {
        self.sfus.iter().all(|s| s.conn.rtc.is_connected())
            && self.browsers.iter().all(|b| b.rtc.is_connected())
    }

    /// Advances the world by `turns`, reacting to everything that happens.
    fn run(&mut self, turns: usize) -> Result<(), RtcError> {
        for _ in 0..turns {
            let events = self.turn()?;
            self.react(events);
        }
        Ok(())
    }

    /// Publishes one video frame from `publisher`, tagged so the receiving side
    /// can tell whose it is.
    fn write_video(&mut self, publisher: usize, payload: &[u8]) {
        let elapsed = self.now - self.start;
        let browser = &mut self.browsers[publisher];
        let mid = browser.video_mid;

        // The PT negotiated on *this* m-line for VP8. `payload_params()` is
        // already filtered to what the remote accepted, and `resend()` holds a
        // codec's RTX payload type, not a marker of an RTX entry.
        let pt = browser
            .rtc
            .writer(mid)
            .expect("writer vidéo")
            .payload_params()
            .find(|p| p.spec().codec == str0m::format::Codec::Vp8)
            .map(|p| p.pt())
            .expect("VP8 négocié sur la m-line vidéo");

        let wallclock = self.now;
        let time = str0m::media::MediaTime::from_90khz(elapsed.as_millis() as u64 * 90);

        browser
            .rtc
            .writer(mid)
            .expect("writer vidéo")
            .write(pt, wallclock, time, payload.to_vec())
            .expect("écriture vidéo");
    }
}

impl Browser {
    fn absorb(&mut self, event: Event) {
        match event {
            Event::MediaAdded(media) => {
                // The SFU names each m-line it adds with the publisher's id as
                // the msid stream id — this is `event.streams[0].id` in a real
                // browser, and it is how the client knows whose tile to fill.
                if let Some(m) = self.rtc.media(media.mid) {
                    self.source_of.insert(media.mid, m.stream_id().to_string());
                }
            }
            Event::MediaData(data) => {
                self.received
                    .entry(data.mid)
                    .or_default()
                    .push(data.data.to_vec());
            }
            _ => {}
        }
    }

    fn answer(&mut self, offer_sdp: &str) -> Result<String, RtcError> {
        let offer = str0m::change::SdpOffer::from_sdp_string(offer_sdp).expect("offer valide");
        Ok(self.rtc.sdp_api().accept_offer(offer)?.to_sdp_string())
    }

    /// The inbound m-lines that actually carried media, with their publisher.
    fn streams(&self) -> Vec<(Mid, String, usize)> {
        self.received
            .iter()
            .map(|(mid, frames)| {
                (
                    *mid,
                    self.source_of.get(mid).cloned().unwrap_or_default(),
                    frames.len(),
                )
            })
            .collect()
    }
}

// ── The scenario ───────────────────────────────────────────────────────────

/// Brings a room of `size` peers to the point where everyone is connected,
/// everyone publishes, and everyone is subscribed to everyone else.
async fn room_of(size: usize) -> Result<World, RtcError> {
    let mut world = World::new(size).await;
    world.publish_all();

    // ICE + DTLS, for the 2N connections at once.
    for _ in 0..4000 {
        if world.all_connected() {
            break;
        }
        let events = world.turn()?;
        world.react(events);
    }
    assert!(
        world.all_connected(),
        "les {} connexions doivent s'établir",
        size * 2
    );

    // The publishers' tracks reach the SFU as `MediaAdded`; a few turns let
    // every announcement land. Audio and video are announced separately, so a
    // peer's subscriptions can span two rounds — hence the loop rather than a
    // single pass.
    for _ in 0..4 {
        world.run(40)?;
        world.negotiate_subscriptions();
    }
    world.run(60)?;

    Ok(world)
}

/// Every peer publishes a frame naming itself; the room is then asked what each
/// participant received, and on which stream.
fn exchange(world: &mut World, frames: usize) -> Result<(), RtcError> {
    for n in 0..frames {
        for publisher in 0..world.size() {
            let payload = format!("{}-{n:03}", peer_name(publisher));
            world.write_video(publisher, payload.as_bytes());
        }
        world.run(4)?;
    }
    Ok(())
}

/// Asserts the property the whole design exists for: each peer sees every other
/// one on a stream of its own, carrying nothing but that peer's frames.
fn assert_every_peer_is_separated(world: &World) {
    let size = world.size();

    for (i, browser) in world.browsers.iter().enumerate() {
        let mut streams = browser.streams();
        streams.retain(|(_, _, frames)| *frames > 0);

        assert_eq!(
            streams.len(),
            size - 1,
            "{} doit recevoir {} flux distincts, un par autre participant — reçu {:?}",
            peer_name(i),
            size - 1,
            streams
        );

        let mut sources: Vec<&str> = streams.iter().map(|(_, src, _)| src.as_str()).collect();
        sources.sort_unstable();
        let expected: Vec<String> = (0..size).filter(|j| *j != i).map(peer_name).collect();
        assert_eq!(
            sources,
            expected,
            "{} doit voir exactement les autres participants",
            peer_name(i)
        );

        // Two m-lines are never the same, and no stream is ever a mixture: this
        // is where the corrupted picture came from.
        for (mid, source, _) in &streams {
            for frame in &browser.received[mid] {
                let text = String::from_utf8_lossy(frame);
                assert!(
                    text.starts_with(&format!("{source}-")),
                    "{} : un paquet de {} sur la m-line de {}",
                    peer_name(i),
                    text,
                    source
                );
            }
        }
    }
}

#[tokio::test]
async fn three_peers_each_see_the_other_two_on_their_own_streams() -> Result<(), RtcError> {
    let mut world = room_of(3).await?;
    exchange(&mut world, 40)?;
    assert_every_peer_is_separated(&world);
    Ok(())
}

#[tokio::test]
async fn five_peers_stay_separated() -> Result<(), RtcError> {
    let mut world = room_of(5).await?;
    exchange(&mut world, 30)?;
    assert_every_peer_is_separated(&world);
    Ok(())
}

#[tokio::test]
async fn ten_peers_stay_separated() -> Result<(), RtcError> {
    let mut world = room_of(10).await?;
    exchange(&mut world, 20)?;
    assert_every_peer_is_separated(&world);
    Ok(())
}

#[tokio::test]
async fn fifteen_peers_stay_separated() -> Result<(), RtcError> {
    // 15 peers is 420 outbound m-lines across the room, 28 per browser, and a
    // re-offer whose SDP runs to tens of kilobytes. Nothing here is a
    // performance claim — it is a check that the negotiation batches instead of
    // livelocking, and that the routing table stays exact at that width.
    let mut world = room_of(15).await?;
    exchange(&mut world, 12)?;
    assert_every_peer_is_separated(&world);
    Ok(())
}

#[tokio::test]
async fn a_publisher_does_not_receive_its_own_stream() -> Result<(), RtcError> {
    let mut world = room_of(3).await?;
    exchange(&mut world, 20)?;

    for (i, browser) in world.browsers.iter().enumerate() {
        let own = format!("{}-", peer_name(i));
        for (mid, frames) in &browser.received {
            for frame in frames {
                let text = String::from_utf8_lossy(frame);
                assert!(
                    !text.starts_with(&own),
                    "{} se recevrait elle-même sur mid={}",
                    peer_name(i),
                    mid
                );
            }
        }
    }

    Ok(())
}
