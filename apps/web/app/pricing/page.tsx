import { SiteFooter } from '@/components/chrome/SiteFooter';
import { PricingPeriodProvider } from '@/components/marketing/PricingPeriodProvider';
import { PricingHero } from './_sections/PricingHero';
import { PlanSwitcher } from './_sections/PlanSwitcher';
import { ComparisonTable } from './_sections/ComparisonTable';
import { PricingFaq } from './_sections/PricingFaq';
import { FinalCta } from './_sections/FinalCta';

// Source: Pricing.dc.html. PricingPeriodProvider is the only page-wide client boundary — it
// exists solely so the hero's CostEstimator and the Plans section's PlanSwitcher agree on the
// monthly/annual period (task-8-brief.md correction 4); every other section here stays a Server
// Component, passed through as `children`. The closing `.theme-dark` wrapper (correction 8)
// spans the final CTA and the footer, same pattern as Home's app/page.tsx.
export default function PricingPage() {
  return (
    <PricingPeriodProvider>
      <PricingHero />
      <PlanSwitcher />
      <ComparisonTable />
      <PricingFaq />
      <div
        className="theme-dark"
        style={{ background: 'var(--surface-page)', color: 'var(--text-body)', borderTop: '1px solid var(--border)' }}
      >
        <FinalCta />
        <SiteFooter />
      </div>
    </PricingPeriodProvider>
  );
}
