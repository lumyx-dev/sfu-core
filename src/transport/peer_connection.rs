//! Connexion WebRTC d'un peer.

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
    /// `Arc<str>` et non `String` : l'identifiant ne change jamais et part avec
    /// chaque paquet reçu vers le moteur de forwarding, où le cloner doit rester
    /// un incrément de compteur plutôt qu'une allocation.
    pub peer_id: Arc<str>,
    pub rtc: Rtc,
    pub socket: Arc<UdpSocket>,
    pub remote_addr: Option<SocketAddr>,
    pub sender: mpsc::Sender<ServerMessage>,
    /// Hôte annoncé dans les candidats ICE locaux.
    pub ice_host: String,

    /// Médias négociés vers ce peer, par mid.
    pub tx_streams: HashMap<Mid, MediaKind>,
    /// Type de média par mid, pour choisir l'horloge RTP à l'écriture.
    pub mid_kind: HashMap<Mid, MediaKind>,

    /// SSRC entrants, cible des PLI émises par [`Self::request_keyframe`].
    ///
    /// NOTE : ce vecteur n'est plus alimenté depuis que le SFU est repassé du
    /// mode RTP brut (`Event::RtpPacket`) au mode média (`Event::MediaData`),
    /// qui n'expose pas les SSRC. `request_keyframe` est donc sans effet en
    /// l'état. Conservé tel quel — le remettre en service est un changement de
    /// comportement, traité séparément.
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

    /// Adresse annoncée dans les candidats ICE locaux.
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

    /// Accepte l'offer du client et renvoie l'answer, également poussée
    /// au client via le canal de signaling.
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
        // `handle_offer` est synchrone : `try_send` plutôt qu'un `send().await`.
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

    /// Écrit un paquet forwardé vers ce peer.
    ///
    /// str0m régénère lui-même l'en-tête RTP (SSRC, séquence, timestamp) ; seuls
    /// le payload, le mid et l'horodatage média sont repris du paquet source.
    pub fn write_rtp(&mut self, packet: &RtpPacketData) -> Result<()> {
        // `tx_streams` n'est alimenté que par `Event::MediaAdded`, donc un mid
        // que ce peer n'a pas négocié — y compris un mid vide, qu'aucun chemin
        // ne produit plus depuis que le paquet porte un `Mid` typé — retombe
        // ici. La garde `is_empty()` d'avant était redondante avec ce test.
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

        // `Writer::write` prend un `impl Into<Arc<[u8]>>`, et l'implémentation
        // `From<Arc<[u8]>> for Arc<[u8]>` est l'identité : lui céder un clone de
        // l'`Arc` n'incrémente qu'un compteur. Passer une tranche (`&[u8]`) à la
        // place ferait recopier les ~1200 octets par subscriber.
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

    /// Émet une PLI sur chaque SSRC entrant connu.
    ///
    /// Sans effet tant que [`Self::rx_ssrcs`] reste vide — voir sa note.
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

    /// Reproduit exactement la signature de `str0m::media::Writer::write` pour
    /// son paramètre `data`, et rend l'`Arc` tel que str0m le voit après la
    /// conversion qu'il effectue en interne (`let data: Arc<[u8]> = data.into()`).
    fn comme_writer_write(data: impl Into<Arc<[u8]>>) -> Arc<[u8]> {
        data.into()
    }

    /// La forme sous laquelle `write_rtp` cède le payload à str0m ne doit pas le
    /// recopier.
    ///
    /// C'est la propriété qui fait tomber la copie de ~1200 octets par
    /// subscriber sur le chemin de sortie : `impl Into<Arc<[u8]>>` accepte aussi
    /// bien un `&[u8]` (qui alloue et recopie) qu'un `Arc<[u8]>` (déplacé par
    /// l'implémentation réflexive `From<T> for T`). Le test verrouille le second
    /// cas et démontre le premier, pour qu'une régression vers `&payload[..]`
    /// devienne visible.
    #[test]
    fn ceder_un_arc_a_str0m_ne_copie_pas_le_payload() {
        let payload: Arc<[u8]> = Arc::from(vec![0xABu8; 1200]);
        let source = payload.as_ptr();

        // Ce que fait `write_rtp` aujourd'hui.
        let recu = comme_writer_write(Arc::clone(&payload));
        assert_eq!(
            recu.as_ptr(),
            source,
            "str0m doit recevoir le tampon publié, pas une copie"
        );

        // Ce que faisait la version précédente : la tranche force str0m à
        // allouer et recopier.
        let recopie = comme_writer_write(&payload[..]);
        assert_ne!(
            recopie.as_ptr(),
            source,
            "passer une tranche recopierait — c'est la régression à éviter"
        );
        assert_eq!(&recopie[..], &payload[..]);
    }
}
