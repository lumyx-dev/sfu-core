import { GROUPS } from '@/content/compare';

// Source: Compare LiveKit.dc.html:82-114 — rail index "01" / label "Side by side", and the
// Dimension / Sightline / LiveKit comparison table with a sticky header (task-9-brief.md
// corrections 4 and 6). First of four `180px minmax(0,1fr)` sticky-rail sections on this page.
// Same shape as Pricing's ComparisonTable, three columns instead of six; the header row's top
// corners use `calc(var(--radius-card)-1px)` in place of the source's literal `17px 17px 0 0`
// (task-9-brief.md correction 6 — the convention Pricing's ComparisonTable already established).
const GRID_COLS = 'grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] min-w-[640px]';

export function CompareTable() {
  return (
    <section className="bg-card border-t border-border">
      <div className="grid grid-cols-1 gap-8 items-start max-w-[1280px] mx-auto py-14 px-5 sm:px-10 min-[900px]:grid-cols-[180px_minmax(0,1fr)] min-[900px]:gap-10 min-[900px]:py-[72px]">
        <div className="flex flex-col gap-2 min-w-0 min-[900px]:sticky min-[900px]:top-8">
          <span className="sl-num text-12 text-faint">01</span>
          <span className="sl-label">Side by side</span>
          <p className="mt-1.5 mb-0 text-[12.5px] leading-body text-muted [text-wrap:pretty]">
            Architectural defaults, not feature counts. Both projects ship far more than this
            table.
          </p>
        </div>

        <div className="border border-border rounded-card bg-page min-w-0">
          <div className="overflow-x-auto rounded-t-[calc(var(--radius-card)-1px)]">
            <div
              className={`${GRID_COLS} bg-sunken border-b border-border-subtle rounded-t-[calc(var(--radius-card)-1px)] sticky top-0 z-[2]`}
            >
              <span className="sl-label py-[14px] px-5">Dimension</span>
              <span className="sl-label py-[14px] px-[18px] text-accent-text">Sightline</span>
              <span className="sl-label py-[14px] px-[18px]">LiveKit</span>
            </div>

            {GROUPS.map((group) => (
              <div key={group.title}>
                <div className="py-3 px-5 bg-sunken border-b border-border-subtle min-w-[640px]">
                  <span className="sl-label">{group.title}</span>
                </div>
                {group.rows.map((row) => (
                  <div key={row.label} className={`${GRID_COLS} border-b border-border-subtle`}>
                    <span className="py-[14px] px-5 text-13 font-medium text-strong">
                      {row.label}
                    </span>
                    <span className="py-[14px] px-[18px] text-[12.5px] leading-[1.55] text-body bg-accent-tint [text-wrap:pretty]">
                      {row.ours}
                    </span>
                    <span className="py-[14px] px-[18px] text-[12.5px] leading-[1.55] text-muted [text-wrap:pretty]">
                      {row.theirs}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="py-[14px] px-5">
            <span className="text-12 text-faint [text-wrap:pretty]">
              Open an issue if a row is out of date and it gets fixed.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
