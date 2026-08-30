import type { ReactNode } from 'react';
import { Badge, MetricCard, MetricGrid } from '@sightline/ui';
import { PAINS } from '@/content/home';
import { BENCHMARKS } from '@/content/benchmarks';
import s from './Pains.module.css';

// Source: Home.dc.html:186-212 (section#why) plus the three proof renderers in the logic class
// (proofBinary / proofDashboard / proofRust). Each pain alternates which column — text or proof
// — sits on the left via the source's own `order`/`proofOrder` values (content/home.ts PAINS).
// Below 720px the two columns stack and the alternation stops mattering.

function ProofBinary() {
  const rows: [string, string][] = [
    ['Processes to run', '1'],
    ['External dependencies', 'none required'],
    ['Config to start', '0 lines'],
    ['Image size', 'single static binary'],
  ];
  return (
    <div className={s.proofCard}>
      <div className={s.proofHeader}>
        <span className="sl-label">Deployment surface</span>
        <span style={{ flex: 1 }} />
        <Badge tone="ok">docker run</Badge>
      </div>
      {rows.map(([k, v]) => (
        <div key={k} className={s.proofRow}>
          <span className={s.proofRowLabel}>{k}</span>
          <span className={`sl-num ${s.proofRowValue}`}>{v}</span>
        </div>
      ))}
    </div>
  );
}

function ProofDashboard() {
  return (
    <div className={`${s.proofCard} ${s.proofCardShadow}`}>
      <div className={s.proofHeader}>
        <span className="sl-label">Alerts — open</span>
        <span style={{ flex: 1 }} />
        <span className={`sl-num ${s.proofHeaderMeta}`}>webinar-us · ap-south-1</span>
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
      <div className={s.proofFooter}>
        <span className={s.proofFooterText}>
          No exporter, no dashboard JSON to maintain, no Grafana to keep alive.
        </span>
      </div>
    </div>
  );
}

function ProofRust() {
  return (
    <div className={s.proofCard}>
      <div className={s.proofHeader}>
        <span className="sl-label">Runtime characteristics</span>
        <span style={{ flex: 1 }} />
        <Badge tone="neutral">rustc 1.79</Badge>
      </div>
      {BENCHMARKS.map((b, i) => {
        const faint = i === BENCHMARKS.length - 1;
        return (
          <div key={b.label} className={`${s.proofRow} ${s.proofRowBaseline}`}>
            <span className={s.proofRowLabel}>{b.label}</span>
            <span
              className={`sl-num ${s.proofRowValue}${faint ? ` ${s.proofRowValueFaint}` : ''}`}
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
    <section id="why" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-card)' }}>
      <div className={s.layout}>
        <div className={`flex flex-col gap-2 ${s.rail}`}>
          <span className="sl-num" style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            01
          </span>
          <span className="sl-label">Why Sightline</span>
          <p className={s.railNote}>Three things that hurt in production, and what replaces them.</p>
        </div>

        <div className={s.list}>
          {/* Source (Home.dc.html:196) gives every pain block a bare data-anim="rise" with no
              data-anim-delay — there is no staggered delay here; each block's entrance is
              triggered independently by the IntersectionObserver as it scrolls into view. */}
          {PAINS.map((p, i) => (
            <div key={p.index} data-anim="rise" className={s.pain}>
              <div className={s.text} style={{ order: p.order }}>
                <span className="sl-num" style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                  {p.index}
                </span>
                <h2 className={s.headline}>{p.headline}</h2>
                <p className={s.body}>{p.body}</p>
                <div className="flex items-center gap-2 flex-wrap pt-0.5">
                  {p.chips.map((chip) => (
                    <span key={chip} className={`sl-num ${s.chip}`}>
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
              <div className={s.proof} style={{ order: p.proofOrder }}>
                {PROOFS[i]}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
