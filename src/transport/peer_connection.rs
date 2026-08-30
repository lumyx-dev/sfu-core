//! A peer's WebRTC connection.

use crate::error::{Result, SfuError};
use crate::media::RtpPacketData;
use crate::signaling::ServerMessage;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Instant;
use str0m::{
    Candidate, Rtc,
    change::SdpOffer,
    media::{MediaKind, Mid},
    rtp::Ssrc,
};
use tokio::net::UdpSocket;
use tokio::sync::mpsc;

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

    /// Media negotiated towards this peer, by mid.
    pub tx_streams: HashMap<Mid, MediaKind>,
    /// Media kind per mid, used to pick the RTP clock when writing.
    pub mid_kind: HashMap<Mid, MediaKind>,

    /// Inbound SSRCs, target of the PLIs emitted by [`Self::request_keyframe`].
    ///
    /// NOTE: this vector is no longer populated since the SFU moved back from
    /// raw RTP mode (`Event::RtpPacket`) to media mode (`Event::MediaData`),
    /// which does not expose SSRCs. `request_keyframe` is therefore a no-op as
    /// it stands. Kept as is — putting it back in service is a behaviour
    /// change, handled separately.
    pub rx_ssrcs: Vec<Ssrc>,
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
            tx_streams: HashMap::new(),
            mid_kind: HashMap::new(),
            rx_ssrcs: Vec::new(),
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

    /// Writes a forwarded packet towards this peer.
    ///
    /// str0m regenerates the RTP header itself (SSRC, sequence, timestamp);
    /// only the payload, the mid and the media timestamp are taken from the
    /// source packet.
    pub fn write_rtp(&mut self, packet: &RtpPacketData) -> Result<()> {
        // `tx_streams` is only populated by `Event::MediaAdded`, so a mid this
        // peer has not negotiated — including an empty mid, which no path
        // produces any more now that the packet carries a typed `Mid` — falls
        // through here. The previous `is_empty()` guard was redundant with this
        // check.
        let mid = packet.mid;
        if !self.tx_streams.contains_key(&mid) {
            return Ok(());
        }

        let Some(writer) = self.rtc.writer(mid) else {
            tracing::warn!("Peer {} — writer non trouvé mid={:?}", self.peer_id, mid);
            return Ok(());
        };

        let Some(pt) = writer.payload_params().next().map(|p| p.pt()) else {
            tracing::warn!(
                "Peer {} — aucun PT disponible pour mid={:?}",
                self.peer_id,
                mid
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
        let _ = writer.write(pt, packet.network_time, rtp_time, Arc::clone(&packet.payload));

        tracing::debug!(
            "Peer {} — write_rtp mid={:?} pt={:?} is_video={} {} bytes",
            self.peer_id,
            mid,
            pt,
            packet.is_video,
            packet.payload.len()
        );

        Ok(())
    }

    /// Emits a PLI on every known inbound SSRC.
    ///
    /// A no-op as long as [`Self::rx_ssrcs`] stays empty — see its note.
    pub fn request_keyframe(&mut self) {
        for ssrc in self.rx_ssrcs.clone() {
            let mut api = self.rtc.direct_api();
            if let Some(stream) = api.stream_rx(&ssrc) {
                stream.request_keyframe(str0m::media::KeyframeRequestKind::Pli);
                tracing::info!("Peer {} — PLI envoyée ssrc={:?}", self.peer_id, ssrc);
            }
        }
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
}
