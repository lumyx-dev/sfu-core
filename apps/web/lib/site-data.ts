export const VERSION = "v0.4.1";
export const REPO = "https://github.com/FrekiManagarm/lumyx";

export const START = {
  docker: {
    title: "Run the SFU",
    lines: [
      "docker run -p 3000:3000 \\",
      "  ghcr.io/frekimanagarm/lumyx:latest",
      "",
      "# signaling  ws://127.0.0.1:3000/ws",
      "# dashboard  http://127.0.0.1:3000",
    ],
    note: "One process. No Redis, no separate signaling service, no sidecar to scrape.",
  },
  cargo: {
    title: "Build from source",
    lines: ["cargo add lumyx-sfu", "", "# or run the workspace binary", "cargo run -p lumyx-sfu --release"],
    note: "Rust 1.79+. The media path has no GC and no CGO boundary.",
  },
  cloud: {
    title: "Use Lumyx Cloud",
    lines: [
      "npx lumyx@latest init live-classroom \\",
      "  --region eu-west-3",
      "",
      "# → wss://live-classroom.eu-west-3.lumyx.cloud/ws",
      "# → sk_live_… (shown once)",
    ],
    note: "Free tier: 10,000 participant-minutes/month, no card required.",
  },
  livekit: {
    title: "Migrate from LiveKit",
    lines: [
      "- url: wss://my-app.livekit.cloud",
      "+ url: wss://live-classroom.eu-west-3.lumyx.cloud/ws",
      "",
      "// client code unchanged",
      "const room = new Room();",
      "await room.connect(url, token);",
    ],
    note: "Signaling messages and token grants are compatible. Your SDKs stay put.",
  },
} as const;

export type StartKey = keyof typeof START;

export const START_TABS: { id: StartKey; label: string }[] = [
  { id: "docker", label: "docker run" },
  { id: "cargo", label: "cargo" },
  { id: "cloud", label: "Cloud" },
  { id: "livekit", label: "From LiveKit" },
];

export const MARQUEE = [
  "packet_loss_ratio", "rtt_ms", "jitter_ms", "nack_ratio", "freeze_ratio",
  "bitrate_kbps", "peer_id", "room_id", "forwarded_bytes_total",
];

export const HERO_PEERS = [
  { peer_id: "ff104b2c", score: 18, rtt: 284, loss: 7.9, status: "degraded" },
  { peer_id: "d41f9ab7", score: 41, rtt: 212, loss: 3.41, status: "degraded" },
  { peer_id: "2f81be07", score: 62, rtt: 128, loss: 1.62, status: "degraded" },
  { peer_id: "5e7b21f4", score: 74, rtt: 96, loss: 0.81, status: "live" },
  { peer_id: "0b8e2f61", score: 88, rtt: 44, loss: 0.04, status: "live" },
  { peer_id: "a3f91c02", score: 96, rtt: 38, loss: 0.2, status: "live" },
] as const;

export const PAINS = [
  {
    index: "01",
    headline: "Self-hosting shouldn’t mean three services and a Redis cluster.",
    body: "One binary carries signaling, forwarding and the dashboard. It starts with no config file and no external store — scale it out when you actually need to.",
    chips: ["docker run", "no Redis required", "no sidecar"],
    proof: {
      label: "Deployment surface",
      badge: "docker run",
      rows: [
        ["Processes to run", "1"],
        ["External dependencies", "none required"],
        ["Config to start", "0 lines"],
        ["Image size", "single static binary"],
      ] as [string, string][],
    },
  },
  {
    index: "02",
    headline: "Stop bolting Grafana onto your SFU.",
    body: "The collector reads RTCP as the media passes through, so every peer already has jitter, loss, RTT, NACK and freeze ratios — with default thresholds and alerts attached.",
    chips: ["6 metrics", "per peer · per room", "Slack · PagerDuty"],
    proof: null,
  },
  {
    index: "03",
    headline: "Written in Rust, not Go with CGO.",
    body: "No garbage collector in the media path and no FFI boundary around the codec libraries. Fewer moving parts between a packet arriving and a packet leaving.",
    chips: ["Rust", "no GC pauses", "static binary"],
    proof: {
      label: "Runtime characteristics",
      badge: "rustc 1.79",
      rows: [
        ["Media path", "Rust · no garbage collector"],
        ["FFI boundary", "none — no CGO in the hot path"],
        ["Tail latency", "no GC pause to schedule around"],
        ["Measured throughput", "benchmark pending — number to be published"],
      ] as [string, string][],
    },
  },
];

export const TOPO_LEGEND = [
  { title: "Solid edge", body: "Direct path. Stroke width is the forwarded bitrate." },
  { title: "Dashed red edge", body: "TURN relay, ICE degraded — d41f9ab7 pays 212ms of RTT." },
  { title: "Tinted node", body: "A threshold is crossed on that peer: amber approaching, red breached." },
  { title: "Travelling pulse", body: "What the SFU is forwarding right now, per peer." },
];

export const COMPARE_ROWS = [
  { label: "Self-hosted footprint", ours: "One static binary", theirs: "SFU + signaling + Redis" },
  { label: "Observability", ours: "Built in, per peer and per room", theirs: "Bring your own Grafana" },
  { label: "Media path", ours: "Rust — no GC, no CGO", theirs: "Go, with CGO for media libs" },
  { label: "Product focus", ours: "Real-time video products", theirs: "AI voice agents first" },
];

export type Plan = {
  name: string; price: string; per: string; headline: string; who: string;
  features: string[]; cta: string; variant: "primary" | "secondary"; featured: boolean;
};

const BASE_PLANS: Plan[] = [
  { name: "Self-hosted", price: "€0", per: "forever", headline: "MIT, no metering", who: "You run the binary on your own infra.", features: ["Unlimited participant-minutes", "All 6 metrics + thresholds", "Dashboard included", "Retention = your storage"], cta: "View on GitHub", variant: "secondary", featured: false },
  { name: "Free", price: "€0", per: "/mo", headline: "10,000 participant-minutes", who: "Prototypes, staging, or a first trickle of production traffic.", features: ["50 GB egress included", "1 project · 1 region", "24-hour retention", "Email alerts"], cta: "Get started free", variant: "secondary", featured: false },
  { name: "Starter", price: "€49", per: "/mo", headline: "50,000 participant-minutes", who: "First production app, one or two environments.", features: ["1 TB egress included", "3 projects · 2 regions", "7-day retention", "Email + webhook alerts"], cta: "Get started free", variant: "secondary", featured: false },
  { name: "Scale", price: "€499", per: "/mo", headline: "500,000 participant-minutes", who: "Video is the product and someone is on call.", features: ["4 TB egress included", "Unlimited projects · 4 regions", "30-day retention + session replay", "Slack + PagerDuty"], cta: "Get started free", variant: "primary", featured: true },
  { name: "Business", price: "Custom", per: "", headline: "Negotiated volume", who: "Contractual commitments and dedicated capacity.", features: ["Dedicated regions", "99.95% SLA · 1h support", "SSO + audit log", "90-day retention or more"], cta: "Contact us", variant: "secondary", featured: false },
];

export const PLANS: Record<"monthly" | "annual", Plan[]> = {
  monthly: BASE_PLANS,
  annual: BASE_PLANS.map((p) =>
    p.name === "Starter" ? { ...p, price: "€39", headline: "50,000 min · billed yearly" }
    : p.name === "Scale" ? { ...p, price: "€399", headline: "500,000 min · billed yearly" }
    : p
  ),
};

export const PRICING_GROUPS = [
  { title: "Usage", rows: [
    { label: "Participant-minutes included", a: "Unmetered", b: "50,000", c: "500,000", d: "Negotiated" },
    { label: "Overage rate", a: "—", b: "€0.0012/min", c: "€0.0009/min", d: "Custom" },
    { label: "Egress included", a: "Your bandwidth", b: "1 TB", c: "4 TB", d: "Custom" },
    { label: "Concurrent peers", a: "Your hardware", b: "500", c: "5,000", d: "Custom" },
    { label: "Projects", a: "Unlimited", b: "3", c: "Unlimited", d: "Unlimited" },
    { label: "Regions", a: "Self-managed", b: "2", c: "4", d: "Dedicated" },
    { label: "Spend cap", a: "—", b: "Included", c: "Included", d: "Included" },
  ] },
  { title: "Observability", rows: [
    { label: "All 6 metrics, per peer and per room", a: "Included", b: "Included", c: "Included", d: "Included" },
    { label: "Metrics retention", a: "Your storage", b: "7 days", c: "30 days", d: "90 days+" },
    { label: "Room topology", a: "Included", b: "Included", c: "Included", d: "Included" },
    { label: "Session replay", a: "Included", b: "—", c: "Included", d: "Included" },
    { label: "Prometheus endpoint", a: "Included", b: "Included", c: "Included", d: "Included" },
  ] },
  { title: "Alerting", rows: [
    { label: "Default thresholds + custom thresholds", a: "Included", b: "Included", c: "Included", d: "Included" },
    { label: "Email + signed webhooks", a: "Included", b: "Included", c: "Included", d: "Included" },
    { label: "Slack", a: "Self-wired", b: "—", c: "Included", d: "Included" },
    { label: "PagerDuty", a: "Self-wired", b: "—", c: "Included", d: "Included" },
  ] },
  { title: "Team & support", rows: [
    { label: "Team members", a: "Unlimited", b: "3", c: "Unlimited", d: "Unlimited" },
    { label: "SSO + audit log", a: "—", b: "—", c: "—", d: "Included" },
    { label: "Support", a: "Community", b: "Email · 48h", c: "Email · 24h", d: "Dedicated · 1h" },
    { label: "Uptime SLA", a: "—", b: "—", c: "99.9%", d: "99.95%" },
  ] },
];

export const PRICING_FAQ = [
  { q: "What exactly is a participant-minute?", a: "One minute of one peer present in a room. A 4-person call for 10 minutes is 40 participant-minutes. Publishing or only subscribing counts the same." },
  { q: "What happens at the spend cap?", a: "New rooms are refused with an explicit error code, sessions already running are preserved to the end, and you get an alert before the cap is reached." },
  { q: "Is anything held back from the open-source version?", a: "No. The SFU, the metrics, the thresholds and the dashboard are all in the MIT repo. Cloud sells operation — regions, quotas, retention, keys per environment." },
  { q: "Can I move from Cloud back to self-hosted?", a: "Yes. Same signaling, same token grants: point your clients at your own URL. Metrics history can be exported as CSV before you leave." },
];

export const FOOTER_COLS = [
  { title: "Product", links: ["Observability", "Alerting", "Session replay", "Cloud console"] },
  { title: "Developers", links: ["Docs", "Metrics reference", "API", "SDKs", "Changelog"] },
  { title: "Open source", links: ["GitHub", "Roadmap", "Contributing", "Benchmarks", "License"] },
  { title: "Company", links: ["Pricing", "vs LiveKit", "Status", "Blog", "Contact"] },
];

/** Deterministic mock series — same shape the design files used. */
export const series = (n: number, seed: number, base: number, amp: number) =>
  Array.from({ length: n }, (_, i) =>
    Math.max(0, Math.round(
      base + amp * Math.sin(i / 3.4 + seed) + amp * 0.5 * Math.sin(i / 9.1 + seed * 2) +
      ((i * seed * 19) % (amp * 0.35)) - amp * 0.18
    ))
  );
