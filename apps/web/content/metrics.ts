// Source de vérité : la référence des métriques du README.md du dépôt. Ces six champs et
// leurs seuils sont réels — contrairement au reste du contenu marketing. Cette constante
// sera partagée avec apps/dashboard (sous-projet B) : la déplacer dans un package commun
// le jour où le dashboard en a besoin, plutôt que de la dupliquer.

export interface Metric {
  name: string;
  field: string;
  unit: string;
  threshold: string;
  scope: string;
  breaks: string;
  body: string;
  /** Example payload, one rendered line per array entry (Docs.dc.html:112-114). */
  sample: string[];
  /** The "Response: …" recommendation rendered under the sample block (Docs.dc.html:116). */
  action: string;
}

export const METRICS: Metric[] = [
  {
    name: 'Packet loss',
    field: 'packet_loss_ratio',
    unit: 'ratio, shown as %',
    threshold: '> 2%',
    scope: 'peer, room',
    breaks: 'Choppy audio, frozen frames',
    body: 'Fraction of RTP packets the receiver reported missing over the interval, read from RTCP receiver reports. Above 2% sustained, audio artefacts become audible before video visibly breaks.',
    sample: ['"packet_loss_ratio": 0.079,', '"packets_lost": 412,', '"packets_expected": 5215'],
    action:
      'Response: force audio-only for that peer, or drop it to a lower simulcast layer to reduce what has to survive the link.',
  },
  {
    name: 'Round-trip time',
    field: 'rtt_ms',
    unit: 'milliseconds',
    threshold: '> 200ms',
    scope: 'peer',
    breaks: 'Participants talking over each other',
    body: 'Round trip between the SFU and the peer, from RTCP sender/receiver report timestamps. Conversation stops feeling natural somewhere past 200ms one-way perceived latency.',
    sample: ['"rtt_ms": 284,', '"rtt_p95_ms": 331,', '"ice_candidate_type": "relay"'],
    action:
      'Response: check whether the peer fell back to a TURN relay, and whether a closer region exists for that user population.',
  },
  {
    name: 'Jitter',
    field: 'jitter_ms',
    unit: 'milliseconds',
    threshold: '> 30ms',
    scope: 'peer',
    breaks: 'Growing jitter buffer, drifting latency',
    body: 'Variance in packet arrival timing. The receiver absorbs it by growing its jitter buffer, which trades latency for smoothness — so high jitter shows up as delay creeping upward rather than as loss.',
    sample: ['"jitter_ms": 42,', '"jitter_buffer_delay_ms": 180'],
    action:
      'Response: usually a network path problem rather than a bandwidth problem. Compare with loss before touching bitrate.',
  },
  {
    name: 'NACK ratio',
    field: 'nack_ratio',
    unit: 'ratio, shown as %',
    threshold: '> 5%',
    scope: 'peer',
    breaks: 'Retransmission storms, saturated uplink',
    body: 'Share of packets that had to be requested again. A rising NACK ratio is the earliest signal that a peer uplink is saturated — it moves before loss and before freeze ratio.',
    sample: ['"nack_ratio": 0.114,', '"nack_count": 1284,', '"retransmit_bytes": 482113'],
    action:
      'Response: reduce the target bitrate for that publisher, or turn off the highest simulcast layer for the room.',
  },
  {
    name: 'Freeze ratio',
    field: 'freeze_ratio',
    unit: 'ratio, shown as %',
    threshold: '> 1%',
    scope: 'peer',
    breaks: 'Video the user calls broken',
    body: 'Share of the interval during which the decoder produced no new frame. This is the metric closest to what a participant actually complains about, which is why its threshold is the tightest.',
    sample: ['"freeze_ratio": 0.041,', '"freeze_count": 6,', '"total_freeze_duration_ms": 2460'],
    action:
      'Response: if freeze is high while loss is low, look at the sender — encoder starvation and CPU pressure produce exactly this shape.',
  },
  {
    name: 'Bitrate',
    field: 'bitrate_kbps',
    unit: 'kilobits per second',
    threshold: '< 100kbps',
    scope: 'peer, track, room',
    breaks: 'Encoder giving up entirely',
    body: 'Forwarded bitrate per track. Reported as a floor rather than a ceiling: a video track that collapses under 100kbps has effectively stopped being video.',
    sample: ['"bitrate_kbps": 84,', '"target_bitrate_kbps": 1200,', '"codec": "vp8", "layer": "f"'],
    action:
      'Response: check congestion control decisions and whether the publisher is CPU-bound before assuming the network.',
  },
];

export interface DocNavItem {
  id: string;
  label: string;
}

// Right-rail scroll-spy anchors — the source's `onThisPage` array (Docs.dc.html:283-292), not
// its top-level `DOC_NAV` script constant (that one is the *left* nav's grouped sections, kept
// below as DOC_SECTIONS to avoid the name collision). Consumed by DocsRail.tsx.
export const DOC_NAV: DocNavItem[] = [
  { id: 'thresholds', label: 'Default thresholds' },
  { id: 'packet_loss_ratio', label: 'Packet loss' },
  { id: 'rtt_ms', label: 'Round-trip time' },
  { id: 'jitter_ms', label: 'Jitter' },
  { id: 'nack_ratio', label: 'NACK ratio' },
  { id: 'freeze_ratio', label: 'Freeze ratio' },
  { id: 'bitrate_kbps', label: 'Bitrate' },
  { id: 'overrides', label: 'Overriding a threshold' },
];

// The `PATCH /v1/projects/live-classroom/thresholds` example (Docs.dc.html:273-281), copied
// verbatim — one rendered line per array entry, same shape as Metric.sample.
export const OVERRIDE_SAMPLE: string[] = [
  'PATCH /v1/projects/live-classroom/thresholds',
  'Authorization: Bearer sk_live_••••4f2a',
  '',
  '{ "environment": "staging",',
  '  "packet_loss_ratio": 0.05,',
  '  "rtt_ms": 400,',
  '  "debounce_seconds": 120 }',
];

export interface DocSectionItem {
  id: string;
  label: string;
  /** True for exactly one item on the whole site: "the page you are on". Static, not client state. */
  active?: boolean;
}

export interface DocSection {
  title: string;
  items: DocSectionItem[];
}

// Left navigation, grouped by section (Docs.dc.html:211-240 — the source's own top-level
// `DOC_NAV` constant). Only 'thresholds' (this page) is marked active; every other id is a
// placeholder anchor for a doc page this task does not build.
export const DOC_SECTIONS: DocSection[] = [
  {
    title: 'Getting started',
    items: [
      { id: 'x-intro', label: 'Introduction' },
      { id: 'x-quickstart', label: 'Quickstart' },
      { id: 'x-selfhost', label: 'Self-hosting' },
      { id: 'x-cloud', label: 'Sightline Cloud' },
    ],
  },
  {
    title: 'Core concepts',
    items: [
      { id: 'x-rooms', label: 'Rooms and sessions' },
      { id: 'x-peers', label: 'Peers and tracks' },
      { id: 'x-signaling', label: 'Signaling protocol' },
      { id: 'x-forwarding', label: 'Selective forwarding' },
    ],
  },
  {
    title: 'Observability',
    items: [
      { id: 'thresholds', label: 'Metrics reference', active: true },
      { id: 'x-alerting', label: 'Alerting and webhooks' },
      { id: 'x-topology', label: 'Room topology' },
      { id: 'x-replay', label: 'Session replay' },
      { id: 'x-prometheus', label: 'Prometheus endpoint' },
    ],
  },
  {
    title: 'Migrating',
    items: [
      { id: 'x-livekit', label: 'From LiveKit' },
      { id: 'x-tokens', label: 'Token compatibility' },
    ],
  },
  {
    title: 'Reference',
    items: [
      { id: 'x-api', label: 'REST API' },
      { id: 'x-config', label: 'Configuration' },
      { id: 'x-errors', label: 'Error codes' },
    ],
  },
];
