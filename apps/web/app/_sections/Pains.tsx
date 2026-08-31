import type { ReactNode } from 'react';
import { Badge, MetricCard, MetricGrid } from '@lumyx/ui';
import { PAINS } from '@/content/home';
import { BENCHMARKS } from '@/content/benchmarks';

// Source: Home.dc.html:186-212 (section#why) plus the three proof renderers in the logic class
// (proofBinary / proofDashboard / proofRust). Each pain alternates which column — text or proof
// — sits on the left via the source's own `order`/`proofOrder` values (content/home.ts PAINS).
// Below 720px the two columns stack and the alternation stops mattering.
//
// No responsive behaviour exists in the source — it's a fixed 1280px mockup — so the
// breakpoints below are this task's own choice, following the custom-pixel-breakpoint
// convention already used elsewhere on this page rather than Tailwind's default scale.

function ProofBinary() {
  const rows: [string, string][] = [
    ['Processes to run', '1'],
    ['External dependencies', 'none required'],
    ['Config to start', '0 lines'],
    ['Image size', 'single static binary'],
  ];
  return (
    <div className="border border-border rounded-card bg-card overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-[13px] border-b border-border-subtle">
        <span className="sl-label">Deployment surface</span>
        <span style={{ flex: 1 }} />
        <Badge tone="ok">docker run</Badge>
      </div>
      {rows.map(([k, v]) => (
        <div
          key={k}
          className="flex items-center justify-between gap-4 px-5 py-[13px] border-b border-border-subtle last:border-b-0"
        >
          <span className="text-13 text-muted flex-none">{k}</span>
          <span className="sl-num text-13 text-strong font-medium text-right">{v}</span>
        </div>
      ))}
    </div>
  );
}

function ProofDashboard() {
  return (
    <div className="border border-border rounded-card bg-card overflow-hidden shadow-sm">
      <div className="flex items-center gap-2.5 px-5 py-[13px] border-b border-border-subtle">
        <span className="sl-label">Alerts — open</span>
        <span style={{ flex: 1 }} />
        <span className="sl-num text-12 text-muted">webinar-us · ap-south-1</span>
      </div>
      <MetricGrid columns={2}>
        <MetricCard
          label="Packet loss"
          value="7.90"
          unit="%"
          status="error"
          sublabel="threshold 2% · 3m 12s"
        />
        <MetricCard label="NACK ratio" value="11.40" unit="%" status="error" sublabel="threshold 5%" />
        <MetricCard label="Round-trip time" value={284} unit="ms" status="error" sublabel="threshold 200ms" />
        <MetricCard label="Freeze ratio" value="4.10" unit="%" status="error" sublabel="threshold 1%" />
      </MetricGrid>
      <div className="px-5 py-[13px] border-t border-border-subtle bg-sunken">
        <span className="text-12 text-muted">
          No exporter, no dashboard JSON to maintain, no Grafana to keep alive.
        </span>
      </div>
    </div>
  );
}

function ProofRust() {
  return (
    <div className="border border-border rounded-card bg-card overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-[13px] border-b border-border-subtle">
        <span className="sl-label">Runtime characteristics</span>
        <span style={{ flex: 1 }} />
        <Badge tone="neutral">rustc 1.79</Badge>
      </div>
      {BENCHMARKS.map((b, i) => {
        const faint = i === BENCHMARKS.length - 1;
        return (
          <div
            key={b.label}
            className="flex items-baseline justify-between gap-4 px-5 py-[13px] border-b border-border-subtle last:border-b-0"
          >
            <span className="text-13 text-muted flex-none">{b.label}</span>
            <span
              className={`sl-num text-13 text-right ${faint ? 'text-faint font-normal' : 'text-strong font-medium'}`}
            >
              {b.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const PROOFS: ReactNode[] = [<ProofBinary key="binary" />, <ProofDashboard key="dashboard" />, <ProofRust key="rust" />];

export function Pains() {
  return (
    <section id="why" className="border-t border-border bg-card">
      <div className="grid grid-cols-1 gap-10 items-start max-w-[1280px] mx-auto px-5 py-14 sm:px-10 min-[900px]:grid-cols-[180px_minmax(0,1fr)] min-[900px]:py-20">
        <div className="flex flex-col gap-2 min-[900px]:sticky min-[900px]:top-8">
          <span className="sl-num text-12 text-faint">01</span>
          <span className="sl-label">Why Sightline</span>
          <p className="mt-1.5 text-[12.5px] leading-[1.6] text-muted [text-wrap:pretty]">
            Three things that hurt in production, and what replaces them.
          </p>
        </div>

        <div className="flex flex-col gap-11">
          {/* Source (Home.dc.html:196) gives every pain block a bare data-anim="rise" with no
              data-anim-delay — there is no staggered delay here; each block's entrance is
              triggered independently by the IntersectionObserver as it scrolls into view. */}
          {PAINS.map((p, i) => (
            <div
              key={p.index}
              data-anim="rise"
              className="grid grid-cols-1 gap-11 pb-11 border-b border-border min-[720px]:grid-cols-2 min-[720px]:items-center"
            >
              <div className="flex flex-col gap-3.5 min-w-0" style={{ order: p.order }}>
                <span className="sl-num text-12 text-faint">{p.index}</span>
                <h2 className="m-0 text-[34px] font-semibold tracking-[-0.03em] leading-[1.12] text-strong [text-wrap:pretty]">
                  {p.headline}
                </h2>
                <p className="m-0 text-[14px] leading-[1.6] text-muted max-w-[460px] [text-wrap:pretty]">
                  {p.body}
                </p>
                <div className="flex items-center gap-2 flex-wrap pt-0.5">
                  {p.chips.map((chip) => (
                    <span
                      key={chip}
                      className="sl-num inline-flex items-center h-[26px] px-[11px] border border-border rounded-full text-12 text-body bg-page"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
              <div className="min-w-0" style={{ order: p.proofOrder }}>
                {PROOFS[i]}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
