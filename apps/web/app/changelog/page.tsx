import { SiteFooter } from '@/components/chrome/SiteFooter';
import { ChangelogHero } from './_sections/ChangelogHero';
import { ReleaseNotes } from './_sections/ReleaseNotes';

// Source: Changelog.dc.html. Entirely static, no client boundary anywhere on this route
// (task-11-brief.md: "'use client' on nothing in this task"). Two `.theme-dark` wrappers, as in
// the source: ChangelogHero owns the first one (header + hero, line 32); the second one here
// (line 123) wraps only the footer — this page has no final-CTA section between the release
// list and the footer, unlike Home/Pricing/Compare.
export default function ChangelogPage() {
  return (
    <>
      <ChangelogHero />
      <ReleaseNotes />
      <div
        className="theme-dark"
        style={{ background: 'var(--surface-page)', color: 'var(--text-body)', borderTop: '1px solid var(--border)' }}
      >
        <SiteFooter />
      </div>
    </>
  );
}
