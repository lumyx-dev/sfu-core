/**
 * Content for the platform landing (option 2a).
 * Metric names and thresholds are real; the sampled values are invented.
 */

export type Lang = "toml" | "ts" | "json" | "yaml" | "sh";

export type Snippet = {
  id: string;
  label: string;
  file: string;
  lang: Lang;
  /** 0-based line indices to band with the accent tint. */
  mark: number[];
  src: string[];
};

export const SNIPPETS: Snippet[] = [
  {
    id: "alerts",
    label: "Alert rules",
    file: "lumyx.toml",
    lang: "toml",
    mark: [3, 4],
    src: [
      "# Thresholds are yours. These are the defaults.",
      "",
      "[alerts.packet_loss]",
      "above = 0.02",
      'sustained_for = "30s"',
      'severity = "breached"',
      'notify = ["slack:#oncall", "pagerduty"]',
      "",
      "[alerts.jitter]",
      "above = 40",
      'sustained_for = "45s"',
      'severity = "approaching"',
      "",
      "[remediation]",
      "auto_audio_only = true",
    ],
  },
  {
    id: "client",
    label: "Client SDK",
    file: "call.ts",
    lang: "ts",
    mark: [6],
    src: [
      "// Same SDK as before. Only the URL changes.",
      'const room = await connect("wss://eu.lumyx.dev", token);',
      "",
      "// Every metric the SFU measures reaches the client too.",
      'room.on("quality", (peer, m) => {',
      "  if (m.packet_loss_ratio > 0.02) {",
      "    room.setSubscription(peer.id, { video: false });",
      "  }",
      "});",
    ],
  },
  {
    id: "webhook",
    label: "Webhook",
    file: "alert.json",
    lang: "json",
    mark: [3, 4],
    src: [
      "{",
      '  "event": "threshold.breached",',
      '  "metric": "packet_loss_ratio",',
      '  "value": 0.079,',
      '  "threshold": 0.02,',
      '  "sustained_for_s": 192,',
      '  "peer": "ff104b2c",',
      '  "room": "webinar-us",',
      '  "region": "ap-south-1",',
      '  "remediation": ["audio_only", "renegotiate"]',
      "}",
    ],
  },
  {
    id: "prometheus",
    label: "Prometheus",
    file: "scrape.yaml",
    lang: "yaml",
    mark: [4],
    src: [
      "scrape_configs:",
      "  - job_name: lumyx",
      "    metrics_path: /metrics",
      "    static_configs:",
      '      - targets: ["sfu-eu-west-3:9090"]',
      "",
      "# The same six metrics, labelled by peer,",
      "# room, track and region.",
    ],
  },
  {
    id: "selfhost",
    label: "Self-host",
    file: "terminal",
    lang: "sh",
    mark: [0],
    src: [
      "docker run -p 7880:7880 lumyx/sfu:0.4.1",
      "",
      "# lumyx 0.4.1 · MIT",
      "# listening on :7880 · dashboard on :7881",
      "# metrics collector armed · 6 metrics · 500ms",
      "# region eu-west-3 · 0 rooms · 0 peers",
    ],
  },
];

export const CONFIG_STEPS = [
  {
    index: "01",
    title: "Declare thresholds",
    body: "per metric, with a sustain window so a single bad tick never pages anyone.",
  },
  {
    index: "02",
    title: "Pick destinations",
    body: "Slack, PagerDuty, a webhook, or your own Prometheus scrape.",
  },
  {
    index: "03",
    title: "Let it remediate",
    body: "audio-only fallback can fire automatically, before anyone complains.",
  },
];

export const REMEDIATIONS = [
  { action: "Force audio-only", detail: "Drop video, keep the call" },
  { action: "Renegotiate", detail: "Recover from ICE handover" },
  { action: "Lower the simulcast layer", detail: "Per peer, immediately" },
  { action: "Replay the session", detail: "Scrub the whole call after" },
];

export const NO_LIST = [
  {
    title: "No GC pauses",
    body: "Rust in the media path. Forwarding latency doesn't depend on a collector's mood.",
  },
  {
    title: "No exporter to write",
    body: "The forwarder is the collector. Metrics exist because the packets passed through it.",
  },
  {
    title: "No migration",
    body: "Same client SDKs and signaling as LiveKit. Point the URL at Lumyx and deploy.",
  },
];

export const FEATURE_GROUPS = [
  {
    group: "Media",
    items: [
      "Selective forwarding",
      "Simulcast layer control",
      "ICE, DTLS, SRTP",
      "Trickle ICE",
      "Audio-only fallback",
      "VP8, VP9, H.264, Opus",
      "Room and peer model",
    ],
  },
  {
    group: "Observability",
    items: [
      "Six metrics at 500ms",
      "Per-peer series",
      "Per-track series",
      "Session replay",
      "Room topology",
      "Prometheus endpoint",
      "CSV export",
      "Event log",
    ],
  },
  {
    group: "Operations",
    items: [
      "Threshold alerts",
      "Slack, email, PagerDuty",
      "Webhooks",
      "Multi-region deploys",
      "Spend caps",
      "SSO and audit log",
      "Self-host, unmetered",
    ],
  },
];

export type Tier = {
  name: string;
  price: string;
  per?: string;
  quota: string;
  body: string;
  cta: string;
  featured?: boolean;
};

export const TIERS: Tier[] = [
  {
    name: "Free",
    price: "€0",
    quota: "10,000 min · 50 GB",
    body: "1 project, 1 region, 25 concurrent peers. Hard stop at the cap.",
    cta: "Start free",
  },
  {
    name: "Starter",
    price: "€49",
    per: "/mo",
    quota: "50,000 min · 1 TB",
    body: "3 projects, 2 regions, 500 peers. Overage €0.0012/min.",
    cta: "Choose Starter",
  },
  {
    name: "Scale · most teams",
    price: "€499",
    per: "/mo",
    quota: "500,000 min · 4 TB",
    body: "Unlimited projects, 4 regions, session replay, PagerDuty. Overage €0.0009/min.",
    cta: "Choose Scale",
    featured: true,
  },
  {
    name: "Business",
    price: "Custom",
    quota: "Negotiated volume",
    body: "Dedicated regions, 99.95% SLA, SSO, audit log, 1h support.",
    cta: "Talk to us",
  },
];
