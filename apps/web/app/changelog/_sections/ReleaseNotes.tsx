import { Badge, Button, SeverityBadge } from '@lumyx/ui';
import { GITHUB_URL } from '@/content/nav';
import { RELEASES } from '@/content/releases';

// Source: Changelog.dc.html:62-121. Entirely static — RELEASES is fixed content, not fetched —
// and carries zero motion attributes (task-11-brief.md correction 1: `grep -c data-anim`
// returns 0 on the source). The nav's date column strips the year (`r.date.replace(/
// \d{4}$/, '')` in the source's own `renderVals()`), a behaviour the brief never mentions;
// the article body keeps the full date. The `150px minmax(0,1fr)` rail (task-11-brief.md
// correction 4) is narrower than the 180px used everywhere else on the site — kept exact
// rather than rounded up. No responsive behaviour exists in the source (a fixed-width mockup),
// so the breakpoint below follows the same custom-pixel-breakpoint convention as those other
// rails, at the same 900px threshold, collapsing to a single column with the nav no longer
// sticky.
export function ReleaseNotes() {
  return (
    <section className="border-t border-border">
      <div className="grid grid-cols-1 gap-9 items-start max-w-[1080px] mx-auto pt-12 px-5 pb-20 sm:px-10 min-[900px]:grid-cols-[150px_minmax(0,1fr)]">
        {/* Nav rail — Changelog.dc.html:65-73. Sticky only once it sits beside the content, same
            as Pains's rail. */}
        <nav className="flex flex-col gap-0.5 min-[900px]:sticky min-[900px]:top-8">
          <span className="sl-label pb-2">Releases</span>
          {RELEASES.map((r) => (
            <a
              key={r.version}
              href={`#${r.version}`}
              className="flex items-baseline gap-2 py-1.5 text-[12.5px] no-underline"
              style={{ color: r.latest ? 'var(--text-strong)' : 'var(--text-muted)' }}
            >
              <span className="sl-num font-medium">{r.version}</span>
              <span className="sl-num text-[11.5px] text-faint">
                {r.date.replace(/ \d{4}$/, '')}
              </span>
            </a>
          ))}
        </nav>

        {/* Right column — Changelog.dc.html:75-119. */}
        <div className="flex flex-col gap-10 min-w-0">
          {RELEASES.map((r) => (
            <article
              key={r.version}
              id={r.version}
              className="flex flex-col gap-4 pb-9 border-b border-border scroll-mt-8"
            >
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="sl-num m-0 text-[26px] font-semibold tracking-[-0.02em] text-strong">
                  {r.version}
                </h2>
                {r.latest && <Badge tone="accent">Latest</Badge>}
                <span className="flex-1" />
                <span className="sl-num text-[12.5px] text-muted">{r.date}</span>
                <a href="#" className="sl-num text-12 text-faint no-underline">
                  {r.commit}
                </a>
              </div>

              <p className="m-0 text-14 leading-body text-body max-w-[660px] [text-wrap:pretty]">
                {r.summary}
              </p>

              {r.hasBreaking && r.breaking && (
                // Breaking-change callout — Changelog.dc.html:90-95. The source references
                // var(--danger-border), which the design system never defines (tokens.css has
                // --danger/--danger-tint/--danger-solid, and a parallel --accent-border, but no
                // --danger-border) — an undefined custom property would make the whole `border`
                // shorthand invalid. var(--danger) is the 600-ink step meant for small text;
                // used as a 1px border on a tinted panel it reads heavier than intended, so this
                // derives the soft weight the missing token would have carried instead, the same
                // color-mix technique already used for --spotlight-tint in app/globals.css.
                // Token-derived, so it still follows .theme-dark.
                <div className="flex items-start gap-3 py-[13px] px-4 border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] rounded-tile bg-danger-tint">
                  <SeverityBadge severity="critical" label="Breaking" />
                  <span className="text-[12.5px] leading-body text-body [text-wrap:pretty]">
                    {r.breaking}
                  </span>
                </div>
              )}

              <div className="flex flex-col gap-3.5">
                {r.groups.map((g) => (
                  <div key={g.kind} className="grid grid-cols-[96px_minmax(0,1fr)] gap-4 items-start">
                    <span className="flex pt-0.5">
                      <Badge tone={g.tone}>{g.kind}</Badge>
                    </span>
                    <div className="flex flex-col gap-2 min-w-0">
                      {g.items.map((item) => (
                        <span key={item} className="text-13 leading-body text-body [text-wrap:pretty]">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}

          {/* "Older releases" card — Changelog.dc.html:114-118. */}
          <div className="flex items-center gap-3.5 flex-wrap py-[18px] px-5 border border-border rounded-card bg-card">
            <span className="text-13 text-body [text-wrap:pretty]">
              Older releases live in the repository, with their diffs.
            </span>
            <span className="flex-1" />
            <a href={`${GITHUB_URL}/releases`} target="_blank" rel="noreferrer">
              <Button size="sm">See all releases on GitHub</Button>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
