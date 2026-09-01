"use client";

import { Card, SeverityBadge } from '@lumyx/ui';
import { REMEDIATIONS } from "@/lib/platform-data";
import { LiveChart, useLiveSeries } from "@/components/site/live-chart";

function CellLabel({ children }: { children: React.ReactNode }) {
  return <span className="sl-label">{children}</span>;
}

/** Measure / Alert / Act — each promise is shown, not described. */
export function PlatformBento() {
  const { jitter, loss, sample } = useLiveSeries();

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.35fr_1fr]">
      {/* 01 — Measure. The chart eats the slack so the span never leaves a void. */}
      <Card className="flex flex-col overflow-hidden lg:row-span-2">
        <div className="flex flex-col gap-2.5 px-6 pb-[18px] pt-6">
          <span className="sl-label text-accent-text">01 · Measure</span>
          <h3 className="text-[22px] font-semibold tracking-[-0.025em] text-strong">
            Six metrics, read as the packets pass
          </h3>
          <p className="max-w-[440px] text-14 leading-relaxed text-muted text-pretty">
            RTCP reports and NACK traffic are parsed inside the forwarder, so a series exists for every peer and
            every track without an exporter, an agent or a scrape interval.
          </p>
        </div>

        {/* 1px gap over --border-subtle: the cells' own white paints the hairlines. */}
        <div className="grid grid-cols-3 gap-px border-y border-subtle bg-subtle">
          <div className="flex flex-col gap-1.5 bg-card px-4 py-3.5">
            <CellLabel>Jitter</CellLabel>
            <span className="sl-num text-26 font-medium text-strong">{sample.jitter}</span>
          </div>
          <div className="flex flex-col gap-1.5 bg-card px-4 py-3.5">
            <CellLabel>Packet loss</CellLabel>
            <span className="sl-num text-26 font-medium" style={{ color: sample.lossTone }}>
              {sample.loss}
            </span>
          </div>
          <div className="flex flex-col gap-1.5 bg-card px-4 py-3.5">
            <CellLabel>Freeze ratio</CellLabel>
            <span className="sl-num text-26 font-medium text-strong">0.12%</span>
          </div>
        </div>

        <LiveChart jitter={jitter} loss={loss} />

        <div className="flex items-center gap-4 border-t border-subtle px-6 py-3">
          <span className="flex items-center gap-[7px] text-12 text-muted">
            <span className="h-0.5 w-3.5 bg-accent" />
            jitter_ms
          </span>
          <span className="flex items-center gap-[7px] text-12 text-muted">
            <span className="h-0.5 w-3.5 bg-accent2" />
            packet_loss_ratio
          </span>
          <span className="flex-1" />
          <span className="sl-num text-12 text-faint">500ms resolution</span>
        </div>
      </Card>

      {/* 02 — Alert. */}
      <Card className="flex flex-col overflow-hidden">
        <div className="flex flex-col gap-2.5 px-6 pb-4 pt-6">
          <span className="sl-label text-accent-text">02 · Alert</span>
          <h3 className="text-[22px] font-semibold tracking-[-0.025em] text-strong">
            Named peer, value, threshold
          </h3>
          <p className="text-14 leading-relaxed text-muted text-pretty">
            Not &ldquo;video quality degraded in eu-west-3&rdquo;. The peer, the room, the number it crossed and
            what to do about it.
          </p>
        </div>
        <div className="flex flex-col gap-2.5 px-6 pb-6">
          <div className="flex flex-col gap-[7px] rounded-md border border-danger bg-danger-tint p-4">
            <span className="flex items-center gap-2.5">
              <SeverityBadge severity="critical">Breached</SeverityBadge>
              <span className="text-[13.5px] font-semibold text-strong">Peer ff104b2c is degrading</span>
            </span>
            <span className="text-13 leading-relaxed text-body">
              Packet loss above 2% for 3m 12s. Force audio-only or renegotiate.
            </span>
            <span className="sl-num text-12 text-muted">webinar-us · ap-south-1 · loss 7.90% vs 2%</span>
          </div>
          <div className="flex flex-col gap-[7px] rounded-md border border-warn bg-warn-tint p-4">
            <span className="flex items-center gap-2.5">
              <SeverityBadge severity="warning">Approaching</SeverityBadge>
              <span className="text-[13.5px] font-semibold text-strong">Jitter rising in standup-eu</span>
            </span>
            <span className="sl-num text-12 text-muted">eu-west-3 · jitter 46ms vs 40ms · 48s</span>
          </div>
        </div>
      </Card>

      {/* 03 — Act. */}
      <Card className="flex flex-col overflow-hidden">
        <div className="flex flex-col gap-2.5 px-6 pb-4 pt-6">
          <span className="sl-label text-accent-text">03 · Act</span>
          <h3 className="text-[22px] font-semibold tracking-[-0.025em] text-strong">
            Fix it from the dashboard
          </h3>
          <p className="text-14 leading-relaxed text-muted text-pretty">
            Remediation runs against the live session — no client deploy, no asking the user to reload.
          </p>
        </div>
        <div className="border-t border-subtle">
          {REMEDIATIONS.map((r, i) => (
            <div
              key={r.action}
              className={`flex items-center gap-3.5 px-6 py-3.5 ${i < REMEDIATIONS.length - 1 ? "border-b border-subtle" : ""}`}
            >
              <span className="flex-1 text-[13.5px] font-medium text-strong">{r.action}</span>
              <span className="text-[12.5px] text-muted">{r.detail}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
