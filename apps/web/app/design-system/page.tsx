"use client";
import {
  Button, Badge, Input, Switch, Progress, Skeleton, Card, CardHeader, CardTitle, CardContent,
  CardDescription, Tabs, TabsList, TabsTrigger, StatusDot, MetricCard, MetricGrid, Sparkline,
  QualityIndicator, LatencyChip, PeerCard, RoomCard, VideoTile, EventList, SeverityBadge,
  AlertBanner, EmptyState, ErrorState,
} from '@lumyx/ui';
import { Inbox } from "lucide-react";
import { PEERS, EVENTS, series, qualityOf } from "@/lib/dashboard-data";

const NEUTRALS = ["--n-0", "--n-25", "--n-50", "--n-100", "--n-150", "--n-200", "--n-300", "--n-400", "--n-500", "--n-600", "--n-700", "--n-800", "--n-900", "--n-950"];
const BRAND = ["--indigo-50", "--indigo-100", "--indigo-400", "--indigo-500", "--indigo-600", "--indigo-700", "--indigo-900", "--coral-50", "--coral-400", "--coral-500", "--coral-600"];
const SEMANTIC = ["--green-500", "--green-600", "--amber-500", "--amber-600", "--red-500", "--red-600", "--blue-500", "--blue-600"];
const SIZES = [11, 12, 13, 14, 16, 20, 26, 34, 44];
const RADII = ["xs / 8px", "sm / 12px", "md / 14px", "lg / 18px", "xl / 24px", "pill"];

function Section({ title, meta, children }: { title: string; meta?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {meta ? <CardDescription>{meta}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-5">{children}</CardContent>
    </Card>
  );
}

function Swatches({ tokens }: { tokens: string[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {tokens.map((t) => (
        <div key={t} className="flex w-[110px] flex-col gap-1.5">
          <span className="h-12 rounded-sm border border-hairline" style={{ background: `var(${t})` }} />
          <span className="sl-num text-11 text-muted">{t}</span>
        </div>
      ))}
    </div>
  );
}

export default function DesignSystemPage() {
  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6 px-8 py-10">
      <div className="flex flex-col gap-2">
        <span className="sl-label">Sightline design system</span>
        <h1 className="text-44 font-semibold tracking-[-0.02em] text-strong">Tokens &amp; components</h1>
        <p className="max-w-[620px] text-16 leading-relaxed text-muted text-pretty">
          Every value here comes from the design system’s token files, re-pointed onto Tailwind v4 and the shadcn/ui
          variable contract. Change a token in <span className="sl-num">globals.css</span> and every component follows.
        </p>
      </div>

      <Section title="Neutrals" meta="the system is 90% these">
        <Swatches tokens={NEUTRALS} />
      </Section>
      <Section title="Accent &amp; secondary" meta="indigo is the peer axis, coral the room / session axis — never blended">
        <Swatches tokens={BRAND} />
      </Section>
      <Section title="Semantics" meta="500s are fills and dots, 600s are the light-theme ink">
        <Swatches tokens={SEMANTIC} />
      </Section>

      <Section title="Type" meta="Geist only — numbers use tabular figures, no monospace tier">
        <div className="flex flex-col gap-3">
          {SIZES.map((s) => (
            <div key={s} className="flex items-baseline gap-5 border-b border-subtle pb-3">
              <span className="sl-num w-10 text-11 text-faint">{s}</span>
              <span style={{ fontSize: s, letterSpacing: s >= 20 ? "-0.02em" : s >= 14 ? "-0.01em" : 0 }} className="text-strong">
                Peer ff104b2c is degrading
              </span>
            </div>
          ))}
          <div className="flex items-center gap-5">
            <span className="sl-label">micro-label · 11px · +0.06em</span>
            <span className="sl-num text-13 text-strong">1,284,920 · 38ms · 0.20% · €49/mo</span>
          </div>
        </div>
      </Section>

      <Section title="Radii &amp; elevation" meta="nothing has a hard corner except the page">
        <div className="flex flex-wrap gap-4">
          {RADII.map((r, i) => (
            <div key={r} className="flex flex-col items-center gap-2">
              <span
                className="size-16 border border-hairline bg-card shadow-[var(--shadow-sm)]"
                style={{ borderRadius: [8, 12, 14, 18, 24, 999][i] }}
              />
              <span className="sl-num text-11 text-muted">{r}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-4">
          {["xs", "sm", "md", "lg"].map((s) => (
            <div key={s} className="flex flex-col items-center gap-2">
              <span className="size-16 rounded-lg bg-card" style={{ boxShadow: `var(--shadow-${s})` }} />
              <span className="sl-num text-11 text-muted">shadow-{s}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Core controls">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Primary</Button>
          <Button>Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Force audio-only</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge>neutral</Badge><Badge tone="accent">accent</Badge><Badge tone="room">eu-west-3</Badge>
          <Badge tone="ok">Active</Badge><Badge tone="warn">Approaching</Badge><Badge tone="danger">Breached</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Input className="w-[220px]" placeholder="Search by room_id" />
          <Switch defaultChecked />
          <Tabs defaultValue="a"><TabsList><TabsTrigger value="a">Peers</TabsTrigger><TabsTrigger value="b">Media</TabsTrigger></TabsList></Tabs>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          {(["live", "connecting", "healthy", "degraded", "failed", "idle"] as const).map((s) => (
            <span key={s} className="flex items-center gap-2 text-12 text-muted"><StatusDot status={s} />{s}</span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-5">
          {(["excellent", "good", "degraded", "poor"] as const).map((q) => <QualityIndicator key={q} quality={q} showLabel />)}
          <LatencyChip ms={38} /><LatencyChip ms={128} /><LatencyChip ms={284} />
        </div>
        <Progress value={62} />
        <Skeleton className="h-10 w-full" />
      </Section>

      <Section title="Data" meta="a metric grid reads as one instrument">
        <MetricGrid columns={3}>
          <MetricCard label="Round-trip time" value={38} unit="ms" threshold="threshold 200ms" series={series(24, 1, 38, 9)} />
          <MetricCard label="Packet loss" value="7.90" unit="%" state="danger" threshold="threshold 2% · 3m 12s" />
          <MetricCard label="Freeze ratio" value="1.40" unit="%" state="warn" threshold="threshold 1%" />
        </MetricGrid>
        <Sparkline data={series(40, 3, 2400, 340)} width={320} height={40} />
      </Section>

      <Section title="WebRTC">
        <div className="grid gap-4 md:grid-cols-3">
          <PeerCard peer={{ id: PEERS[3].peer_id, name: "us-east-1 · vp8", status: "degraded", rttMs: 212, lossPct: 3.41, jitterMs: 38, quality: qualityOf(41), tracks: ["audio", "video"] }} />
          <RoomCard room={{ id: "test-room", region: "eu-west-3", peers: 6, status: "live", durationLabel: "2h 14m", bitrateLabel: "2.4 Mbps", worstLossPct: 0.81 }} />
          <VideoTile peerId="a3f91c02" latencyMs={38} status="live" quality="excellent" />
        </div>
      </Section>

      <Section title="Feedback">
        <div className="flex flex-wrap gap-3">
          {(["critical", "warning", "info", "resolved"] as const).map((s) => <SeverityBadge key={s} severity={s} />)}
        </div>
        <AlertBanner
          severity="critical"
          title="Peer ff104b2c is degrading"
          body="Packet loss has been above 2% for 3m 12s. Force audio-only or renegotiate the session."
          context="webinar-us · ap-south-1 · 14:06:41 · loss 7.90% vs 2%"
          actionLabel="Open alerts"
        />
        <ErrorState code="1006" message={`WebSocket closed abnormally\n  wss://127.0.0.1:3000/ws · no close frame received`} />
        <div className="rounded-lg border border-hairline bg-card">
          <EmptyState icon={Inbox} title="No active rooms" body="Rooms appear here as soon as a peer joins." />
        </div>
      </Section>

      <Section title="Events" meta="completed facts, Sentence case, identifier as trailing detail">
        <div className="-mx-5 -my-5">
          <EventList events={EVENTS.slice(0, 6)} />
        </div>
      </Section>
    </div>
  );
}
