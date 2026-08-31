import { SiteFooter } from '@/components/chrome/SiteFooter';
import { Hero } from './_sections/Hero';
import { LiveCard } from './_sections/LiveCard';
import { Pains } from './_sections/Pains';
import { CompareStrip } from './_sections/CompareStrip';
import { PricingStrip } from './_sections/PricingStrip';
import { OpenSource } from './_sections/OpenSource';
import { FinalCta } from './_sections/FinalCta';

// Source: Home.dc.html. Two `.theme-dark` wrappers besides the hero: `#compare` (its own,
// self-contained — see CompareStrip.tsx) and a second one at line 314 that spans open source,
// the final CTA, and the footer — applied here because it crosses three separate components.
export default function Home() {
  return (
    <>
      <Hero />
      <LiveCard />
      <Pains />
      <CompareStrip />
      <PricingStrip />
      <div className="theme-dark" style={{ background: 'var(--surface-page)', color: 'var(--text-body)', borderTop: '1px solid var(--border)' }}>
        <OpenSource />
        <FinalCta />
        <SiteFooter />
      </div>
    </>
  );
}
