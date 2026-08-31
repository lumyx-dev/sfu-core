'use client';

import { useState } from 'react';
import { estimate } from '@/content/pricing';
import { usePricingPeriod } from '@/components/marketing/PricingPeriodProvider';
import s from './CostEstimator.module.css';

const fmt = (n: number) => n.toLocaleString('en-US');

// Source: Pricing.dc.html:64-75 — the estimator card, the hero's entire right column
// (correction 2/3 of task-8-brief.md; it is not a standalone section further down the page).
// Minutes are local state; the period comes from PricingPeriodProvider so it stays in sync
// with the Plans section's Tabs (PlanSwitcher.tsx).
export function CostEstimator() {
  const { period } = usePricingPeriod();
  const [minutes, setMinutes] = useState(120_000);
  const est = estimate(minutes, period);

  return (
    <div
      data-anim="rise"
      data-anim-now
      data-anim-delay="220"
      className="flex flex-col gap-3.5 border p-5"
      style={{
        borderColor: 'var(--border)',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--surface-card)',
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="sl-label">Estimate your bill</span>
        <span className="sl-num" style={{ fontSize: 12, color: 'var(--text-faint)' }}>
          {fmt(minutes)} participant-minutes/mo
        </span>
      </div>
      <input
        type="range"
        min={5000}
        max={1_500_000}
        step={5000}
        value={minutes}
        onChange={(e) => setMinutes(Number(e.target.value))}
        className={s.range}
        aria-label="Participant-minutes per month"
      />
      <div
        className="flex items-baseline gap-2"
        style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}
      >
        <span
          className="sl-num"
          style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--text-strong)' }}
        >
          {est.cost}
        </span>
        <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>/mo on {est.plan}</span>
      </div>
      <span style={{ fontSize: 12, lineHeight: 1.55, color: 'var(--text-muted)', textWrap: 'pretty' }}>
        {est.note}
      </span>
    </div>
  );
}
