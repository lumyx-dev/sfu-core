'use client';

import { useState } from 'react';
import { estimate } from '@/content/pricing';
import { usePricingPeriod } from '@/components/marketing/PricingPeriodProvider';

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
      className="flex flex-col gap-3.5 border border-border rounded-card bg-card p-5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="sl-label">Estimate your bill</span>
        <span className="sl-num text-[12px] text-faint">
          {fmt(minutes)} participant-minutes/mo
        </span>
      </div>
      {/* The range input carries only `accent-color` and `cursor` in the source (no custom
          track/thumb) — kept minimal rather than inventing a thumb style the source never
          specifies. */}
      <input
        type="range"
        min={5000}
        max={1_500_000}
        step={5000}
        value={minutes}
        onChange={(e) => setMinutes(Number(e.target.value))}
        className="w-full accent-accent cursor-pointer"
        aria-label="Participant-minutes per month"
      />
      <div className="flex items-baseline gap-2 border-t border-border-subtle pt-3.5">
        <span className="sl-num text-[30px] font-semibold tracking-[-0.03em] text-strong">
          {est.cost}
        </span>
        <span className="text-[12.5px] text-muted">/mo on {est.plan}</span>
      </div>
      <span className="text-[12px] leading-[1.55] text-muted [text-wrap:pretty]">
        {est.note}
      </span>
    </div>
  );
}
