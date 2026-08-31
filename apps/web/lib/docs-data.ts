export const METRICS = [
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

export const DOC_NAV = [
  { title: "Getting started", items: [
    { id: "x-intro", label: "Introduction" },
    { id: "x-quickstart", label: "Quickstart" },
    { id: "x-selfhost", label: "Self-hosting" },
    { id: "x-cloud", label: "Sightline Cloud" },
  ]},
  { title: "Core concepts", items: [
    { id: "x-rooms", label: "Rooms and sessions" },
    { id: "x-peers", label: "Peers and tracks" },
    { id: "x-signaling", label: "Signaling protocol" },
    { id: "x-forwarding", label: "Selective forwarding" },
  ]},
  { title: "Observability", items: [
    { id: "thresholds", label: "Metrics reference", active: true },
    { id: "x-alerting", label: "Alerting and webhooks" },
    { id: "x-topology", label: "Room topology" },
    { id: "x-replay", label: "Session replay" },
    { id: "x-prometheus", label: "Prometheus endpoint" },
  ]},
  { title: "Migrating", items: [
    { id: "x-livekit", label: "From LiveKit" },
    { id: "x-tokens", label: "Token compatibility" },
  ]},
  { title: "Reference", items: [
    { id: "x-api", label: "REST API" },
    { id: "x-config", label: "Configuration" },
    { id: "x-errors", label: "Error codes" },
  ]},
];

export const RELEASES = [
  {
    version: "v0.4.1", date: "26 Aug 2026", commit: "a3f91c0", latest: true,
    summary: "Freeze ratio joins the default threshold set, and the room topology view gets per-edge bitrate. Mostly a collector release.",
    groups: [
      { kind: "Added", tone: "ok" as const, items: [
        "freeze_ratio is now armed by default at 1%, with the same 30s debounce as the other five metrics.",
        "Room topology reports bitrate per edge, so a saturated uplink is visible without opening a peer.",
        "Prometheus endpoint exposes per-room labels alongside the existing per-peer series.",
      ]},
      { kind: "Fixed", tone: "neutral" as const, items: [
        "NACK ratio was averaged over the wrong window on tracks with simulcast enabled, under-reporting by roughly 12%.",
        "A peer that reconnected within the debounce window could raise a duplicate alert.",
      ]},
    ],
  },
  {
    version: "v0.4.0", date: "11 Aug 2026", commit: "7d20b48", latest: false,
    summary: "Session replay lands: metrics and signaling events for a finished session, timestamped and queryable for the retention window.",
    breaking: "The metrics payload field loss_pct is renamed packet_loss_ratio and is now a ratio (0–1) rather than a percentage. Update any consumer that reads it directly — the dashboard and webhooks handle both for one more minor version.",
    groups: [
      { kind: "Added", tone: "ok" as const, items: [
        "Session replay for finished sessions, with signaling events interleaved on the same timeline.",
        "CSV export of a session or a date range from the dashboard and the REST API.",
      ]},
      { kind: "Changed", tone: "room" as const, items: [
        "Stats interval drops from 5s to 2s. Storage per peer-hour roughly doubles; retention limits are unchanged.",
        "Thresholds move from global config to per project and per environment.",
      ]},
    ],
  },
  {
    version: "v0.3.8", date: "29 Jul 2026", commit: "c27ad93", latest: false,
    summary: "Signaling compatibility work. LiveKit token grants and message names are now accepted verbatim, which makes the migration a one-line change.",
    groups: [
      { kind: "Added", tone: "ok" as const, items: [
        "LiveKit-compatible token grants: publish, subscribe, publishData, roomAdmin.",
        "Signed webhooks for room.* and alert.* events, with delivery failures surfaced in Alerts.",
      ]},
      { kind: "Fixed", tone: "neutral" as const, items: [
        "ICE restart could leave a stale forwarding entry for up to one stats interval.",
        "Dashboard showed a disconnected peer as degraded rather than disconnected.",
      ]},
    ],
  },
  {
    version: "v0.3.0", date: "2 Jul 2026", commit: "1f84e20", latest: false,
    summary: "First public release. Selective forwarding, the six metrics, default thresholds, and the dashboard that ships with the binary.",
    groups: [
      { kind: "Added", tone: "ok" as const, items: [
        "Selective forwarding with ICE, DTLS and SRTP, in a single static binary.",
        "Six metrics collected in the media path, per peer and per room.",
        "Dashboard with overview, rooms, room detail and alerts.",
      ]},
    ],
  },
];
