import { GITHUB_URL } from '@/content/nav';

// Source: Home.dc.html:315-333. There is no BENCHMARKS display here — an earlier draft of the
// task brief said this section shows three benchmark metrics; the source shows three
// shields.io status badges and a paragraph instead. BENCHMARKS (content/benchmarks.ts) is
// rendered inside Pains.tsx, not here — see task-7-report.md.
//
// Source: Home.dc.html:315-333 — the first <section> inside the second .theme-dark wrapper
// (which also holds FinalCta and the footer; that wrapper is applied at page composition, in
// app/page.tsx, since it spans three separate components). Not sticky, unlike #why/#pricing.
export function OpenSource() {
  return (
    <section className="grid grid-cols-1 gap-10 items-start max-w-[1280px] mx-auto px-5 py-12 sm:px-10 min-[900px]:grid-cols-[180px_minmax(0,1fr)] min-[900px]:py-[72px]">
      <div className="flex flex-col gap-2">
        <span className="sl-num text-12 text-faint">04</span>
        <span className="sl-label">Open source</span>
      </div>

      <div className="flex items-center gap-10 flex-wrap min-w-0">
        <div className="flex flex-col gap-3.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* External status badges from shields.io, not content images — next/no-img-element
                doesn't apply the way it would to real content imagery. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://img.shields.io/badge/license-MIT-4f39f6?style=for-the-badge&labelColor=1f1f24"
              alt="MIT license"
              height={28}
              style={{ height: 28, display: 'block' }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://img.shields.io/github/last-commit/FrekiManagarm/sightline?style=for-the-badge&label=last%20commit&color=1f1f24&labelColor=1f1f24"
              alt="Last commit"
              height={28}
              style={{ height: 28, display: 'block' }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://img.shields.io/badge/rust-1.79%2B-1f1f24?style=for-the-badge&labelColor=1f1f24"
              alt="Rust 1.79+"
              height={28}
              style={{ height: 28, display: 'block' }}
            />
          </div>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="text-13 font-medium">
            Read the source · star the repo →
          </a>
        </div>
        <span style={{ flex: 1 }} />
        <p className="m-0 text-[14px] leading-[1.6] text-muted max-w-[440px] [text-wrap:pretty]">
          MIT licensed, developed in public. Issues, benchmarks and RFCs are the roadmap —
          there is no private fork of this code, and no feature held back for a paid tier.
        </p>
      </div>
    </section>
  );
}
