import Link from 'next/link';
import { Button } from '@lumyx/ui';
import { PLAN_COLUMNS, HIGHLIGHT, PRICING_GROUPS } from '@/content/pricing';

// Source: Pricing.dc.html:122-155 — six columns (Capability + PLAN_COLUMNS), unaffected by the
// monthly/annual period, so this stays a plain Server Component. The em dash test below is the
// literal U+2014 character content/pricing.ts uses for "not included" (task-8-brief.md
// correction 6), not a hyphen.
//
// Six columns cannot collapse at any width, so the grid lives inside its own
// horizontally-scrolling wrapper with a floor width (this task's own choice, not in the source,
// which has no responsive behaviour at all) and the Capability column is pinned with
// `position: sticky; left: 0` on an opaque background — the body itself must never gain a
// horizontal scrollbar.
const gridCols = 'grid grid-cols-[minmax(0,1.35fr)_repeat(5,minmax(0,1fr))] min-w-[900px]';

export function ComparisonTable() {
  return (
    <section className="border-t border-border bg-card">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 items-start max-w-[1280px] mx-auto px-5 py-14 sm:px-10 min-[900px]:grid-cols-[180px_minmax(0,1fr)] min-[900px]:gap-10 min-[900px]:py-16">
        <div className="flex flex-col gap-2 min-w-0 min-[900px]:sticky min-[900px]:top-8">
          <span className="sl-num text-[12px] text-faint">01</span>
          <span className="sl-label">Everything included</span>
          <p className="mt-1.5 text-[12.5px] leading-body text-muted [text-wrap:pretty]">
            Every limit, in one table. Nothing is hidden behind a sales call.
          </p>
        </div>

        <div className="border border-border rounded-card bg-page min-w-0">
          {/* Nested 1px inside the box's border, so its own top corners are the box radius minus
              the border width — Pricing.dc.html:126 does the same thing with a literal
              `17px 17px 0 0`. */}
          <div className="overflow-x-auto rounded-t-[calc(var(--radius-card)-1px)]">
            <div
              className={`${gridCols} bg-sunken border-b border-border-subtle rounded-t-[calc(var(--radius-card)-1px)] sticky top-0 z-2`}
            >
              <span className="sl-label px-4.5 py-3.5 sticky left-0 z-1 bg-sunken rounded-tl-[calc(var(--radius-card)-1px)]">
                Capability
              </span>
              {PLAN_COLUMNS.map((name, i) => (
                <span
                  key={name}
                  className={`sl-label px-3 py-3.5 ${i === HIGHLIGHT ? 'text-accent-text' : 'text-faint'}`}
                >
                  {name}
                </span>
              ))}
            </div>

            {PRICING_GROUPS.map((group) => (
              <div key={group.title}>
                <div className="px-5 py-3 bg-sunken border-b border-border-subtle min-w-[900px]">
                  <span className="sl-label">{group.title}</span>
                </div>
                {group.rows.map((row) => (
                  <div key={row.label} className={`${gridCols} border-b border-border-subtle`}>
                    <span className="px-4.5 py-3.5 text-13 text-body sticky left-0 z-1 bg-page">
                      {row.label}
                    </span>
                    {row.v.map((value, i) => (
                      <span
                        key={i}
                        className={`sl-num px-3 py-3.5 text-[12.5px] ${
                          i === HIGHLIGHT
                            ? 'text-strong bg-accent-tint'
                            : value === '—'
                              ? 'text-faint'
                              : 'text-muted'
                        }`}
                      >
                        {value}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-4 flex-wrap px-5 py-4.5">
            <span className="text-[12.5px] text-muted [text-wrap:pretty]">
              Self-hosted has no metering: the limits are your hardware and your storage.
            </span>
            <span className="flex-1" />
            <Link href="/signup">
              <Button variant="primary">Get started free</Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
