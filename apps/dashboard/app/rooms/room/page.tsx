"use client";
import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Card, CardHeader, CardTitle, CardContent, CardDescription, Badge, Button, Progress, Tabs,
  TabsList, TabsTrigger, Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  MetricCard, MetricGrid, TimeSeriesChart, EventList, StatusDot, QualityIndicator, LatencyChip,
  PeerCard,
} from '@lumyx/ui';
import { PEERS, ROOM_EVENTS, MATRIX, TIME_LABELS, series, qualityOf } from "@/lib/dashboard-data";

function RoomDetail() {
  const roomId = useSearchParams().get("id") ?? "test-room";
  const [sel, setSel] = React.useState(3);
  const [topo, setTopo] = React.useState<"graph" | "matrix">("graph");
  const peer = PEERS[sel];

  return (
    <div className="flex max-w-[1360px] flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3.5">
        <StatusDot status="live" />
        <h2 className="text-26 font-semibold tracking-[-0.02em] text-strong">{roomId}</h2>
        <Badge tone="room">eu-west-3</Badge>
        <span className="sl-num text-12 text-muted">Up 2h 14m · 6 peers · 2.4 Mbps</span>
        <span className="flex-1" />
        <Button size="sm">Session replay</Button>
        <Button size="sm" variant="danger">Close room</Button>
      </div>

      <Tabs defaultValue="peers">
        <TabsList>
          <TabsTrigger value="peers">Peers</TabsTrigger>
          <TabsTrigger value="media">Media</TabsTrigger>
          <TabsTrigger value="signaling">Signaling</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid items-start gap-4 xl:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader><CardTitle>Bandwidth</CardTitle><CardDescription>last 30 min</CardDescription></CardHeader>
            <CardContent>
              <TimeSeriesChart
                height={150} yUnit=" kbps" xLabels={TIME_LABELS}
                series={[{ name: "Room bitrate", color: "var(--series-1)", data: series(60, 1, 2400, 340) }]}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Topology</CardTitle>
              <CardDescription>{topo === "graph" ? "who forwards to whom" : "sender × receiver"}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3.5">
              <div className="flex items-center gap-2.5">
                <Tabs value={topo} onValueChange={(v) => setTopo(v as typeof topo)}>
                  <TabsList>
                    <TabsTrigger value="graph">Node-link</TabsTrigger>
                    <TabsTrigger value="matrix">Matrix</TabsTrigger>
                  </TabsList>
                </Tabs>
                <span className="flex-1" />
                <span className="sl-label text-faint">Stroke width = bitrate</span>
              </div>

              {topo === "graph" ? (
                <>
                  <div className="rounded-md border border-subtle bg-sunken p-2"><NodeLink selected={peer.peer_id} /></div>
                  <p className="text-12 text-muted text-pretty">
                    Dashed edge = relay path, ICE degraded. Ring = selected peer. Hover an edge for its bitrate, loss and NACK ratio.
                  </p>
                </>
              ) : (
                <>
                  <Matrix />
                  <p className="text-12 text-muted text-pretty">
                    Rows are senders, columns receivers. A pale row isolates the faulty uplink at a glance, at constant
                    density whatever the peer count.
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader><CardTitle>Peers</CardTitle><CardDescription>Click a row to inspect</CardDescription></CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Peer</TableHead><TableHead>Quality</TableHead>
                  <TableHead className="text-right">Rtt</TableHead><TableHead className="text-right">Jitter</TableHead>
                  <TableHead className="text-right">Loss</TableHead><TableHead className="text-right">Nack</TableHead>
                  <TableHead>Codec</TableHead><TableHead>Tracks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {PEERS.map((p, i) => (
                  <TableRow key={p.peer_id} data-selected={i === sel} className="cursor-pointer" onClick={() => setSel(i)}>
                    <TableCell>
                      <span className="sl-num inline-flex items-center gap-2 font-medium text-strong">
                        <StatusDot status={p.status} />{p.peer_id}
                      </span>
                    </TableCell>
                    <TableCell><QualityIndicator quality={qualityOf(p.score)} /></TableCell>
                    <TableCell className="text-right"><LatencyChip ms={p.rtt} plain /></TableCell>
                    <TableCell className="sl-num text-right text-muted">{p.jitter}ms</TableCell>
                    <TableCell className={`sl-num text-right ${p.loss >= 2 ? "text-danger" : "text-muted"}`}>{p.loss.toFixed(2)}%</TableCell>
                    <TableCell className={`sl-num text-right ${p.nack >= 5 ? "text-danger" : "text-muted"}`}>{p.nack.toFixed(2)}%</TableCell>
                    <TableCell><Badge tone="accent">{p.codec}</Badge></TableCell>
                    <TableCell className="text-muted">{p.tracks.join(", ")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card className="overflow-hidden">
            <CardHeader><CardTitle>Room</CardTitle></CardHeader>
            <MetricGrid columns={2} className="rounded-none border-0 shadow-none">
              <MetricCard label="Peers" value={6} />
              <MetricCard label="Bitrate" value="2.4" unit="Mbps" />
              <MetricCard label="Rtt p50" value={94} unit="ms" state="warn" threshold="threshold 200ms" />
              <MetricCard label="Loss" value="1.41" unit="%" state="warn" threshold="threshold 2%" />
            </MetricGrid>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Selected peer</CardTitle>
              <CardDescription className="sl-num">{peer.peer_id}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3.5">
              <PeerCard
                className="border-0 p-0 shadow-none hover:shadow-none"
                peer={{
                  id: peer.peer_id, name: `${peer.region} · ${peer.codec}`,
                  status: peer.status, rttMs: peer.rtt, lossPct: peer.loss, jitterMs: peer.jitter,
                  quality: qualityOf(peer.score), tracks: peer.tracks,
                }}
              />
              <div className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="sl-label">Quality score</span>
                  <span className="sl-num text-12 text-strong">{peer.score}</span>
                </div>
                <Progress value={peer.score} indicatorClassName={peer.score < 70 ? "bg-warn-solid" : undefined} />
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader><CardTitle>Room timeline</CardTitle><CardDescription>live</CardDescription></CardHeader>
            <EventList events={ROOM_EVENTS} className="max-h-[240px]" />
          </Card>
        </div>
      </div>

      <Link href="/rooms" className="text-13 font-medium">← All rooms</Link>
    </div>
  );
}

const NODES = [
  { id: "a3f91c02", x: 120, y: 62, w: 3, tone: "" },
  { id: "0b8e2f61", x: 500, y: 62, w: 2, tone: "" },
  { id: "5e7b21f4", x: 80, y: 206, w: 4, tone: "" },
  { id: "d41f9ab7", x: 540, y: 206, w: 2, tone: "danger" },
  { id: "9c0d34aa", x: 230, y: 264, w: 2, tone: "" },
  { id: "2f81be07", x: 400, y: 264, w: 3, tone: "warn" },
];

function NodeLink({ selected }: { selected: string }) {
  return (
    <svg viewBox="0 0 620 300" className="block h-[290px] w-full" role="img" aria-label="Room topology">
      <g fill="none">
        {NODES.map((n) => (
          <line
            key={n.id} x1={310} y1={150} x2={n.x} y2={n.y}
            stroke={n.tone === "danger" ? "var(--danger-solid)" : n.tone === "warn" ? "var(--warn-solid)" : "var(--series-1)"}
            strokeWidth={n.w} strokeDasharray={n.tone === "danger" ? "5 4" : undefined}
            opacity={n.tone ? 0.8 : 0.55}
          />
        ))}
      </g>
      <rect x={256} y={122} width={108} height={56} rx={14} fill="var(--surface-card)" stroke="var(--accent-border)" strokeWidth={1.5} />
      <text x={310} y={145} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="var(--text-strong)">SFU</text>
      <text x={310} y={162} textAnchor="middle" fontSize={10.5} fill="var(--text-muted)">forwarding · 6</text>
      <g fontSize={10.5} fill="var(--text-body)" textAnchor="middle">
        {NODES.map((n) => {
          const isSel = n.id === selected;
          return (
            <g key={n.id}>
              <circle
                cx={n.x} cy={n.y} r={27}
                fill={isSel ? "var(--accent-tint)" : n.tone === "danger" ? "var(--danger-tint)" : n.tone === "warn" ? "var(--warn-tint)" : "var(--surface-card)"}
                stroke={isSel ? "var(--accent)" : n.tone === "danger" ? "var(--danger-solid)" : n.tone === "warn" ? "var(--warn-solid)" : "var(--border-strong)"}
                strokeWidth={isSel ? 2 : 1}
              />
              <text x={n.x} y={n.y + 4}>{n.id}</text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

const cellStyle = (v: number | null) =>
  v === null
    ? { bg: "repeating-linear-gradient(45deg,var(--n-150),var(--n-150) 4px,transparent 4px,transparent 8px)", border: "var(--border-strong)", title: "self" }
    : v >= 0.75 ? { bg: "var(--ok-tint)", border: "var(--ok-solid)", title: "healthy · loss under 2%" }
    : v >= 0.5 ? { bg: "var(--warn-tint)", border: "var(--warn-solid)", title: "approaching threshold" }
    : { bg: "var(--danger-tint)", border: "var(--danger-solid)", title: "breached · loss above 2%" };

function Matrix() {
  return (
    <div className="rounded-md border border-subtle bg-sunken p-4">
      <div className="grid items-center gap-1" style={{ gridTemplateColumns: "88px repeat(6, minmax(0,1fr))" }}>
        <span />
        {PEERS.map((p) => (
          <span key={p.peer_id} className="sl-num truncate text-center text-[11.5px] text-muted">{p.peer_id}</span>
        ))}
        {PEERS.map((p, i) => (
          <React.Fragment key={p.peer_id}>
            <span className="sl-num pr-2 text-right text-[11.5px] text-muted">{p.peer_id}</span>
            {MATRIX[i].map((v, j) => {
              const s = cellStyle(v);
              return (
                <span
                  key={j}
                  title={`${p.peer_id} → ${PEERS[j].peer_id} · ${s.title}`}
                  className="h-[38px] rounded-xs border"
                  style={{ background: s.bg, borderColor: s.border }}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <div className="mt-3.5 flex flex-wrap items-center gap-4 text-[11.5px] text-muted">
        {[
          ["healthy", "var(--ok-tint)", "var(--ok-solid)"],
          ["approaching", "var(--warn-tint)", "var(--warn-solid)"],
          ["breached", "var(--danger-tint)", "var(--danger-solid)"],
        ].map(([label, bg, bd]) => (
          <span key={label} className="flex items-center gap-1.5">
            <i className="h-2.5 w-3.5 rounded-[3px] border" style={{ background: bg, borderColor: bd }} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <i
            className="h-2.5 w-3.5 rounded-[3px] border"
            style={{ background: "repeating-linear-gradient(45deg,var(--n-150),var(--n-150) 4px,transparent 4px,transparent 8px)", borderColor: "var(--border-strong)" }}
          />
          self
        </span>
      </div>
    </div>
  );
}

export default function RoomDetailPage() {
  return (
    <React.Suspense fallback={null}>
      <RoomDetail />
    </React.Suspense>
  );
}
