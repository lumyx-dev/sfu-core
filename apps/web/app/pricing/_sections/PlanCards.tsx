import Link from 'next/link';
import { Badge, Button } from '@lumyx/ui';
import { HairlineGrid } from '@/components/marketing/HairlineGrid';
import type { Plan } from '@/content/pricing';
import { GITHUB_URL } from '@/content/nav';

// Source: Pricing.dc.html:79-87. Plain function component, no 'use client' of its own — it is
// only ever rendered inside PlanSwitcher's client tree, and stays a simple presentational leaf
// so the plans data (which depends on the shared period) lives in exactly one place.
// Each cell is the same shape as Home's PricingStrip.tsx `.planCell` and friends.
export function PlanCards({ plans }: { plans: Plan[] }) {
  return (
    <HairlineGrid columns={5}>
      {plans.map((plan) => (
        <div
          key={plan.name}
          className={`relative bg-card px-4.5 py-6 flex flex-col gap-3.5 ${plan.featured ? 'shadow-[inset_0_2px_0_var(--sl-accent)]' : ''}`}
        >
          <div className="flex items-center gap-2 min-h-[20px]">
            <span className="sl-label">{plan.name}</span>
            {plan.featured && <Badge tone="accent">Most chosen</Badge>}
          </div>
          <div className="flex items-baseline gap-1.25">
            <span className="sl-num text-[30px] font-semibold tracking-[-0.03em] text-strong">{plan.price}</span>
            <span className="text-12 text-muted">{plan.per}</span>
          </div>
          <span className="sl-num text-[12.5px] text-muted [text-wrap:pretty]">{plan.headline}</span>
          <span className="text-[12.5px] leading-body text-muted border-t border-border-subtle pt-3.5 [text-wrap:pretty]">
            {plan.who}
          </span>
          <div className="flex flex-col gap-2.25">
            {plan.features.map((f) => (
              <span key={f} className="sl-num text-[12.5px] text-body">
                {f}
              </span>
            ))}
          </div>
          <span className="flex-1" />
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
