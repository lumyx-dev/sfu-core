'use client';

import { Tabs } from '@lumyx/ui';
import { PLANS, type Period } from '@/content/pricing';
import { usePricingPeriod } from '@/components/marketing/PricingPeriodProvider';
import { PlanCards } from './PlanCards';
import s from './PlanSwitcher.module.css';

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
    <section className={s.section}>
      <div className={s.layout}>
        <div className={s.headerRow}>
          <span className="sl-label">Plans</span>
          <span style={{ flex: 1 }} />
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

        <div className={`flex items-center gap-3.5 flex-wrap ${s.overageBar}`}>
          <span className="sl-label">Overage</span>
          <span className={`sl-num ${s.overageText}`}>
            Starter €0.0012/min · Scale €0.0009/min · egress beyond the cap €0.09/GB
          </span>
          <span style={{ flex: 1 }} />
          <span className={`sl-num ${s.overageNote}`}>
            A participant-minute = one minute of one peer in a room.
          </span>
        </div>
      </div>
    </section>
  );
}
