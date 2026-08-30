//! Destination of an outbound RTP stream.

use super::packet::RtpPacketData;

/// Where [`crate::media::ForwardingEngine`] drops the packets bound for a peer.
///
/// This is the boundary between the media layer and the transport layer: the
/// forwarding engine handles `Arc<dyn RtpSink>` values without ever seeing a
/// `PeerConnection`. The production implementation is
/// [`crate::transport::PeerSink`]; tests inject an in-memory sink.
///
/// Both methods must be non-blocking — they are called from the hot path, once
/// per packet per subscriber.
pub trait RtpSink: Send + Sync {
    /// Hands a packet to the peer. A closed sink silently swallows it.
    fn write_rtp(&self, packet: RtpPacketData);

    /// Requests a keyframe from the peer (PLI).
    fn request_keyframe(&self);
}
