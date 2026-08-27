//! Paquet RTP en transit dans le SFU.

use std::sync::Arc;
use str0m::media::Mid;

/// Un paquet RTP reçu d'un publisher, prêt à être forwardé.
///
/// # Sur le coût du clone
///
/// Le chemin chaud clone ce paquet une fois par subscriber
/// ([`DownTrack::write_rtp`][crate::media::DownTrack::write_rtp] réécrit un
/// paquet complet pour chacun). Les deux champs volumineux sont donc choisis
/// pour que ce clone ne coûte ni allocation ni copie :
///
/// - `payload` est un `Arc<[u8]>` — tampon partagé à comptage de références :
///   le cloner est un incrément atomique, le buffer de ~1200 octets n'est
///   jamais recopié entre subscribers ;
/// - `mid` est un [`Mid`] str0m — tableau inline de 16 octets, `Copy`.
#[derive(Debug, Clone)]
pub struct RtpPacketData {
    pub payload_type: u8,
    pub sequence_number: u16,
    pub timestamp: u32,
    pub ssrc: u32,
    pub payload: Arc<[u8]>,
    pub is_keyframe: bool,
    pub mid: Mid,
    pub network_time: std::time::Instant,
    pub rtp_time: u64,
    pub is_video: bool,
}
