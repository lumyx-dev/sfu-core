//! A peer's WebRTC connection.

use crate::error::{Result, SfuError};
use crate::media::{RtpPacketData, TrackKey};
use crate::signaling::ServerMessage;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Instant;
use str0m::{
    Candidate, Rtc,
    change::{SdpAnswer, SdpOffer, SdpPendingOffer},
    media::{Direction, KeyframeRequestKind, MediaKind, Mid},
};
use tokio::net::UdpSocket;
use tokio::sync::mpsc;

/// A peer's WebRTC connection, plus everything the SFU negotiated on it.
///
/// # The outbound m-lines
///
/// A subscriber needs **one m-line per source track**. They cannot be shared:
/// two publishers written into a single m-line reach the browser as one RTP
/// stream carrying two interleaved encodings, which decodes to noise.
///
/// str0m has no notion of "the mid Bob's video should go to on Alice's
/// connection" — that mapping is this struct's job. It is built in three
/// steps, and the type carries one field per step:
///
/// 1. [`Self::queue_subscription`] records that a source is wanted (`queued`);
/// 2. [`Self::negotiate`] allocates its m-line and puts it in an offer
///    (`offered`, `pending_offer`);
/// 3. [`Self::accept_answer`] confirms it (`allocated`), and only then can
///    [`Self::write_rtp`] write to it.
pub struct PeerConnection {
    /// `Arc<str>` and not `String`: the identifier never changes and travels
    /// with every received packet to the forwarding engine, where cloning it
    /// must stay a refcount bump rather than an allocation.
    pub peer_id: Arc<str>,
    pub rtc: Rtc,
    pub socket: Arc<UdpSocket>,
    pub remote_addr: Option<SocketAddr>,
    pub sender: mpsc::Sender<ServerMessage>,
    /// Host advertised in the local ICE candidates.
    pub ice_host: String,

    /// Kind of each m-line this peer **publishes** on.
    ///
    /// Fed by `Event::MediaAdded`, which only fires for media the remote side
    /// added. It picks the RTP clock on the way in and classifies the track as
    /// audio or video.
    pub rx_kind: HashMap<Mid, MediaKind>,

    /// Sources wanted by this peer, not offered yet.
    queued: Vec<(TrackKey, MediaKind)>,
    /// Sources whose m-line is allocated and offered, awaiting the answer.
    offered: Vec<(TrackKey, Mid)>,
    /// Local m-line already allocated per source track.
    allocated: HashMap<TrackKey, Mid>,
    /// M-lines to close in the next round — their publisher left.
    closing: Vec<Mid>,

    /// Offer waiting for its answer.
    ///
    /// At most one at a time: str0m rejects an answer whose change id is not
    /// the current one, so a second offer sent before the first is answered
    /// would invalidate it. New subscriptions accumulate in `queued` instead
    /// and go out in the next round.
    pending_offer: Option<SdpPendingOffer>,
}

impl PeerConnection {
    pub async fn new(
        peer_id: Arc<str>,
        sender: mpsc::Sender<ServerMessage>,
        ice_host: String,
    ) -> PeerConnection {
        let socket = UdpSocket::bind("0.0.0.0:0")
            .await
            .expect("bind UDP éphémère");
        let local_port = socket.local_addr().expect("adresse locale").port();
        tracing::info!("Peer {} — UDP sur port {}", peer_id, local_port);

        PeerConnection {
            peer_id,
            rtc: Rtc::builder().build(Instant::now()),
            socket: Arc::new(socket),
            remote_addr: None,
            sender,
            ice_host,
            rx_kind: HashMap::new(),
            queued: Vec::new(),
            offered: Vec::new(),
            allocated: HashMap::new(),
            closing: Vec::new(),
            pending_offer: None,
        }
    }

    /// Address advertised in the local ICE candidates.
    pub fn local_ice_addr(&self) -> Result<SocketAddr> {
        let port = self
            .socket
            .local_addr()
            .map_err(|e| SfuError::Transport(e.to_string()))?
            .port();

        format!("{}:{}", self.ice_host, port)
            .parse()
            .map_err(|_| SfuError::Ice(format!("hôte ICE invalide : {}", self.ice_host)))
    }

    /// Accepts the client's offer and returns the answer, which is also pushed
    /// to the client through the signaling channel.
    pub fn handle_offer(&mut self, sdp: &str) -> Result<String> {
        if self.pending_offer.is_some() {
            // Glare: both sides offered at once. The SFU's own offer is the one
            // that carries the room's subscriptions, so the client's is
            // refused; the client re-offers after answering ours.
            return Err(SfuError::Sdp(
                "offer croisée : une offer du SFU est déjà en vol".into(),
            ));
        }

        let local_addr = self.local_ice_addr()?;
        let candidate =
            Candidate::host(local_addr, "udp").map_err(|e| SfuError::Ice(e.to_string()))?;
        self.rtc.add_local_candidate(candidate);

        let offer = SdpOffer::from_sdp_string(sdp).map_err(|e| SfuError::Sdp(e.to_string()))?;
        let answer = self
            .rtc
            .sdp_api()
            .accept_offer(offer)
            .map_err(|e| SfuError::Sdp(e.to_string()))?;

        let answer_sdp = answer.to_sdp_string();
        // `handle_offer` is synchronous: `try_send` rather than a `send().await`.
        if let Err(e) = self.sender.try_send(ServerMessage::SfuAnswer {
            sdp: answer_sdp.clone(),
        }) {
            tracing::warn!("Peer {} — answer non transmise : {}", self.peer_id, e);
        }

        Ok(answer_sdp)
    }

    pub fn add_remote_candidate(&mut self, candidate: &str) {
        if let Ok(c) = Candidate::from_sdp_string(candidate) {
            self.rtc.add_remote_candidate(c);
        }
    }

    /// Records that this peer should receive a remote track.
    ///
    /// Returns `false` when the track is already known — queued, offered or
    /// live — which makes the caller free to announce the same source twice
    /// without producing a duplicate m-line.
    pub fn queue_subscription(&mut self, key: TrackKey, kind: MediaKind) -> bool {
        if self.allocated.contains_key(&key)
            || self.offered.iter().any(|(k, _)| *k == key)
            || self.queued.iter().any(|(k, _)| *k == key)
        {
            return false;
        }

        self.queued.push((key, kind));
        true
    }

    /// Allocates an m-line for every queued source and builds the re-offer.
    ///
    /// Returns `None` when there is nothing to negotiate, or when an offer is
    /// already awaiting its answer — the queue is then flushed by the
    /// [`Self::accept_answer`] that closes the round.
    pub fn negotiate(&mut self) -> Option<String> {
        if self.pending_offer.is_some() || (self.queued.is_empty() && self.closing.is_empty()) {
            return None;
        }

        let queued = std::mem::take(&mut self.queued);
        let closing = std::mem::take(&mut self.closing);
        let mut api = self.rtc.sdp_api();
        let mut offered = Vec::with_capacity(queued.len());

        // Departures and arrivals travel in the same round trip: one offer
        // rather than two, and no window where a peer holds a dead m-line.
        for mid in closing {
            api.stop_media(mid);
        }

        for (key, kind) in queued {
            // `stream_id` becomes `a=msid <streamId> <trackId>`, which the
            // browser surfaces as `event.streams[0].id`: the client learns which
            // publisher a track belongs to from the SDP alone, with no extra
            // signaling message.
            let mid = api.add_media(
                kind,
                Direction::SendOnly,
                Some(key.peer_id.to_string()),
                Some(key.to_string()),
                None,
            );
            offered.push((key, mid));
        }

        let (offer, pending) = api.apply()?;

        tracing::info!(
            "Peer {} — re-offer : {} source(s) ajoutée(s)",
            self.peer_id,
            offered.len()
        );

        self.offered = offered;
        self.pending_offer = Some(pending);

        Some(offer.to_sdp_string())
    }

    /// Applies the answer to the SFU's re-offer.
    ///
    /// Returns the sources that just became writable, with the m-line each one
    /// goes out on. The caller wires them into the forwarding engine — before
    /// that, [`Self::write_rtp`] drops their packets, since str0m only enters
    /// the m-line into the session when the answer is applied.
    pub fn accept_answer(&mut self, sdp: &str) -> Result<Vec<(TrackKey, Mid)>> {
        let Some(pending) = self.pending_offer.take() else {
            return Err(SfuError::Sdp("answer sans offer en attente".into()));
        };

        let answer = SdpAnswer::from_sdp_string(sdp).map_err(|e| SfuError::Sdp(e.to_string()))?;

        self.rtc
            .sdp_api()
            .accept_answer(pending, answer)
            .map_err(|e| SfuError::Sdp(e.to_string()))?;

        let live = std::mem::take(&mut self.offered);
        for (key, mid) in &live {
            self.allocated.insert(key.clone(), *mid);
        }

        tracing::info!(
            "Peer {} — answer appliquée, {} m-line(s) actives",
            self.peer_id,
            live.len()
        );

        Ok(live)
    }

    /// Source served on one of this peer's outbound m-lines.
    ///
    /// Used to route a keyframe request back: the browser asks on the m-line it
    /// is watching, and the PLI has to reach the peer publishing it.
    pub fn source_on(&self, mid: Mid) -> Option<TrackKey> {
        self.allocated
            .iter()
            .find(|(_, allocated)| **allocated == mid)
            .map(|(key, _)| key.clone())
    }

    /// Closes the m-lines carrying a departed publisher's tracks.
    ///
    /// Returns `true` if anything changed, in which case the caller must
    /// renegotiate. Without this, every peer that ever published leaves a dead
    /// m-line behind on every other peer, for the lifetime of the session.
    ///
    /// `offered` is deliberately left untouched: those m-lines are already in
    /// an offer the peer is answering, and pulling them out here would leave
    /// them open forever, known to str0m and to nobody else. They land in
    /// `allocated` at the end of the round; the negotiator notices the source
    /// has gone when the subscription fails, and calls this again.
    pub fn drop_source(&mut self, publisher: &str) -> bool {
        let queued_before = self.queued.len();
        self.queued
            .retain(|(key, _)| key.peer_id.as_ref() != publisher);
        let unqueued = queued_before != self.queued.len();

        let stale: Vec<TrackKey> = self
            .allocated
            .keys()
            .filter(|key| key.peer_id.as_ref() == publisher)
            .cloned()
            .collect();

        for key in &stale {
            if let Some(mid) = self.allocated.remove(key) {
                self.closing.push(mid);
            }
        }

        // The m-lines are only staged here. The offer that carries them is
        // built by the next `negotiate()`, so a departure and an arrival
        // happening together cost a single round trip.
        !stale.is_empty() || unqueued
    }

    /// Writes a forwarded packet towards this peer.
    ///
    /// `packet.mid` is the **destination** m-line: `DownTrack` has already
    /// swapped the publisher's mid for the one allocated here. str0m
    /// regenerates the RTP header itself (SSRC, sequence, timestamp); only the
    /// payload, the m-line and the media timestamp come from the source.
    pub fn write_rtp(&mut self, packet: &RtpPacketData) -> Result<()> {
        // `writer()` is the authoritative gate: str0m only enters an m-line
        // into the session once the answer is applied, so a packet arriving
        // mid-negotiation falls through here instead of going out on the wrong
        // stream.
        let Some(writer) = self.rtc.writer(packet.mid) else {
            return Ok(());
        };

        // The payload type is not portable across peers: the publisher's PT
        // means whatever *it* negotiated. `match_params` maps the codec to the
        // PT this m-line reserved for it. The fallback only ever fires for a
        // codec the subscriber did not negotiate, and it is the last chance to
        // send something rather than nothing.
        let Some(pt) = writer
            .match_params(packet.params)
            .or_else(|| writer.payload_params().next().map(|p| p.pt()))
        else {
            tracing::warn!(
                "Peer {} — aucun PT disponible pour mid={}",
                self.peer_id,
                packet.mid
            );
            return Ok(());
        };

        let rtp_time = if packet.is_video {
            str0m::media::MediaTime::from_90khz(packet.rtp_time)
        } else {
            str0m::media::MediaTime::new(packet.rtp_time, str0m::media::Frequency::FORTY_EIGHT_KHZ)
        };

        // `Writer::write` takes an `impl Into<Arc<[u8]>>`, and the
        // `From<Arc<[u8]>> for Arc<[u8]>` implementation is the identity:
        // handing it a clone of the `Arc` only bumps a refcount. Passing a slice
        // (`&[u8]`) instead would copy the ~1200 bytes per subscriber.
        let _ = writer.write(
            pt,
            packet.network_time,
            rtp_time,
            Arc::clone(&packet.payload),
        );

        Ok(())
    }

    /// Converts a str0m `MediaData` received on this connection into an
    /// internal packet, rebasing the timestamp onto the media kind's RTP clock
    /// (90 kHz video, 48 kHz audio).
    ///
    /// The `MediaData` is consumed: its `data` field — already an `Arc<[u8]>` —
    /// is moved into the packet as is, without conversion or copy. It is the
    /// same type `Writer::write` expects on the way out, so the buffer received
    /// from str0m is the very one handed back to it.
    ///
    /// Returns `None` for a payload type absent from the negotiated codec
    /// config. The codec parameters are resolved here rather than carried as a
    /// bare payload type: a PT is local to one peer's negotiation, and the
    /// outbound side has to ask str0m for the PT that means the same codec on
    /// the subscriber's own m-line. Without them the payload would go out
    /// labelled with whatever codec happens to come first there.
    pub fn to_packet(&self, data: str0m::media::MediaData) -> Option<RtpPacketData> {
        let mid = data.mid;
        let is_video = self
            .rx_kind
            .get(&mid)
            .map(|k| *k == MediaKind::Video)
            .unwrap_or(false);

        let freq = if is_video {
            str0m::media::Frequency::NINETY_KHZ
        } else {
            str0m::media::Frequency::FORTY_EIGHT_KHZ
        };

        let params = self
            .rtc
            .codec_config()
            .params()
            .iter()
            .find(|p| p.pt() == data.pt)
            .copied();

        let Some(params) = params else {
            tracing::warn!(
                "Peer {} — PT {} absent du codec config, paquet ignoré",
                self.peer_id,
                data.pt
            );
            return None;
        };

        Some(RtpPacketData {
            params,
            payload: data.data,
            mid,
            network_time: data.network_time,
            rtp_time: data.time.rebase(freq).numer(),
            is_video,
        })
    }

    /// Emits a PLI on one of this peer's inbound m-lines.
    ///
    /// Addressed by mid rather than by SSRC: `Event::MediaData` does not expose
    /// SSRCs, so the SSRC list the previous implementation walked had been
    /// empty ever since the SFU moved from raw RTP mode to media mode — every
    /// keyframe request was a no-op, and a new subscriber had to wait for the
    /// publisher's next spontaneous keyframe to see a picture.
    pub fn request_keyframe(&mut self, mid: Mid) {
        let mut api = self.rtc.direct_api();
        let Some(stream) = api.stream_rx_by_mid(mid, None) else {
            tracing::debug!(
                "Peer {} — pas de flux entrant sur mid={}, PLI ignorée",
                self.peer_id,
                mid
            );
            return;
        };

        stream.request_keyframe(KeyframeRequestKind::Pli);
        tracing::debug!("Peer {} — PLI envoyée sur mid={}", self.peer_id, mid);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Reproduces exactly the signature of `str0m::media::Writer::write` for its
    /// `data` parameter, and returns the `Arc` as str0m sees it after the
    /// conversion it performs internally (`let data: Arc<[u8]> = data.into()`).
    fn comme_writer_write(data: impl Into<Arc<[u8]>>) -> Arc<[u8]> {
        data.into()
    }

    /// The form in which `write_rtp` hands the payload to str0m must not copy
    /// it.
    ///
    /// This is the property that removes the ~1200-byte copy per subscriber on
    /// the outbound path: `impl Into<Arc<[u8]>>` accepts both a `&[u8]` (which
    /// allocates and copies) and an `Arc<[u8]>` (moved by the reflexive
    /// `From<T> for T` implementation). The test locks in the second case and
    /// demonstrates the first, so that a regression towards `&payload[..]`
    /// becomes visible.
    #[test]
    fn ceder_un_arc_a_str0m_ne_copie_pas_le_payload() {
        let payload: Arc<[u8]> = Arc::from(vec![0xABu8; 1200]);
        let source = payload.as_ptr();

        // What `write_rtp` does today.
        let recu = comme_writer_write(Arc::clone(&payload));
        assert_eq!(
            recu.as_ptr(),
            source,
            "str0m doit recevoir le tampon publié, pas une copie"
        );

        // What the previous version did: the slice forces str0m to allocate and
        // copy.
        let recopie = comme_writer_write(&payload[..]);
        assert_ne!(
            recopie.as_ptr(),
            source,
            "passer une tranche recopierait — c'est la régression à éviter"
        );
        assert_eq!(&recopie[..], &payload[..]);
    }

    async fn connection(peer_id: &str) -> PeerConnection {
        let (sender, _rx) = mpsc::channel(8);
        PeerConnection::new(Arc::from(peer_id), sender, "127.0.0.1".to_string()).await
    }

    fn video_track(peer: &str, mid: &str) -> (TrackKey, MediaKind) {
        (
            TrackKey::new(Arc::from(peer), Mid::from(mid)),
            MediaKind::Video,
        )
    }

    #[tokio::test]
    async fn each_source_gets_its_own_m_line() {
        let mut conn = connection("alice").await;

        let (bob, kind) = video_track("bob", "1");
        let (carol, _) = video_track("carol", "1");
        assert!(conn.queue_subscription(bob.clone(), kind));
        assert!(conn.queue_subscription(carol.clone(), kind));

        let sdp = conn.negotiate().expect("une re-offer");

        // Two sources, two m-lines: this is the property whose absence made two
        // publishers collide into a single decoder.
        let mids: Vec<Mid> = conn.offered.iter().map(|(_, mid)| *mid).collect();
        assert_eq!(mids.len(), 2);
        assert_ne!(
            mids[0], mids[1],
            "deux publishers ne doivent jamais partager une m-line"
        );

        // And the offer says who each one belongs to.
        assert!(sdp.contains("a=sendonly"));
        assert!(sdp.contains("bob"), "le msid doit nommer le publisher");
        assert!(sdp.contains("carol"));
    }

    #[tokio::test]
    async fn a_source_is_never_queued_twice() {
        let mut conn = connection("alice").await;
        let (bob, kind) = video_track("bob", "1");

        assert!(conn.queue_subscription(bob.clone(), kind));
        assert!(
            !conn.queue_subscription(bob, kind),
            "annoncer deux fois la même source ne doit pas dupliquer la m-line"
        );

        conn.negotiate().expect("une re-offer");
        assert_eq!(conn.offered.len(), 1);
    }

    #[tokio::test]
    async fn audio_and_video_of_one_publisher_are_two_m_lines() {
        let mut conn = connection("alice").await;

        conn.queue_subscription(
            TrackKey::new(Arc::from("bob"), Mid::from("0")),
            MediaKind::Audio,
        );
        conn.queue_subscription(
            TrackKey::new(Arc::from("bob"), Mid::from("1")),
            MediaKind::Video,
        );

        conn.negotiate().expect("une re-offer");
        assert_eq!(conn.offered.len(), 2, "l'audio et la vidéo sont distincts");
    }

    #[tokio::test]
    async fn only_one_offer_travels_at_a_time() {
        let mut conn = connection("alice").await;
        let (bob, kind) = video_track("bob", "1");
        conn.queue_subscription(bob, kind);
        conn.negotiate().expect("une première re-offer");

        let (carol, _) = video_track("carol", "1");
        conn.queue_subscription(carol.clone(), kind);

        assert!(
            conn.negotiate().is_none(),
            "une seconde offer invaliderait la première : carol attend son tour"
        );
        assert!(
            conn.queued.iter().any(|(k, _)| *k == carol),
            "l'abonnement en attente ne doit pas être perdu"
        );
    }

    #[tokio::test]
    async fn nothing_to_negotiate_produces_no_offer() {
        let mut conn = connection("alice").await;
        assert!(conn.negotiate().is_none());
    }

    #[tokio::test]
    async fn an_answer_without_an_offer_is_refused() {
        let mut conn = connection("alice").await;
        assert!(conn.accept_answer("v=0\r\n").is_err());
    }

    #[tokio::test]
    async fn a_departed_publisher_frees_its_pending_subscriptions() {
        let mut conn = connection("alice").await;
        let (bob, kind) = video_track("bob", "1");
        conn.queue_subscription(bob, kind);

        // Bob leaves before the round trip even started.
        assert!(conn.drop_source("bob"), "l'abonnement en attente doit tomber");
        assert!(conn.queued.is_empty());
        assert!(
            conn.negotiate().is_none(),
            "il ne reste rien à négocier pour bob"
        );
    }
}
