'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Tabs } from '@lumyx/ui';
import { HairlineGrid } from '@/components/marketing/HairlineGrid';
import { PLANS, type Period } from '@/content/pricing';
import { PRICING_FAQ } from '@/content/home';
import { GITHUB_URL } from '@/content/nav';

const PERIOD_TABS = [
  { id: 'monthly', label: 'Monthly' },
  { id: 'annual', label: 'Yearly −20%' },
];

// Source: Home.dc.html:245-313 (section#pricing). The only client island this task adds — the
// monthly/yearly Tabs re-render the plan grid from `PLANS[period]` (added to the verifier's
// CLIENT_ALLOWED set in scripts/verify-ds.mjs; see task-7-report.md). Light theme, unlike
// #compare and the open-source/final-CTA/footer block either side of it.
export function PricingStrip() {
  const [period, setPeriod] = useState<Period>('monthly');
  const plans = PLANS[period];

  return (
    <section id="pricing" className="border-t border-border">
      <div className="grid grid-cols-1 gap-10 items-start max-w-[1280px] mx-auto px-5 py-14 sm:px-10 min-[900px]:grid-cols-[180px_minmax(0,1fr)] min-[900px]:py-20">
        <div className="flex flex-col gap-2 min-[900px]:sticky min-[900px]:top-8">
          <span className="sl-num text-12 text-faint">03</span>
          <span className="sl-label">Pricing</span>
          <p className="mt-1.5 text-[12.5px] leading-[1.6] text-muted [text-wrap:pretty]">
            Free forever self-hosted. Per participant-minute on Cloud.
          </p>
        </div>

        <div className="flex flex-col gap-6 min-w-0">
          <div className="flex items-end gap-6 flex-wrap">
            <div className="flex flex-col gap-3 max-w-[620px]">
              <h2
                data-anim="rise"
                className="m-0 text-[40px] font-semibold tracking-[-0.03em] leading-[1.1] text-strong [text-wrap:pretty]"
              >
                You only pay for minutes you didn&rsquo;t want to operate yourself.
              </h2>
              <p className="m-0 text-[14px] leading-[1.6] text-muted [text-wrap:pretty]">
                Egress is included up to each plan&rsquo;s cap. Every plan has a spend cap you
                set — past it, new rooms are refused and running sessions are preserved.
              </p>
            </div>
            <span style={{ flex: 1 }} />
            <Tabs
              variant="segmented"
              tabs={PERIOD_TABS}
              activeId={period}
              onSelect={(id) => setPeriod(id as Period)}
            />
          </div>

          <div data-anim="rise">
            <HairlineGrid columns={5}>
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className="relative bg-card px-[18px] py-6 flex flex-col gap-3.5"
                  style={{ boxShadow: plan.featured ? 'inset 0 2px 0 var(--accent)' : 'none' }}
                >
                  <div className="flex items-center gap-2 min-h-5">
                    <span className="sl-label">{plan.name}</span>
                    {plan.featured && <Badge tone="accent">Most chosen</Badge>}
                  </div>
                  <div className="flex items-baseline gap-1.25">
                    <span className="sl-num text-[28px] font-semibold tracking-[-0.03em] text-strong">
                      {plan.price}
                    </span>
                    <span className="text-12 text-muted">{plan.per}</span>
                  </div>
                  <span className="sl-num text-[12.5px] text-muted [text-wrap:pretty]">
                    {plan.headline}
                  </span>
                  <span className="text-[12.5px] leading-[1.6] text-muted border-t border-border-subtle pt-3.5 [text-wrap:pretty]">
                    {plan.who}
                  </span>
                  <div className="flex flex-col gap-2.25">
                    {plan.features.map((f) => (
                      <span key={f} className="sl-num text-[12.5px] text-body">
                        {f}
                      </span>
                    ))}
                  </div>
                  <span style={{ flex: 1 }} />
                  {/* "Get started free" and "View on GitHub" have real destinations (/signup,
                      GITHUB_URL); "Contact us" (Business) does not — no contact route exists in
                      this codebase's content files, so it stays a non-navigating button rather
                      than a fabricated destination (same reasoning as the standalone "Talk to
                      us about Business" button below). */}
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
          </div>

          <div className="flex items-center gap-3.5 flex-wrap px-5 py-4 border border-border rounded-card bg-card">
            <span className="sl-label">Overage</span>
            <span className="sl-num text-13 text-body">
              Starter €0.0012/min · Scale €0.0009/min · egress beyond the cap €0.09/GB
            </span>
            <span style={{ flex: 1 }} />
            <span className="sl-num text-[12.5px] text-faint">
              A participant-minute = one minute of one peer in a room.
            </span>
          </div>

          <div className="flex items-center gap-3.5 flex-wrap">
            <Link href="/signup">
              <Button variant="primary">Get started free</Button>
            </Link>
            {/* Source renders this as a bare Button with no href (Home.dc.html:298) — there is
                no "contact" route anywhere in this codebase's content files to link it to, so
                it stays a non-navigating button rather than a fabricated destination. */}
            <Button variant="secondary">Talk to us about Business</Button>
            <span style={{ flex: 1 }} />
            <Link href="/pricing" className="text-13 font-medium">
              Full plan comparison →
            </Link>
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5">
            {PRICING_FAQ.map((q) => (
              <div key={q.q} className="border-t border-border pt-4 flex flex-col gap-2">
                <span className="text-13 font-semibold text-strong [text-wrap:pretty]">{q.q}</span>
                <span className="text-[12.5px] leading-[1.6] text-muted [text-wrap:pretty]">
                  {q.a}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
