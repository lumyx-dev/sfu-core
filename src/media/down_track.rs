//! Outbound stream towards a given subscriber.

use super::packet::RtpPacketData;
use super::sink::RtpSink;
use rand::RngExt;
use std::sync::Arc;
use std::sync::atomic::{AtomicU16, AtomicU32, Ordering};

/// A (source stream, subscriber) pair: rewrites the packet, then hands it to
/// the sink.
///
/// # On SSRC / seq / timestamp rewriting
///
/// The `ssrc`, `sequence_number` and `timestamp` fields recomputed below never
/// reach the network: `PeerConnection::write_rtp` goes through
/// `str0m::media::Writer::write()`, which regenerates the RTP header itself.
/// This remapping is therefore inert today.
///
/// It is kept on purpose: it becomes necessary again as soon as str0m is put
/// back into `rtp_mode` (transparent RTP forwarding), where the SFU is the one
/// writing the header. Removing it would only cost us writing it again.
pub struct DownTrack {
    pub peer_id: String,
    pub track_id: String,

    /// Unique SSRC for this outbound stream.
    ssrc: u32,
    /// RTP sequence specific to this subscriber.
    sequence_number: AtomicU16,
    /// Timestamp offset applied to the source stream.
    timestamp_offset: AtomicU32,

    /// Destination for the rewritten packets.
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

    /// SSRC assigned to this outbound stream.
    pub fn ssrc(&self) -> u32 {
        self.ssrc
    }

    /// Rewrites the packet for this subscriber and hands it to the sink.
    pub fn write_rtp(&self, packet: &RtpPacketData) {
        let seq = self.sequence_number.fetch_add(1, Ordering::Relaxed);
        let ts_offset = self.timestamp_offset.load(Ordering::Relaxed);

        let rewritten = RtpPacketData {
            payload_type: packet.payload_type,
            sequence_number: seq,
            timestamp: packet.timestamp.wrapping_add(ts_offset),
            ssrc: self.ssrc,
            // Cloning an `Arc<[u8]>`: a refcount bump, not a copy of the
            // payload. The buffer stays shared across every subscriber.
            payload: Arc::clone(&packet.payload),
            is_keyframe: packet.is_keyframe,
            // `Mid` is `Copy` (16 inline bytes).
            mid: packet.mid,
            network_time: packet.network_time,
            rtp_time: packet.rtp_time,
            is_video: packet.is_video,
        };

        self.sink.write_rtp(rewritten);
    }
}
