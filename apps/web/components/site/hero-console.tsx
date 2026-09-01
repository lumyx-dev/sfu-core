"use client";
import * as React from "react";
import { Copy } from "lucide-react";
import { Button, Tabs, TabsList, TabsTrigger, MetricCard, MetricGrid, StatusDot, QualityIndicator, LatencyChip, TimeSeriesChart, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge } from '@lumyx/ui';
import { START, START_TABS, HERO_PEERS, TOPO_LEGEND, series, type StartKey } from "@/lib/site-data";

/** A live number drifts around its base — it is not tweened, it just changes. */
function useLive(base: number, jitter: number, period = 2400) {
  const [v, setV] = React.useState(base);
  React.useEffect(() => {
    const id = setInterval(() => setV(Math.max(0, base + (Math.random() * 2 - 1) * jitter)), period);
    return () => clearInterval(id);
  }, [base, jitter, period]);
  return v;
}

export function QuickStart() {
  const [tab, setTab] = React.useState<StartKey>("docker");
  const s = START[tab];
  return (
    <div className="flex flex-col gap-3">
      <Tabs value={tab} onValueChange={(v) => setTab(v as StartKey)}>
        <TabsList>
          {START_TABS.map((t) => <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>
      <div className="overflow-hidden rounded-lg border border-hairline bg-card">
        <div className="flex items-center gap-2.5 border-b border-subtle px-[18px] py-3">
          <span className="sl-label">{s.title}</span>
          <span className="flex-1" />
          <Button size="icon" variant="ghost" aria-label="Copy" className="size-7"><Copy /></Button>
        </div>
        <div className="flex min-h-[168px] flex-col gap-[7px] px-5 py-[18px]">
          {s.lines.map((line, i) => (
            <span key={i} className="whitespace-pre-wrap text-13 leading-relaxed text-body">{line}</span>
          ))}
        </div>
        <div className="border-t border-subtle bg-sunken px-5 py-3">
          <span className="text-12 text-muted text-pretty">{s.note}</span>
        </div>
      </div>
    </div>
  );
}

export function LiveConsole() {
  const rtt = Math.round(useLive(38, 6));
  const jitter = Math.round(useLive(11, 3));
  const loss = useLive(0.2, 0.14, 2800).toFixed(2);
  const nack = useLive(6.2, 0.8, 3200).toFixed(2);
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 2600);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-card shadow-[var(--shadow-lg)]">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-subtle bg-sunken px-[18px] py-3">
        <StatusDot status="live" />
        <span className="text-[12.5px] font-medium text-strong">live-classroom</span>
        <span className="sl-num text-12 text-muted">eu-west-3 · 6 peers · 2.4 Mbps · up 2h 14m</span>
        <span className="flex-1" />
        <Badge tone="ok">Live</Badge>
      </div>

      <MetricGrid columns={5} className="rounded-none border-x-0 border-t-0 shadow-none">
        <MetricCard label="Round-trip time" value={rtt} unit="ms" threshold="p50 · threshold 200ms" />
        <MetricCard label="Jitter" value={jitter} unit="ms" threshold="threshold 30ms" />
        <MetricCard label="Packet loss" value={loss} unit="%" threshold="threshold 2%" />
        <MetricCard label="NACK ratio" value={nack} unit="%" state="danger" threshold="threshold 5%" />
        <MetricCard label="Freeze ratio" value="1.40" unit="%" state="warn" threshold="threshold 1%" />
      </MetricGrid>

      <div className="grid border-t border-subtle lg:grid-cols-[1.4fr_1fr]">
        <div className="flex min-w-0 flex-col gap-3 border-b border-subtle px-5 py-[18px] lg:border-b-0 lg:border-r">
          <span className="sl-label">Bitrate per peer — last 30 minutes</span>
          <TimeSeriesChart
            height={190}
            yUnit=" kbps"
            xLabels={["13:36", "13:43", "13:50", "13:57", "14:06"]}
            series={[
              { name: "a3f91c02", color: "var(--series-1)", data: series(60, 2 + tick * 0.4, 2400, 260) },
              { name: "ff104b2c", color: "var(--danger-solid)", data: series(60, 6 + tick * 0.4, 900, 420) },
            ]}
          />
        </div>
        <div className="flex min-w-0 flex-col">
          <div className="px-5 pb-2.5 pt-[18px]"><span className="sl-label">Peers — worst first</span></div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Peer</TableHead>
                <TableHead>Quality</TableHead>
                <TableHead className="text-right">Rtt</TableHead>
                <TableHead className="text-right">Loss</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {HERO_PEERS.map((p) => (
                <TableRow key={p.peer_id}>
                  <TableCell>
                    <span className="sl-num inline-flex items-center gap-2 font-medium text-strong">
                      <StatusDot status={p.status} />{p.peer_id}
                    </span>
                  </TableCell>
                  <TableCell>
                    <QualityIndicator quality={p.score >= 85 ? "excellent" : p.score >= 70 ? "good" : p.score >= 40 ? "degraded" : "poor"} />
                  </TableCell>
                  <TableCell className="text-right"><LatencyChip ms={p.rtt} plain /></TableCell>
                  <TableCell className="text-right">
                    <span className={`sl-num ${p.loss >= 2 ? "text-danger" : "text-muted"}`}>{p.loss.toFixed(2)}%</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="grid border-t border-subtle lg:grid-cols-[1fr_300px]">
        <div className="border-b border-subtle bg-sunken px-[18px] py-3.5 lg:border-b-0 lg:border-r">
          <Topology />
        </div>
        <div className="flex flex-col">
          {TOPO_LEGEND.map((t) => (
            <div key={t.title} className="flex flex-col gap-1 border-b border-subtle px-5 py-3">
              <span className="text-[12.5px] font-medium text-strong">{t.title}</span>
              <span className="text-12 leading-relaxed text-muted text-pretty">{t.body}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Stroke width is forwarded bitrate; dashed red is a TURN relay on degraded ICE. */
function Topology() {
  const peers = [
    { id: "a3f91c02", x: 120, y: 58, w: 3, tone: "" },
    { id: "0b8e2f61", x: 500, y: 58, w: 2, tone: "" },
    { id: "5e7b21f4", x: 80, y: 196, w: 4, tone: "" },
    { id: "d41f9ab7", x: 540, y: 196, w: 2, tone: "danger" },
    { id: "9c0d34aa", x: 230, y: 248, w: 2, tone: "" },
    { id: "2f81be07", x: 400, y: 248, w: 3, tone: "warn" },
  ];
  return (
    <svg viewBox="0 0 620 280" className="block h-[230px] w-full" role="img" aria-label="Room topology">
      <g fill="none">
        {peers.map((p) => (
          <line
            key={p.id} x1={310} y1={140} x2={p.x} y2={p.y}
            stroke={p.tone === "danger" ? "var(--danger-solid)" : p.tone === "warn" ? "var(--warn-solid)" : "var(--series-1)"}
            strokeWidth={p.w}
            strokeDasharray={p.tone === "danger" ? "5 4" : undefined}
            opacity={p.tone ? 0.8 : 0.55}
          />
        ))}
      </g>
      <rect x={256} y={112} width={108} height={56} rx={14} fill="var(--surface-card)" stroke="var(--accent-border)" strokeWidth={1.5} />
      <text x={310} y={135} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="var(--text-strong)">SFU</text>
      <text x={310} y={152} textAnchor="middle" fontSize={10.5} fill="var(--text-muted)">forwarding · 6</text>
      <g fontSize={10.5} fill="var(--text-body)" textAnchor="middle">
        {peers.map((p) => (
          <g key={p.id}>
            <circle
              cx={p.x} cy={p.y} r={27}
              fill={p.tone === "danger" ? "var(--danger-tint)" : p.tone === "warn" ? "var(--warn-tint)" : "var(--surface-card)"}
              stroke={p.tone === "danger" ? "var(--danger-solid)" : p.tone === "warn" ? "var(--warn-solid)" : "var(--border-strong)"}
            />
            <text x={p.x} y={p.y + 4}>{p.id}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}
