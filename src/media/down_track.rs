//! Outbound stream towards a given subscriber.

use super::packet::RtpPacketData;
use super::sink::RtpSink;
use std::sync::Arc;
use str0m::media::Mid;

/// A (source track, subscriber) pair: points the packet at the right outbound
/// m-line, then hands it to the sink.
///
/// # Why this type exists
///
/// A packet arrives carrying the **publisher's** mid. Every browser numbers
/// its m-lines the same way, so forwarding that mid as is made two publishers
/// write into a single outbound stream on the subscriber — two encoded videos
/// interleaved into one decoder. The down_track is where that is fixed: it
/// holds the m-line the SFU negotiated on *this* subscriber's connection for
/// *this* source, and stamps it on every packet on the way through.
///
/// It carries no SSRC, sequence or timestamp rewriting: str0m in media mode
/// regenerates the RTP header itself, so the SFU's only job on the outbound
/// path is picking the destination.
pub struct DownTrack {
    pub subscriber_id: Arc<str>,

    /// M-line allocated on the subscriber's connection for this source.
    target_mid: Mid,

    /// Destination for the retargeted packets.
    sink: Arc<dyn RtpSink>,
}

impl DownTrack {
    pub fn new(subscriber_id: Arc<str>, target_mid: Mid, sink: Arc<dyn RtpSink>) -> Self {
        DownTrack {
            subscriber_id,
            target_mid,
            sink,
        }
    }

    /// M-line this stream is written to on the subscriber's connection.
    pub fn target_mid(&self) -> Mid {
        self.target_mid
    }

    /// Retargets the packet at this subscriber's m-line and hands it to the sink.
    pub fn write_rtp(&self, packet: &RtpPacketData) {
        // Cloning is a refcount bump on the payload plus a few `Copy` fields —
        // the ~1200-byte buffer stays shared across every subscriber.
        let mut retargeted = packet.clone();
        retargeted.mid = self.target_mid;

        self.sink.write_rtp(retargeted);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;
    use std::time::Instant;
    use str0m::format::PayloadParams;
    use str0m::media::Pt;

    #[derive(Default)]
    struct RecordingSink(Mutex<Vec<RtpPacketData>>);

    impl RtpSink for RecordingSink {
        fn write_rtp(&self, packet: RtpPacketData) {
            self.0.lock().expect("sink non empoisonné").push(packet);
        }
        fn request_keyframe(&self, _mid: Mid) {}
    }

    fn vp8_params() -> PayloadParams {
        PayloadParams::new(
            Pt::from(96),
            None,
            str0m::format::CodecSpec {
                codec: str0m::format::Codec::Vp8,
                clock_rate: str0m::media::Frequency::NINETY_KHZ,
                channels: None,
                format: Default::default(),
            },
        )
    }

    fn packet(payload: &[u8], mid: &str) -> RtpPacketData {
        RtpPacketData {
            params: vp8_params(),
            payload: Arc::from(payload),
            mid: Mid::from(mid),
            network_time: Instant::now(),
            rtp_time: 90_000,
            is_video: true,
        }
    }

    #[test]
    fn the_publishers_mid_is_replaced_by_the_subscribers() {
        let sink = Arc::new(RecordingSink::default());
        let track = DownTrack::new(Arc::from("bob"), Mid::from("7"), sink.clone());

        // The publisher writes on its own mid "1"; bob's m-line for it is "7".
        track.write_rtp(&packet(b"frame", "1"));

        let received = sink.0.lock().unwrap();
        assert_eq!(received[0].mid, Mid::from("7"));
    }

    #[test]
    fn two_down_tracks_of_the_same_source_target_their_own_m_lines() {
        // This is the regression that produced the corrupted picture: both
        // subscribers used to be written on the publisher's mid.
        let to_bob = Arc::new(RecordingSink::default());
        let to_carol = Arc::new(RecordingSink::default());

        DownTrack::new(Arc::from("bob"), Mid::from("2"), to_bob.clone())
            .write_rtp(&packet(b"frame", "1"));
        DownTrack::new(Arc::from("carol"), Mid::from("5"), to_carol.clone())
            .write_rtp(&packet(b"frame", "1"));

        assert_eq!(to_bob.0.lock().unwrap()[0].mid, Mid::from("2"));
        assert_eq!(to_carol.0.lock().unwrap()[0].mid, Mid::from("5"));
    }

    #[test]
    fn retargeting_does_not_copy_the_payload() {
        let sink = Arc::new(RecordingSink::default());
        let track = DownTrack::new(Arc::from("bob"), Mid::from("2"), sink.clone());

        let packet = packet(&[0xABu8; 1200], "1");
        let source = packet.payload.as_ptr();
        track.write_rtp(&packet);

        assert_eq!(
            sink.0.lock().unwrap()[0].payload.as_ptr(),
            source,
            "le tampon doit rester partagé, pas recopié"
        );
    }
}
