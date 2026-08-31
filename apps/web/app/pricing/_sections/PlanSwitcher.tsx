'use client';

import { Tabs } from '@lumyx/ui';
import { PLANS, type Period } from '@/content/pricing';
import { usePricingPeriod } from '@/components/marketing/PricingPeriodProvider';
import { PlanCards } from './PlanCards';

const PERIOD_TABS = [
  { id: 'monthly', label: 'Monthly' },
  { id: 'annual', label: 'Yearly −20%' },
];

// Source: Pricing.dc.html:79-96. The period toggle lives here, in the Plans section header —
// not in the estimator (task-8-brief.md correction 4) — and is shared with CostEstimator via
// PricingPeriodProvider so both show the same period.
export function PlanSwitcher() {
  const { period, setPeriod } = usePricingPeriod();
  const plans = PLANS[period];

  return (
    // Unlike the comparison table and FAQ sections either side of it, this one has no 180px
    // rail: it is a plain flex column (Pricing.dc.html:79-96, `padding:56px 40px;
    // display:flex;flex-direction:column;gap:24px`).
    <section className="border-t border-border">
      <div className="flex flex-col gap-6 max-w-[1280px] mx-auto px-5 py-14 sm:px-10">
        <div className="flex items-end gap-5 flex-wrap">
          <span className="sl-label">Plans</span>
          <span className="flex-1" />
          <Tabs
            tabs={PERIOD_TABS}
            activeId={period}
            onSelect={(id) => setPeriod(id as Period)}
            variant="segmented"
          />
        </div>

        <div data-anim="rise">
          <PlanCards plans={plans} />
        </div>

        <div className="flex items-center gap-3.5 flex-wrap px-5 py-4 border border-border rounded-card bg-card">
          <span className="sl-label">Overage</span>
          <span className="sl-num text-13 text-body">
            Starter €0.0012/min · Scale €0.0009/min · egress beyond the cap €0.09/GB
          </span>
          <span className="flex-1" />
          <span className="sl-num text-[12.5px] text-faint">
            A participant-minute = one minute of one peer in a room.
          </span>
        </div>
      </div>
    </section>
  );
}
