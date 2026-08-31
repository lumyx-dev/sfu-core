import { FAQ } from '@/content/pricing';

// Source: Pricing.dc.html:160-176. The eight FAQ entries render as plain always-visible
// question/answer pairs in a two-column grid — the source has no <details>/<summary> accordion
// anywhere in this section, contrary to task-8-brief.md's Step 4 (a ninth brief-vs-source
// divergence beyond the eight already called out; see task-8-report.md). No state either way,
// so this stays a Server Component.
//
// Same 180px-rail shape as ComparisonTable.tsx (task-8-brief.md correction 7), but this rail
// carries no paragraph, unlike the table's.
export function PricingFaq() {
  return (
    <section className="border-t border-border">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 items-start max-w-[1280px] mx-auto px-5 py-14 sm:px-10 min-[900px]:grid-cols-[180px_minmax(0,1fr)] min-[900px]:gap-10 min-[900px]:py-16">
        <div className="flex flex-col gap-2 min-[900px]:sticky min-[900px]:top-8">
          <span className="sl-num text-[12px] text-faint">02</span>
          <span className="sl-label">Questions</span>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-7">
          {FAQ.map((entry) => (
            <div key={entry.q} className="border-t border-border pt-4 flex flex-col gap-2">
              <span className="text-[13.5px] font-semibold text-strong [text-wrap:pretty]">
                {entry.q}
              </span>
              <span className="text-[12.5px] leading-body text-muted [text-wrap:pretty]">
                {entry.a}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
