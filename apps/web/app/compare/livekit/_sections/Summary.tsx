import { HairlineGrid } from '@/components/marketing/HairlineGrid';
import { SUMMARY } from '@/content/compare';

// Source: Compare LiveKit.dc.html:70-80 — same border-top/layout shape as Pricing's
// PlanSwitcher (a plain flex-column max-width container, no 180px rail): three numbered blocks
// in a 3-column hairline grid. The 3-column hairline effect itself is HairlineGrid.
export function Summary() {
  return (
    <section className="border-t border-border">
      <div className="max-w-[1280px] mx-auto py-14 px-5 sm:px-10">
        <HairlineGrid columns={3}>
          {SUMMARY.map((item) => (
            <div
              key={item.index}
              data-anim="rise"
              data-anim-delay={item.delay}
              className="bg-card p-[26px] flex flex-col gap-3"
            >
              <span className="sl-num text-12 text-faint">{item.index}</span>
              <h2 className="m-0 text-20 font-semibold text-strong [text-wrap:pretty]">
                {item.title}
              </h2>
              <p className="m-0 text-13 leading-body text-muted [text-wrap:pretty]">
                {item.body}
              </p>
            </div>
          ))}
        </HairlineGrid>
      </div>
    </section>
  );
}
