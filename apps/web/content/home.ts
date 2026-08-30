// Ported from $HANDOFF/designs/Home.dc.html — the <script data-dc-script> logic class.
// HERO_PEERS, START, COMPARE, TOPO_LEGEND, MARQUEE_ITEMS and series() are copied from that
// source; see task-6-report.md for the handful of shape adjustments (field names, HeroPeer.
// status vocabulary, snippet title/note) made to fit this app's types and the design system's
// actual component contracts.

export interface Snippet {
  title: string;
  body: string;
  note: string;
}

export interface SnippetSet {
  tabs: { id: string; label: string }[];
  snippets: Record<string, Snippet>;
}

// Source HERO_PEERS only ever uses 'degraded' and 'live' — never 'warn' or 'error' — and those
// are the only two values StatusDot (@sightline/ui) needs to render this table.
export interface HeroPeer {
  peerId: string;
  score: number;
  rtt: number;
  loss: number;
  status: 'live' | 'degraded';
}

export interface CompareRow {
  label: string;
  sightline: string;
  other: string;
}

export interface TopoLegendEntry {
  title: string;
  body: string;
}

// Source: HERO_PEERS (Home.dc.html, logic class). peer_id -> peerId to match this codebase's
// camelCase content convention (see content/pricing.ts) — the identifier values themselves are
// left unprettified.
export const HERO_PEERS: HeroPeer[] = [
  { peerId: 'ff104b2c', score: 18, rtt: 284, loss: 7.9, status: 'degraded' },
  { peerId: 'd41f9ab7', score: 41, rtt: 212, loss: 3.41, status: 'degraded' },
  { peerId: '2f81be07', score: 62, rtt: 128, loss: 1.62, status: 'degraded' },
  { peerId: '5e7b21f4', score: 74, rtt: 96, loss: 0.81, status: 'live' },
  { peerId: '0b8e2f61', score: 88, rtt: 44, loss: 0.04, status: 'live' },
  { peerId: 'a3f91c02', score: 96, rtt: 38, loss: 0.2, status: 'live' },
];

// Source: START (Home.dc.html, logic class) — each tab's { title, lines, note }. `lines` is
// joined into a single pre-wrapped `body` string; title and note are kept (see task-6-report.md
// fix log — dropping them was a mistake in the first pass).
export const START: SnippetSet = {
  tabs: [
    { id: 'docker', label: 'docker run' },
    { id: 'cargo', label: 'cargo' },
    { id: 'cloud', label: 'Cloud' },
    { id: 'livekit', label: 'From LiveKit' },
  ],
  snippets: {
    docker: {
      title: 'Run the SFU',
      body: [
        'docker run -p 3000:3000 \\',
        '  ghcr.io/frekimanagarm/sightline:latest',
        '',
        '# signaling  ws://127.0.0.1:3000/ws',
        '# dashboard  http://127.0.0.1:3000',
      ].join('\n'),
      note: 'One process. No Redis, no separate signaling service, no sidecar to scrape.',
    },
    cargo: {
      title: 'Build from source',
      body: [
        'cargo add sightline-sfu',
        '',
        '# or run the workspace binary',
        'cargo run -p sightline-sfu --release',
      ].join('\n'),
      note: 'Rust 1.79+. The media path has no GC and no CGO boundary.',
    },
    cloud: {
      title: 'Use Sightline Cloud',
      body: [
        'npx sightline@latest init live-classroom \\',
        '  --region eu-west-3',
        '',
        '# → wss://live-classroom.eu-west-3.sightline.cloud/ws',
        '# → sk_live_… (shown once)',
      ].join('\n'),
      note: 'Free tier: 10,000 participant-minutes/month, no card required.',
    },
    livekit: {
      title: 'Migrate from LiveKit',
      body: [
        '- url: wss://my-app.livekit.cloud',
        '+ url: wss://live-classroom.eu-west-3.sightline.cloud/ws',
        '',
        '// client code unchanged',
        'const room = new Room();',
        'await room.connect(url, token);',
      ].join('\n'),
      note: 'Signaling messages and token grants are compatible. Your SDKs stay put.',
    },
  },
};

// Source: COMPARE (Home.dc.html, logic class). ours/theirs -> sightline/other, matching the
// column headers in the compare table ("Sightline" / "Typical Go SFU stack"). Consumed by
// Task 7.
export const COMPARE_ROWS: CompareRow[] = [
  { label: 'Self-hosted footprint', sightline: 'One static binary', other: 'SFU + signaling + Redis' },
  {
    label: 'Observability',
    sightline: 'Built in, per peer and per room',
    other: 'Bring your own Grafana',
  },
  { label: 'Media path', sightline: 'Rust — no GC, no CGO', other: 'Go, with CGO for media libs' },
  { label: 'Product focus', sightline: 'Real-time video products', other: 'AI voice agents first' },
];

// Source: topoLegend (Home.dc.html, renderVals()) — the legend column beside the room topology
// diagram in the live card.
export const TOPO_LEGEND: TopoLegendEntry[] = [
  { title: 'Solid edge', body: 'Direct path. Stroke width is the forwarded bitrate.' },
  { title: 'Dashed red edge', body: 'TURN relay, ICE degraded — d41f9ab7 pays 212ms of RTT.' },
  {
    title: 'Tinted node',
    body: 'A threshold is crossed on that peer: amber approaching, red breached.',
  },
  { title: 'Travelling pulse', body: 'What the SFU is forwarding right now, per peer.' },
];

// Source: marqueeItems (Home.dc.html, renderVals()) — machine identifiers, left unprettified.
export const MARQUEE_ITEMS: string[] = [
  'packet_loss_ratio',
  'rtt_ms',
  'jitter_ms',
  'nack_ratio',
  'freeze_ratio',
  'bitrate_kbps',
  'peer_id',
  'room_id',
  'forwarded_bytes_total',
];

// Source: series() (Home.dc.html, logic class) — ported verbatim, deterministic.
export function series(n: number, seed: number, base: number, amp: number): number[] {
  return Array.from({ length: n }, (_, i) =>
    Math.max(
      0,
      Math.round(
        base +
          amp * Math.sin(i / 3.4 + seed) +
          amp * 0.5 * Math.sin(i / 9.1 + seed * 2) +
          ((i * seed * 19) % (amp * 0.35)) -
          amp * 0.18,
      ),
    ),
  );
}
