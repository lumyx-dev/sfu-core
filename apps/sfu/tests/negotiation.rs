//! End-to-end SDP negotiation, in memory.
//!
//! A second str0m `Rtc` plays the browser opposite the SFU's
//! [`PeerConnection`], and the two run the real offer/answer dance — no UDP, no
//! DTLS, no browser. What is under test is the property the SFU used to get
//! wrong: **one outbound m-line per source track**, negotiated for real and
//! writable at the end of the round trip.
//!
//! The SFU used to call `sdp_api()` exactly once, in `handle_offer`. It could
//! therefore never grow an m-line, and every publisher of a room was written
//! into the single one the client had offered — two encodings interleaved into
//! one decoder.

use sfu::transport::PeerConnection;
use std::sync::Arc;
use std::time::Instant;
use str0m::change::{SdpAnswer, SdpOffer};
use str0m::media::{Direction, MediaKind, Mid};
use str0m::{Rtc, RtcError};
use tokio::sync::mpsc;

/// The browser side: an ordinary str0m peer that publishes audio + video and
/// accepts whatever the SFU offers it afterwards.
struct Browser {
    rtc: Rtc,
}

impl Browser {
    fn new() -> Self {
        Browser {
            rtc: Rtc::builder().build(Instant::now()),
        }
    }

    /// Offers one audio and one video track, the way a browser calling
    /// `addTransceiver(track, {direction: 'sendonly'})` does. Returns the SDP
    /// and a closure that applies the SFU's answer.
    fn publish(&mut self) -> (String, str0m::change::SdpPendingOffer) {
        let mut api = self.rtc.sdp_api();
        api.add_media(MediaKind::Audio, Direction::SendOnly, None, None, None);
        api.add_media(MediaKind::Video, Direction::SendOnly, None, None, None);
        let (offer, pending) = api.apply().expect("une offer");
        (offer.to_sdp_string(), pending)
    }

    /// Answers an offer coming from the SFU.
    fn answer(&mut self, offer_sdp: &str) -> Result<String, RtcError> {
        let offer = SdpOffer::from_sdp_string(offer_sdp).expect("offer valide");
        Ok(self.rtc.sdp_api().accept_offer(offer)?.to_sdp_string())
    }

    /// Whether the browser accepted an m-line it only receives on — which is
    /// what a forwarded stream looks like from the client's side.
    fn receives_on(&self, mid: Mid) -> bool {
        self.rtc
            .media(mid)
            .is_some_and(|m| m.direction() == Direction::RecvOnly)
    }
}

async fn sfu_connection(peer_id: &str) -> (PeerConnection, mpsc::Receiver<sfu::signaling::ServerMessage>)
{
    let (tx, rx) = mpsc::channel(32);
    let conn = PeerConnection::new(Arc::from(peer_id), tx, "127.0.0.1".to_string()).await;
    (conn, rx)
}

/// Runs the initial dance: the browser publishes, the SFU answers.
async fn connect(browser: &mut Browser, sfu: &mut PeerConnection) {
    let (offer, pending) = browser.publish();
    let answer = sfu.handle_offer(&offer).expect("le SFU répond à l'offer");
    browser
        .rtc
        .sdp_api()
        .accept_answer(pending, SdpAnswer::from_sdp_string(&answer).unwrap())
        .expect("le navigateur applique l'answer du SFU");
}

/// Runs one SFU-initiated round trip and returns what became writable.
fn renegotiate(
    browser: &mut Browser,
    sfu: &mut PeerConnection,
) -> Vec<(sfu::media::TrackKey, Mid)> {
    let offer = sfu.negotiate().expect("le SFU doit re-offrir");
    let answer = browser.answer(&offer).expect("le navigateur répond");
    sfu.accept_answer(&answer).expect("l'answer est appliquée")
}

fn track(publisher: &str, mid: &str) -> sfu::media::TrackKey {
    sfu::media::TrackKey::new(Arc::from(publisher), Mid::from(mid))
}

#[tokio::test]
async fn the_initial_offer_is_answered() {
    let mut browser = Browser::new();
    let (mut sfu, mut signaling) = sfu_connection("alice").await;

    connect(&mut browser, &mut sfu).await;

    // The answer also reaches the client through the signaling channel.
    assert!(matches!(
        signaling.try_recv(),
        Ok(sfu::signaling::ServerMessage::SfuAnswer { .. })
    ));
}

#[tokio::test]
async fn two_publishers_get_two_writable_m_lines() {
    // The regression under test. Bob and Carol both publish on their own mid
    // "1"; Alice must end up with two separate outbound streams.
    let mut browser = Browser::new();
    let (mut sfu, _signaling) = sfu_connection("alice").await;
    connect(&mut browser, &mut sfu).await;

    sfu.queue_subscription(track("bob", "1"), MediaKind::Video);
    sfu.queue_subscription(track("carol", "1"), MediaKind::Video);

    let live = renegotiate(&mut browser, &mut sfu);

    assert_eq!(live.len(), 2, "une m-line par source");
    assert_ne!(
        live[0].1, live[1].1,
        "deux publishers ne doivent jamais partager une m-line"
    );

    for (key, mid) in &live {
        assert!(
            sfu.rtc.writer(*mid).is_some(),
            "le SFU doit pouvoir écrire {} sur mid={}",
            key,
            mid
        );
    }

    for (key, mid) in &live {
        assert!(
            browser.receives_on(*mid),
            "le navigateur doit recevoir {} sur mid={}",
            key,
            mid
        );
    }
}

#[tokio::test]
async fn audio_and_video_of_one_publisher_get_their_own_m_lines() {
    let mut browser = Browser::new();
    let (mut sfu, _signaling) = sfu_connection("alice").await;
    connect(&mut browser, &mut sfu).await;

    sfu.queue_subscription(track("bob", "0"), MediaKind::Audio);
    sfu.queue_subscription(track("bob", "1"), MediaKind::Video);

    let live = renegotiate(&mut browser, &mut sfu);

    assert_eq!(live.len(), 2);
    assert_ne!(live[0].1, live[1].1);
}

#[tokio::test]
async fn nothing_is_written_before_the_answer_lands() {
    // str0m only enters an m-line into the session when the answer is applied.
    // That is the gate `write_rtp` relies on to drop packets arriving
    // mid-negotiation instead of putting them on the wrong stream.
    let mut browser = Browser::new();
    let (mut sfu, _signaling) = sfu_connection("alice").await;
    connect(&mut browser, &mut sfu).await;

    sfu.queue_subscription(track("bob", "1"), MediaKind::Video);
    let offer = sfu.negotiate().expect("une re-offer");

    // The mid exists in the offer, but not yet in the session.
    let offered_mid = SdpOffer::from_sdp_string(&offer)
        .unwrap()
        .to_sdp_string()
        .contains("a=sendonly");
    assert!(offered_mid, "l'offer propose bien un flux sortant");

    let answer = browser.answer(&offer).unwrap();
    let live = sfu.accept_answer(&answer).unwrap();

    assert!(
        sfu.rtc.writer(live[0].1).is_some(),
        "après l'answer, et seulement après, l'écriture est possible"
    );
}

#[tokio::test]
async fn a_second_round_adds_to_the_first() {
    // A peer arriving later must not disturb the m-lines already in service.
    let mut browser = Browser::new();
    let (mut sfu, _signaling) = sfu_connection("alice").await;
    connect(&mut browser, &mut sfu).await;

    sfu.queue_subscription(track("bob", "1"), MediaKind::Video);
    let first = renegotiate(&mut browser, &mut sfu);

    sfu.queue_subscription(track("carol", "1"), MediaKind::Video);
    let second = renegotiate(&mut browser, &mut sfu);

    assert_eq!(second.len(), 1, "seule la nouvelle source est négociée");
    assert_ne!(first[0].1, second[0].1);
    assert!(
        sfu.rtc.writer(first[0].1).is_some(),
        "la m-line de bob doit survivre à l'arrivée de carol"
    );
    assert!(sfu.rtc.writer(second[0].1).is_some());
}

#[tokio::test]
async fn the_answer_tells_which_source_each_m_line_carries() {
    // The mapping is what routes a keyframe request back to the right
    // publisher: the browser asks on the m-line it watches, and the PLI has to
    // reach whoever feeds it.
    let mut browser = Browser::new();
    let (mut sfu, _signaling) = sfu_connection("alice").await;
    connect(&mut browser, &mut sfu).await;

    sfu.queue_subscription(track("bob", "1"), MediaKind::Video);
    sfu.queue_subscription(track("carol", "1"), MediaKind::Video);
    let live = renegotiate(&mut browser, &mut sfu);

    for (key, mid) in &live {
        assert_eq!(
            sfu.source_on(*mid).as_ref(),
            Some(key),
            "mid={} doit renvoyer vers {}",
            mid,
            key
        );
    }
}

#[tokio::test]
async fn a_departed_publisher_frees_its_m_line() {
    let mut browser = Browser::new();
    let (mut sfu, _signaling) = sfu_connection("alice").await;
    connect(&mut browser, &mut sfu).await;

    sfu.queue_subscription(track("bob", "1"), MediaKind::Video);
    sfu.queue_subscription(track("carol", "1"), MediaKind::Video);
    let live = renegotiate(&mut browser, &mut sfu);
    let bob_mid = live
        .iter()
        .find(|(key, _)| key.peer_id.as_ref() == "bob")
        .map(|(_, mid)| *mid)
        .expect("bob a une m-line");
    let carol_mid = live
        .iter()
        .find(|(key, _)| key.peer_id.as_ref() == "carol")
        .map(|(_, mid)| *mid)
        .expect("carol a une m-line");

    assert!(sfu.drop_source("bob"), "bob avait une m-line à fermer");
    let offer = sfu.negotiate().expect("la fermeture demande une re-offer");
    let answer = browser.answer(&offer).unwrap();
    sfu.accept_answer(&answer).unwrap();

    assert!(
        sfu.source_on(bob_mid).is_none(),
        "la m-line de bob ne doit plus porter de source"
    );
    assert!(
        sfu.source_on(carol_mid).is_some(),
        "celle de carol n'est pas touchée"
    );
}

#[tokio::test]
async fn a_source_announced_twice_is_negotiated_once() {
    let mut browser = Browser::new();
    let (mut sfu, _signaling) = sfu_connection("alice").await;
    connect(&mut browser, &mut sfu).await;

    assert!(sfu.queue_subscription(track("bob", "1"), MediaKind::Video));
    assert!(!sfu.queue_subscription(track("bob", "1"), MediaKind::Video));
    let live = renegotiate(&mut browser, &mut sfu);
    assert_eq!(live.len(), 1);

    // And once it is live, announcing it again is still a no-op.
    assert!(!sfu.queue_subscription(track("bob", "1"), MediaKind::Video));
    assert!(sfu.negotiate().is_none());
}
