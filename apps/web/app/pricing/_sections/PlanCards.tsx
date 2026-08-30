import Link from 'next/link';
import { Badge, Button } from '@sightline/ui';
import { HairlineGrid } from '@/components/marketing/HairlineGrid';
import type { Plan } from '@/content/pricing';
import { GITHUB_URL } from '@/content/nav';
import s from './PlanCards.module.css';

// Source: Pricing.dc.html:79-87. Plain function component, no 'use client' of its own — it is
// only ever rendered inside PlanSwitcher's client tree, and stays a simple presentational leaf
// so the plans data (which depends on the shared period) lives in exactly one place.
export function PlanCards({ plans }: { plans: Plan[] }) {
  return (
    <HairlineGrid columns={5}>
      {plans.map((plan) => (
        <div
          key={plan.name}
          className={s.cell}
          style={{ boxShadow: plan.featured ? 'inset 0 2px 0 var(--accent)' : 'none' }}
        >
          <div className={s.nameRow}>
            <span className="sl-label">{plan.name}</span>
            {plan.featured && <Badge tone="accent">Most chosen</Badge>}
          </div>
          <div className={s.priceRow}>
            <span className={`sl-num ${s.price}`}>{plan.price}</span>
            <span className={s.per}>{plan.per}</span>
          </div>
          <span className={`sl-num ${s.headline}`}>{plan.headline}</span>
          <span className={s.who}>{plan.who}</span>
          <div className={s.features}>
            {plan.features.map((f) => (
              <span key={f} className={`sl-num ${s.feature}`}>
                {f}
              </span>
            ))}
          </div>
          <span style={{ flex: 1 }} />
          {/* "Get started free" and "View on GitHub" have real destinations (/signup,
              GITHUB_URL); "Contact us" (Business) has none in this codebase's content files,
              so it stays a non-navigating button rather than a fabricated destination. */}
          {plan.cta === 'Get started free' ? (
            <Link href="/signup">
              <Button size="sm" variant={plan.variant} block>
                {plan.cta}
              </Button>
            </Link>
          ) : plan.cta === 'View on GitHub' ? (
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">
              <Button size="sm" variant={plan.variant} block>
                {plan.cta}
              </Button>
            </a>
          ) : (
            <Button size="sm" variant={plan.variant} block>
              {plan.cta}
            </Button>
          )}
        </div>
      ))}
    </HairlineGrid>
  );
}
