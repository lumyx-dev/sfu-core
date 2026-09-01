import Link from "next/link";
import { Card, CardContent } from '@lumyx/ui';
import { DocsLayout, DocSection } from "@/components/site/docs-layout";
import { VERSION, REPO } from "@/lib/site-data";

const NEXT_STEPS = [
  { href: "/docs/quickstart", label: "Quickstart", body: "Run the SFU locally and connect a client in a couple of minutes." },
  { href: "/docs/self-hosting", label: "Self-hosting", body: "Deploy the binary in production — Docker, from source, or behind your own proxy." },
  { href: "/docs/cloud", label: "Lumyx Cloud", body: "Same SFU, hosted. Regions, retention and alerting wired in." },
  { href: "/docs/metrics-reference", label: "Metrics reference", body: "The six metrics the collector reads off RTCP, and what each threshold breach means." },
];

export default function DocsIntroductionPage() {
  return (
    <DocsLayout
      crumb="Docs · Getting started · Introduction"
      title="Introduction"
      description="Lumyx is a WebRTC SFU with observability built into the media path — one binary carries signaling, forwarding and the dashboard, and the collector reads the six metrics below off RTCP as packets pass through."
      activeId="introduction"
      toc={[
        { id: "what-it-is", label: "What Lumyx is" },
        { id: "architecture", label: "How it's put together" },
        { id: "open-source", label: "Open source vs. Cloud" },
        { id: "next", label: "Where to go next" },
      ]}
    >
      <DocSection id="what-it-is" title="What Lumyx is">
        <p className="max-w-[680px] text-14 leading-relaxed text-body text-pretty">
          Lumyx is a selective forwarding unit (SFU) for real-time video and audio: it terminates ICE, DTLS and SRTP
          from every peer in a room and forwards each publisher&apos;s tracks to the subscribers who need them,
          without transcoding. Client SDKs and signaling messages are compatible with LiveKit, so most apps switch
          by changing a URL.
        </p>
        <p className="max-w-[680px] text-14 leading-relaxed text-body text-pretty">
          What sets it apart is the second job it does on the same packets: a metrics collector sits in the media
          path itself, so packet loss, RTT, jitter, NACK ratio, freeze ratio and bitrate are measured directly
          rather than sampled from a separate exporter. Every peer gets default thresholds and alerting from the
          moment it connects.
        </p>
      </DocSection>

      <DocSection id="architecture" title="How it's put together">
        <p className="max-w-[680px] text-14 leading-relaxed text-body text-pretty">
          Signaling, forwarding, the metrics collector and the dashboard all run inside one Rust binary — no Redis,
          no separate signaling service, no sidecar to scrape. It starts with no config file and no external store;
          you add a Postgres or object storage backend only when you need retention past the in-memory window.
        </p>
        <Card>
          <CardContent className="flex flex-col gap-1">
            {[
              "peer ──ICE/DTLS/SRTP──▶ lumyx (signaling · forwarding · collector · dashboard)",
              "                                │",
              "                                ├─▶ RTCP read in the media path → 6 metrics",
              "                                ├─▶ thresholds + 30s debounce → alerts",
              "                                └─▶ /metrics (Prometheus) · dashboard :3000",
            ].map((l, i) => (
              <span key={i} className="sl-num whitespace-pre text-[12.5px] text-body">{l}</span>
            ))}
          </CardContent>
        </Card>
      </DocSection>

      <DocSection id="open-source" title="Open source vs. Cloud">
        <p className="max-w-[680px] text-14 leading-relaxed text-body text-pretty">
          Nothing is held back from the MIT repo: the SFU, all six metrics, default thresholds and the dashboard are
          all there. Lumyx Cloud ({VERSION}) sells operation on top of the same binary — regions, quotas, retention
          and per-environment keys — not extra features. Moving from Cloud back to self-hosted is a URL change; the
          signaling protocol and token grants don&apos;t differ.
        </p>
        <Link
          href={REPO}
          className="inline-flex w-fit items-center gap-1.5 text-13 font-medium text-accent no-underline hover:no-underline"
        >
          {REPO.replace("https://", "")} ↗
        </Link>
      </DocSection>

      <DocSection id="next" title="Where to go next">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {NEXT_STEPS.map((s) => (
            <Link key={s.href} href={s.href} className="no-underline hover:no-underline">
              <Card className="h-full transition-colors duration-[120ms] ease-[var(--ease-out)] hover:border-stroke">
                <CardContent className="flex flex-col gap-1.5">
                  <span className="text-14 font-medium text-strong">{s.label}</span>
                  <span className="text-13 leading-relaxed text-muted text-pretty">{s.body}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </DocSection>
    </DocsLayout>
  );
}
