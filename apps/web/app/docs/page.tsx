import type { Metadata } from 'next';
import { Fragment } from 'react';
import { Badge } from '@sightline/ui';
import { METRICS } from '@/content/metrics';
import { DocsHeader } from './_sections/DocsHeader';
import { DocsNav } from './_sections/DocsNav';
import { DocsRail } from './_sections/DocsRail';
import { ThresholdsTable } from './_sections/ThresholdsTable';
import { MetricSection } from './_sections/MetricSection';
import { Overrides } from './_sections/Overrides';
import s from './page.module.css';

const CRUMBS = ['Docs', 'Observability', 'Metrics reference'];

export const metadata: Metadata = {
  title: 'Metrics reference — Sightline docs',
  description:
    'The six quality metrics Sightline collects per peer and per room, their default alert thresholds, and how to override them.',
};

// Source: Docs.dc.html. This is an app shell, not a marketing page (task-10-brief.md,
// corrections 1-5): its own 60px header — never the shared SiteHeader — a fixed
// `264px | 1fr | 224px` three-column grid with independently scrolling panes, no SiteFooter,
// and zero animations: nothing in this route carries a data-anim attribute. DocsRail.tsx is the
// only client-side file in the route; DocsNav (the left nav) is static because its "active"
// item is a hardcoded flag ("the page you are on"), not client state.
export default function DocsPage() {
  return (
    <div className={`grid ${s.shell}`}>
      <DocsHeader />
      <div className={`min-h-0 ${s.columns}`}>
        <DocsNav />

        <main className={`sl-scroll min-w-0 ${s.main}`}>
          <div className={`flex flex-col gap-7 ${s.mainInner}`}>
            <nav className={`flex items-center gap-2 flex-wrap min-w-0 ${s.breadcrumb}`} aria-label="Breadcrumb">
              {CRUMBS.map((label, i) => (
                <Fragment key={label}>
                  {i > 0 && (
                    <svg
                      aria-hidden
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      className={`flex-none ${s.crumbChevron}`}
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  )}
                  <span className={i === CRUMBS.length - 1 ? `${s.crumb} ${s.crumbLast}` : s.crumb}>
                    {label}
                  </span>
                </Fragment>
              ))}
            </nav>

            <div className="flex flex-col gap-3.5">
              <h1 className={s.title}>Metrics reference</h1>
              <p className={s.lead}>
                Six measurements are collected in the media path, per peer and per room, and
                emitted on every stats interval. Each has a documented default threshold;
                crossing it for longer than the debounce window raises an alert.
              </p>
              <div className="flex items-center gap-2.5 flex-wrap">
                <Badge tone="neutral">Stats interval 2s</Badge>
                <Badge tone="neutral">Debounce 30s</Badge>
                <Badge tone="secondary">Read from RTCP</Badge>
              </div>
            </div>

            <ThresholdsTable />

            {METRICS.map((metric) => (
              <MetricSection key={metric.field} metric={metric} />
            ))}

            <Overrides />

            {/*
              An AlertBanner citing "apps/sfu/src · reviewed 27 Aug 2026" and asserting these
              metrics were "documented in the README and implemented in the metrics collector"
              stood here (ported verbatim from Docs.dc.html:131-133). It was false: the six
              fields in content/metrics.ts appear nowhere in apps/sfu/src, README.md:65 classes
              them "Planned — next milestone", and no review of that path happened on the date
              claimed. See commits 2890a3e and 56cc985 for the same class of error. Removed —
              do not port it back. Whether to add a "planned" caveat instead is a positioning
              call for the repository's owner, not something to invent here.
            */}

            <div className={`flex items-center gap-4 flex-wrap pt-2 ${s.pagination}`}>
              <a href="#" className={`flex flex-col gap-1 flex-1 min-w-[200px] py-3.5 px-4 no-underline ${s.pagerLink}`}>
                <span className="sl-label">Previous</span>
                <span className={s.pagerLabel}>Peers and tracks</span>
              </a>
              <a
                href="#"
                className={`flex flex-col gap-1 flex-1 min-w-[200px] py-3.5 px-4 no-underline text-right ${s.pagerLink}`}
              >
                <span className="sl-label">Next</span>
                <span className={s.pagerLabel}>Alerting and webhooks</span>
              </a>
            </div>
          </div>
        </main>

        <DocsRail />
      </div>
    </div>
  );
}
