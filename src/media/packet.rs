//! An RTP packet in transit through the SFU.

use std::sync::Arc;
use str0m::media::Mid;

/// An RTP packet received from a publisher, ready to be forwarded.
///
/// # On the cost of cloning
///
/// The hot path clones this packet once per subscriber
/// ([`DownTrack::write_rtp`][crate::media::DownTrack::write_rtp] rewrites a
/// full packet for each one). The two large fields are therefore chosen so
/// that the clone costs neither an allocation nor a copy:
///
/// - `payload` is an `Arc<[u8]>` — a reference-counted shared buffer: cloning
///   it is an atomic increment, and the ~1200-byte buffer is never copied
///   between subscribers;
/// - `mid` is a str0m [`Mid`] — an inline 16-byte array, `Copy`.
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
