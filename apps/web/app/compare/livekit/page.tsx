import { SiteFooter } from '@/components/chrome/SiteFooter';
import { CompareHero } from './_sections/CompareHero';
import { Summary } from './_sections/Summary';
import { CompareTable } from './_sections/CompareTable';
import { Replaces } from './_sections/Replaces';
import { MigrationSteps } from './_sections/MigrationSteps';
import { NotForYou } from './_sections/NotForYou';
import { FinalCta } from './_sections/FinalCta';

// Source: Compare LiveKit.dc.html. No 'use client' anywhere on this page — it has no
// interactive state. MigrationSteps carries its own `theme-dark#migrate` wrapper (correction 5);
// the closing `theme-dark` wrapper here spans the final CTA and the footer together, same
// pattern as Home's and Pricing's `app/page.tsx`.
export default function CompareLiveKitPage() {
  return (
    <>
      <CompareHero />
      <Summary />
      <CompareTable />
      <Replaces />
      <MigrationSteps />
      <NotForYou />
      <div
        className="theme-dark"
        style={{ background: 'var(--surface-page)', color: 'var(--text-body)', borderTop: '1px solid var(--border)' }}
      >
        <FinalCta />
        <SiteFooter />
      </div>
    </>
  );
}
