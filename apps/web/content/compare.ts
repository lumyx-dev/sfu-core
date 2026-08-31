// UNVERIFIED — every claim below is proposed by the design handoff, not verified against the
// implementation. Origin: $HANDOFF/designs/Compare LiveKit.dc.html — the <script data-dc-script>
// logic class. SUMMARY, GROUPS, REPLACES, STEPS and NOT_FOR_YOU are copied word for word; only
// the TypeScript shapes below are new. The source's own FOOTER constant is not reproduced here —
// it is the same set of links already extracted into content/nav.ts's FOOTER_COLUMNS and rendered
// by the shared SiteFooter component (task-7).
//
// GROUPS' "LiveKit" column is an unverified characterisation of a named third party's product —
// a materially higher-risk category than unverified claims about Sightline itself. It must be
// checked against LiveKit's actual documentation and behaviour before this page is published.
// Nothing here has been compiled from public documentation or reviewed against the SFU's source
// (apps/sfu/src): claims like "Per-peer quality metrics: Six, built in, live", "Session replay:
// Included", "Room topology view: Included, with per-edge bitrate", "Dashboard: Ships with the
// SFU", and REPLACES' "Every peer already reports loss, RTT, jitter, NACK and freeze ratios" do
// not correspond to anything apps/sfu/src implements today (see content/metrics.ts and
// README.md's "Planned — next milestone" status for these fields).

export interface SummaryEntry {
  index: string;
  delay: number;
  title: string;
  body: string;
}

export interface CompareRow {
  label: string;
  ours: string;
  theirs: string;
}

export interface CompareGroup {
  title: string;
  rows: CompareRow[];
}

export interface ReplaceEntry {
  before: string;
  after: string;
  body: string;
}

export interface MigrationStep {
  n: string;
  delay: number;
  title: string;
  lines: string[];
  note: string;
}

export interface NotForYouEntry {
  title: string;
  body: string;
}

export const SUMMARY: SummaryEntry[] = [
  {
    index: '01',
    delay: 0,
    title: 'Observability is the product',
    body: 'Sightline exists because debugging WebRTC in production is the hard part. The metrics are in the SFU, not in an exporter you wire to Grafana afterwards.',
  },
  {
    index: '02',
    delay: 90,
    title: 'One binary to operate',
    body: 'Signaling, forwarding and the dashboard live in a single Rust process that starts with no config file and no external store.',
  },
  {
    index: '03',
    delay: 180,
    title: 'Human video, not agents',
    body: 'The roadmap is quality of experience for real participants: topology, thresholds, session replay. No agent framework, no LLM plumbing.',
  },
];

export const GROUPS: CompareGroup[] = [
  {
    title: 'Architecture',
    rows: [
      { label: 'Language of the media path', ours: 'Rust, no garbage collector', theirs: 'Go, with CGO for media libraries' },
      { label: 'Processes to run self-hosted', ours: 'One static binary', theirs: 'SFU + signaling, Redis for multi-node' },
      { label: 'Config required to start', ours: 'None — sane defaults', theirs: 'YAML config file' },
      { label: 'Signaling protocol', ours: 'LiveKit-compatible', theirs: 'Native' },
    ],
  },
  {
    title: 'Observability',
    rows: [
      { label: 'Per-peer quality metrics', ours: 'Six, built in, live', theirs: 'Prometheus counters, mostly server-level' },
      { label: 'Default alert thresholds', ours: 'Shipped and documented', theirs: 'You define them' },
      { label: 'Room topology view', ours: 'Included, with per-edge bitrate', theirs: 'Not provided' },
      { label: 'Session replay', ours: 'Included', theirs: 'Not provided' },
      { label: 'Dashboard', ours: 'Ships with the SFU', theirs: 'Cloud console; self-host uses Grafana' },
    ],
  },
  {
    title: 'Product scope',
    rows: [
      { label: 'Primary focus', ours: 'Real-time human video quality', theirs: 'AI voice agents and telephony' },
      { label: 'Agent framework', ours: 'None', theirs: 'Extensive' },
      { label: 'Recording / egress pipelines', ours: 'Not yet', theirs: 'Mature' },
      { label: 'Client SDK count', ours: 'Uses LiveKit SDKs', theirs: 'Large first-party set' },
    ],
  },
  {
    title: 'Licence & maturity',
    rows: [
      { label: 'Licence', ours: 'MIT', theirs: 'Apache 2.0' },
      { label: 'Features held back from OSS', ours: 'None', theirs: 'Some cloud-only tooling' },
      { label: 'Project age', ours: 'Young — 2026', theirs: 'Mature, large production footprint' },
    ],
  },
];

export const REPLACES: ReplaceEntry[] = [
  { before: 'Prometheus exporter + scrape config', after: 'Metrics endpoint on by default', body: 'Every peer already reports loss, RTT, jitter, NACK and freeze ratios. Scrape it if you want, or read the dashboard.' },
  { before: 'Hand-built Grafana dashboards', after: 'A dashboard that knows what a NACK is', body: 'Thresholds, worst-peer ordering and topology are designed in, not assembled from panels each time.' },
  { before: 'Alertmanager rules for WebRTC', after: 'Six documented thresholds', body: 'Loss 2%, RTT 200ms, jitter 30ms, NACK 5%, freeze 1%, bitrate floor 100kbps. Override per project.' },
  { before: 'Client-side stats collection', after: 'Server-side, in the media path', body: 'No sampling in the browser to correlate later, and nothing to ship from a user device you do not control.' },
  { before: 'A Redis cluster for one region', after: 'A single process', body: 'Add nodes when concurrency demands it, not because the architecture assumed it on day one.' },
  { before: 'Ticket to ask why a call was bad', after: 'A session you can replay', body: 'Metrics and signaling events for a finished session, timestamped to the second.' },
];

export const STEPS: MigrationStep[] = [
  {
    n: '01',
    delay: 0,
    title: 'Point at the new URL',
    lines: ['- wss://my-app.livekit.cloud', '+ wss://live-classroom.eu-west-3', '  .sightline.cloud/ws'],
    note: 'One string in your client config. SDK, room names and identities stay as they are.',
  },
  {
    n: '02',
    delay: 90,
    title: 'Sign tokens with the new key',
    lines: ['POST /v1/tokens', 'Authorization: Bearer sk_live_…', '', '{ "room": "cohort-42",', '  "identity": "a3f91c02",', '  "grants": ["publish","subscribe"] }'],
    note: 'Same grant names. If you already mint LiveKit tokens server-side, swap the secret.',
  },
  {
    n: '03',
    delay: 180,
    title: 'Watch the first join',
    lines: ['# dashboard fills as peers connect', 'Rooms → live-classroom → Peers', '', '# thresholds are already armed'],
    note: 'No agent to install. If a peer degrades in the first hour, you will see which one and why.',
  },
];

export const NOT_FOR_YOU: NotForYouEntry[] = [
  {
    title: 'You need server-side recording or egress pipelines today.',
    body: 'Composite recording, HLS egress and RTMP ingest are mature on LiveKit and not yet built here. Do not migrate a workload that depends on them.',
  },
  {
    title: 'Your product is an AI voice agent.',
    body: 'That is the case LiveKit optimises for, with an agent framework, telephony integrations and turn detection. Sightline deliberately does none of it.',
  },
  {
    title: 'You need a large first-party SDK matrix with vendor support.',
    body: 'Sightline rides the LiveKit client SDKs. That works, but if you want contractual support on the client libraries themselves, get it from the people who write them.',
  },
  {
    title: 'You are risk-averse about young infrastructure.',
    body: 'Sightline is new. Run it in staging, run it beside your current SFU, read the source — it is MIT for exactly that reason. Do not put it under a launch next week on a promise.',
  },
];
