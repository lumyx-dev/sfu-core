'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Tabs } from '@sightline/ui';
import { HairlineGrid } from '@/components/marketing/HairlineGrid';
import { PLANS, type Period } from '@/content/pricing';
import { PRICING_FAQ } from '@/content/home';
import s from './PricingStrip.module.css';

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
    <section id="pricing" style={{ borderTop: '1px solid var(--border)' }}>
      <div className={s.layout}>
        <div className={s.rail}>
          <span className="sl-num" style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            03
          </span>
          <span className="sl-label">Pricing</span>
          <p className={s.railNote}>Free forever self-hosted. Per participant-minute on Cloud.</p>
        </div>

        <div className={s.content}>
          <div className={s.headerRow}>
            <div className={s.headerText}>
              <h2 data-anim="rise" className={s.headline}>
                You only pay for minutes you didn&rsquo;t want to operate yourself.
              </h2>
              <p className={s.lead}>
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
                  className={s.planCell}
                  style={{ boxShadow: plan.featured ? 'inset 0 2px 0 var(--accent)' : 'none' }}
                >
                  <div className={s.planNameRow}>
                    <span className="sl-label">{plan.name}</span>
                    {plan.featured && <Badge tone="accent">Most chosen</Badge>}
                  </div>
                  <div className={s.priceRow}>
                    <span className={`sl-num ${s.price}`}>{plan.price}</span>
                    <span className={s.per}>{plan.per}</span>
                  </div>
                  <span className={`sl-num ${s.planHeadline}`}>{plan.headline}</span>
                  <span className={s.who}>{plan.who}</span>
                  <div className={s.features}>
                    {plan.features.map((f) => (
                      <span key={f} className={`sl-num ${s.feature}`}>
                        {f}
                      </span>
                    ))}
                  </div>
                  <span style={{ flex: 1 }} />
                  <Button size="sm" variant={plan.variant} block>
                    {plan.cta}
                  </Button>
                </div>
              ))}
            </HairlineGrid>
          </div>

          <div className={s.overageBar}>
            <span className="sl-label">Overage</span>
            <span className={`sl-num ${s.overageText}`}>
              Starter €0.0012/min · Scale €0.0009/min · egress beyond the cap €0.09/GB
            </span>
            <span style={{ flex: 1 }} />
            <span className={`sl-num ${s.overageNote}`}>
              A participant-minute = one minute of one peer in a room.
            </span>
          </div>

          <div className={s.ctaRow}>
            <Link href="/signup">
              <Button variant="primary">Get started free</Button>
            </Link>
            {/* Source renders this as a bare Button with no href (Home.dc.html:298) — there is
                no "contact" route anywhere in this codebase's content files to link it to, so
                it stays a non-navigating button rather than a fabricated destination. */}
            <Button variant="secondary">Talk to us about Business</Button>
            <span style={{ flex: 1 }} />
            <Link href="/pricing" className={s.link}>
              Full plan comparison →
            </Link>
          </div>

          <div className={s.faqGrid}>
            {PRICING_FAQ.map((q) => (
              <div key={q.q} className={s.faqItem}>
                <span className={s.faqQ}>{q.q}</span>
                <span className={s.faqA}>{q.a}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
