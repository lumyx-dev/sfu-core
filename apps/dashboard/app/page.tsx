"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card, CardHeader, CardTitle, CardContent, CardDescription, Badge, Progress, Table, TableBody,
  TableCell, TableHead, TableHeader, TableRow, MetricCard, MetricGrid, TimeSeriesChart,
  EventList, AlertBanner, StatusDot, QualityIndicator, LatencyChip, Sparkline, RoomCard,
} from '@lumyx/ui';
import { ROOMS, FLEET_PEERS, EVENTS, TIME_LABELS, series, qualityOf } from "@/lib/dashboard-data";

export default function OverviewPage() {
  const router = useRouter();
  const [alert, setAlert] = useState(true);
  const worst = [...FLEET_PEERS].sort((a, b) => a.score - b.score);

  return (
    <div className="flex max-w-340 flex-col gap-6">
      {alert ? (
        <AlertBanner
          severity="critical"
          title="Peer ff104b2c is degrading"
          body="Packet loss has been above 2% for 3m 12s. Force audio-only or renegotiate the session."
          context="webinar-us · ap-south-1 · 14:06:41 · loss 7.90% vs 2%"
          actionLabel="Open alerts"
          onAction={() => setAlert(false)}
        />
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Server</CardTitle>
          <CardDescription>last 60 min</CardDescription>
        </CardHeader>
        <MetricGrid columns={5} className="rounded-none border-0 shadow-none">
          <MetricCard label="Active rooms" value={4} threshold="1 idle" />
          <MetricCard label="Connected peers" value={65} threshold="+3 · 60s" />
          <MetricCard label="Bandwidth" value="12.4" unit="Mbps" threshold="out · 3.1 Mbps in" />
          <MetricCard label="Packets forwarded" value="1,284,920" threshold="1.29 GB total" />
          <MetricCard label="Alerts" value={4} state="danger" threshold="2 critical" />
        </MetricGrid>
      </Card>

      <div className="grid items-start gap-4 xl:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Bandwidth</CardTitle>
              <CardDescription>last 60 min · outbound vs inbound</CardDescription>
            </CardHeader>
            <CardContent>
              <TimeSeriesChart
                height={190} yUnit=" Mbps" xLabels={TIME_LABELS}
                series={[
                  { name: "Outbound", color: "var(--series-1)", data: series(60, 3, 12.4, 3.1) },
                  { name: "Inbound", color: "var(--series-2)", data: series(60, 7, 3.1, 0.9) },
                ]}
              />
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Peers</CardTitle>
              <CardDescription>{worst.length} of 65 · worst first</CardDescription>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Peer</TableHead><TableHead>Room</TableHead><TableHead>Quality</TableHead>
                  <TableHead className="text-right">Rtt</TableHead><TableHead className="text-right">Jitter</TableHead>
                  <TableHead className="text-right">Loss</TableHead><TableHead>Codec</TableHead><TableHead>60s</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {worst.map((p) => (
                  <TableRow key={p.peer_id} className="cursor-pointer" onClick={() => router.push(`/rooms/room?id=${p.room}&peer=${p.peer_id}`)}>
                    <TableCell>
                      <span className="sl-num inline-flex items-center gap-2 font-medium text-strong">
                        <StatusDot status={p.status} />{p.peer_id}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted">{p.room}</TableCell>
                    <TableCell><QualityIndicator quality={qualityOf(p.score)} /></TableCell>
                    <TableCell className="text-right"><LatencyChip ms={p.rtt} plain /></TableCell>
                    <TableCell className="sl-num text-right text-muted">{p.jitter}ms</TableCell>
                    <TableCell className={`sl-num text-right ${p.loss >= 2 ? "text-danger" : "text-muted"}`}>{p.loss.toFixed(2)}%</TableCell>
                    <TableCell><Badge tone="accent">{p.codec}</Badge></TableCell>
                    <TableCell>
                      <Sparkline data={p.series} width={72} height={24} color={p.score < 70 ? "var(--warn-solid)" : "var(--series-1)"} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Active rooms</CardTitle>
              <CardDescription>4</CardDescription>
            </CardHeader>
            <div className="flex flex-col divide-y divide-subtle">
              {ROOMS.filter((r) => r.state === "active").map((r) => (
                <RoomCard
                  key={r.id}
                  href={`/rooms/room?id=${r.id}`}
                  className="rounded-none border-0 shadow-none hover:bg-hover hover:shadow-none"
                  room={{
                    id: r.id, region: r.region, peers: r.peers,
                    status: r.health === "ok" ? "live" : r.health === "degraded" ? "degraded" : "idle",
                    durationLabel: r.uptime, bitrateLabel: r.bitrate,
                    worstLossPct: r.health === "degraded" ? 3.41 : 0.2,
                  }}
                />
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader><CardTitle>Capacity</CardTitle><CardDescription>this instance</CardDescription></CardHeader>
            <CardContent className="flex flex-col gap-4">
              {[
                { label: "Rooms", value: 12.5, right: "4 / 32" },
                { label: "Uplink", value: 41, right: "41%" },
                { label: "Metrics retention", value: 82, right: "82%", tone: "bg-accent2" },
              ].map((b) => (
                <div key={b.label} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="sl-label">{b.label}</span>
                    <span className="sl-num text-12 text-strong">{b.right}</span>
                  </div>
                  <Progress value={b.value} indicatorClassName={b.tone} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader><CardTitle>Recent events</CardTitle><CardDescription>live</CardDescription></CardHeader>
            <EventList events={EVENTS} className="max-h-60" />
          </Card>
        </div>
      </div>
    </div>
  );
}
