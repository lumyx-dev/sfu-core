export type Metric = {
  name: string;
  field: string;
  unit: string;
  threshold: string;
  scope: string;
  breaks: string;
  body: string;
  sample: string[];
  action: string;
};

export const METRICS: Metric[] = [
  {
    name: "Packet loss", field: "packet_loss_ratio", unit: "ratio, shown as %", threshold: "> 2%", scope: "peer, room",
    breaks: "Choppy audio, frozen frames",
    body: "Fraction of RTP packets the receiver reported missing over the interval, read from RTCP receiver reports. Above 2% sustained, audio artefacts become audible before video visibly breaks.",
    sample: ['"packet_loss_ratio": 0.079,', '"packets_lost": 412,', '"packets_expected": 5215'],
    action: "Response: force audio-only for that peer, or drop it to a lower simulcast layer to reduce what has to survive the link.",
  },
  {
    name: "Round-trip time", field: "rtt_ms", unit: "milliseconds", threshold: "> 200ms", scope: "peer",
    breaks: "Participants talking over each other",
    body: "Round trip between the SFU and the peer, from RTCP sender/receiver report timestamps. Conversation stops feeling natural somewhere past 200ms one-way perceived latency.",
    sample: ['"rtt_ms": 284,', '"rtt_p95_ms": 331,', '"ice_candidate_type": "relay"'],
    action: "Response: check whether the peer fell back to a TURN relay, and whether a closer region exists for that user population.",
  },
  {
    name: "Jitter", field: "jitter_ms", unit: "milliseconds", threshold: "> 30ms", scope: "peer",
    breaks: "Growing jitter buffer, drifting latency",
    body: "Variance in packet arrival timing. The receiver absorbs it by growing its jitter buffer, which trades latency for smoothness — so high jitter shows up as delay creeping upward rather than as loss.",
    sample: ['"jitter_ms": 42,', '"jitter_buffer_delay_ms": 180'],
    action: "Response: usually a network path problem rather than a bandwidth problem. Compare with loss before touching bitrate.",
  },
  {
    name: "NACK ratio", field: "nack_ratio", unit: "ratio, shown as %", threshold: "> 5%", scope: "peer",
    breaks: "Retransmission storms, saturated uplink",
    body: "Share of packets that had to be requested again. A rising NACK ratio is the earliest signal that a peer uplink is saturated — it moves before loss and before freeze ratio.",
    sample: ['"nack_ratio": 0.114,', '"nack_count": 1284,', '"retransmit_bytes": 482113'],
    action: "Response: reduce the target bitrate for that publisher, or turn off the highest simulcast layer for the room.",
  },
  {
    name: "Freeze ratio", field: "freeze_ratio", unit: "ratio, shown as %", threshold: "> 1%", scope: "peer",
    breaks: "Video the user calls broken",
    body: "Share of the interval during which the decoder produced no new frame. This is the metric closest to what a participant actually complains about, which is why its threshold is the tightest.",
    sample: ['"freeze_ratio": 0.041,', '"freeze_count": 6,', '"total_freeze_duration_ms": 2460'],
    action: "Response: if freeze is high while loss is low, look at the sender — encoder starvation and CPU pressure produce exactly this shape.",
  },
  {
    name: "Bitrate", field: "bitrate_kbps", unit: "kilobits per second", threshold: "< 100kbps", scope: "peer, track, room",
    breaks: "Encoder giving up entirely",
    body: "Forwarded bitrate per track. Reported as a floor rather than a ceiling: a video track that collapses under 100kbps has effectively stopped being video.",
    sample: ['"bitrate_kbps": 84,', '"target_bitrate_kbps": 1200,', '"codec": "vp8", "layer": "f"'],
    action: "Response: check congestion control decisions and whether the publisher is CPU-bound before assuming the network.",
  },
];
