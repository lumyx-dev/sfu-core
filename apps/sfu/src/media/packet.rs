//! An RTP packet in transit through the SFU.

use std::sync::Arc;
use str0m::format::PayloadParams;
use str0m::media::Mid;

/// An RTP packet received from a publisher, ready to be forwarded.
///
/// # What is *not* in here
///
/// No SSRC, no sequence number, no RTP timestamp. str0m is driven in media
/// mode, so `Writer::write()` regenerates the whole RTP header on the way out:
/// carrying those fields meant recomputing values nobody ever read. They come
/// back the day the SFU is put into `rtp_mode`, and not before.
///
/// # On the cost of cloning
///
/// The hot path clones this packet once per subscriber —
/// [`DownTrack::write_rtp`][crate::media::DownTrack::write_rtp] rewrites the
/// destination m-line for each one. Every field is therefore either `Copy` or
/// a refcount bump:
///
/// - `payload` is an `Arc<[u8]>` — a reference-counted shared buffer: cloning
///   it is an atomic increment, and the ~1200-byte buffer is never copied
///   between subscribers;
/// - `mid` is a str0m [`Mid`] — an inline 16-byte array, `Copy`;
/// - `params` is a str0m [`PayloadParams`] — a small `Copy` struct.
#[derive(Debug, Clone)]
pub struct RtpPacketData {
    /// Codec parameters **as negotiated with the publisher**.
    ///
    /// The payload type is not portable: two peers negotiate their own PT for
    /// the same codec. Carrying the parameters rather than the raw `u8` lets
    /// the outbound side ask str0m for the PT that means the same codec on the
    /// subscriber's m-line (`Writer::match_params`). Sending the publisher's
    /// PT verbatim would label, say, a VP8 payload with the number the
    /// subscriber reserved for H.264.
    pub params: PayloadParams,

    /// The encoded media, shared — never copied — across subscribers.
    pub payload: Arc<[u8]>,

    /// Destination m-line.
    ///
    /// The publisher's own mid on the way in; [`DownTrack`][crate::media::DownTrack]
    /// swaps it for the m-line allocated on the subscriber's connection before
    /// the packet reaches the transport.
    pub mid: Mid,

    /// When the packet was received, as str0m reported it.
    pub network_time: std::time::Instant,

    /// Media timestamp, rebased onto the media kind's clock (90 kHz video,
    /// 48 kHz audio).
    pub rtp_time: u64,

    /// Video rather than audio — decides the clock used when writing out.
    pub is_video: bool,
}
