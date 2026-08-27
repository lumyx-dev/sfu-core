//! Flux sortant vers un subscriber donné.

use super::packet::RtpPacketData;
use super::sink::RtpSink;
use rand::RngExt;
use std::sync::Arc;
use std::sync::atomic::{AtomicU16, AtomicU32, Ordering};

/// Un couple (flux source, subscriber) : réécrit le paquet puis le remet au sink.
///
/// # Sur la réécriture SSRC / seq / timestamp
///
/// Les champs `ssrc`, `sequence_number` et `timestamp` recalculés ci-dessous
/// n'atteignent pas le réseau : `PeerConnection::write_rtp` passe par
/// `str0m::media::Writer::write()`, qui régénère lui-même l'en-tête RTP. Ce
/// remapping est donc inerte aujourd'hui.
///
/// Il est conservé volontairement : il redevient nécessaire dès qu'on repasse
/// str0m en `rtp_mode` (forwarding RTP transparent), où c'est le SFU qui écrit
/// l'en-tête. Le retirer coûterait à le réécrire.
pub struct DownTrack {
    pub peer_id: String,
    pub track_id: String,

    /// SSRC unique de ce flux sortant.
    ssrc: u32,
    /// Séquence RTP propre à ce subscriber.
    sequence_number: AtomicU16,
    /// Décalage de timestamp appliqué au flux source.
    timestamp_offset: AtomicU32,

    /// Destination des paquets réécrits.
    sink: Arc<dyn RtpSink>,
}

impl DownTrack {
    pub fn new(peer_id: String, track_id: String, sink: Arc<dyn RtpSink>) -> Self {
        let mut rng = rand::rng();

        DownTrack {
            peer_id,
            track_id,
            ssrc: rng.random::<u32>(),
            sequence_number: AtomicU16::new(rng.random::<u16>()),
            timestamp_offset: AtomicU32::new(rng.random::<u32>()),
            sink,
        }
    }

    /// SSRC attribué à ce flux sortant.
    pub fn ssrc(&self) -> u32 {
        self.ssrc
    }

    /// Réécrit le paquet pour ce subscriber et le remet au sink.
    pub fn write_rtp(&self, packet: &RtpPacketData) {
        let seq = self.sequence_number.fetch_add(1, Ordering::Relaxed);
        let ts_offset = self.timestamp_offset.load(Ordering::Relaxed);

        let rewritten = RtpPacketData {
            payload_type: packet.payload_type,
            sequence_number: seq,
            timestamp: packet.timestamp.wrapping_add(ts_offset),
            ssrc: self.ssrc,
            // Clone d'un `Arc<[u8]>` : incrément de compteur, pas de copie du
            // payload. Le tampon reste partagé par tous les subscribers.
            payload: Arc::clone(&packet.payload),
            is_keyframe: packet.is_keyframe,
            // `Mid` est `Copy` (16 octets inline).
            mid: packet.mid,
            network_time: packet.network_time,
            rtp_time: packet.rtp_time,
            is_video: packet.is_video,
        };

        self.sink.write_rtp(rewritten);
    }
}
