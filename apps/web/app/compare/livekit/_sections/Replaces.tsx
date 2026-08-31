import { HairlineGrid } from '@/components/marketing/HairlineGrid';
import { REPLACES } from '@/content/compare';

// Source: Compare LiveKit.dc.html:116-135 — the second `180px minmax(0,1fr)` sticky-rail
// section (task-9-brief.md correction 4): rail index "02" / label "What you stop building", no
// rail note this time, an h2, and a 2-column hairline grid of REPLACES cells.
export function Replaces() {
  return (
    <section className="border-t border-border">
      <div className="grid grid-cols-1 gap-8 items-start max-w-[1280px] mx-auto py-14 px-5 sm:px-10 min-[900px]:grid-cols-[180px_minmax(0,1fr)] min-[900px]:gap-10 min-[900px]:py-[72px]">
        <div className="flex flex-col gap-2 min-w-0 min-[900px]:sticky min-[900px]:top-8">
          <span className="sl-num text-12 text-faint">02</span>
          <span className="sl-label">What you stop building</span>
        </div>

        <div className="flex flex-col gap-6 min-w-0">
          <h2
            data-anim="rise"
            className="m-0 text-[26px] font-semibold tracking-[-0.03em] leading-[1.1] text-strong max-w-[700px] [text-wrap:pretty] sm:text-[38px]"
          >
            The observability layer you were about to write yourself.
          </h2>
          <div data-anim="rise">
            <HairlineGrid columns={2}>
              {REPLACES.map((item) => (
                <div key={item.before} className="bg-card py-5 px-[22px] flex flex-col gap-2">
                  <span className="sl-num text-12 text-faint">{item.before}</span>
                  <span className="text-[13.5px] font-semibold text-strong [text-wrap:pretty]">
                    {item.after}
                  </span>
                  <span className="text-[12.5px] leading-body text-muted [text-wrap:pretty]">
                    {item.body}
                  </span>
                </div>
              ))}
            </HairlineGrid>
          </div>
        </div>
      </div>
    </section>
  );
}
