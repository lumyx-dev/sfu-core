import { NOT_FOR_YOU } from '@/content/compare';

// Source: Compare LiveKit.dc.html:171-190 — the fourth `180px minmax(0,1fr)` sticky-rail
// section (task-9-brief.md correction 4): rail index "04" / label "When not to switch". This
// section carries the honesty list (task-9-brief.md's "must not be softened" NOT_FOR_YOU) —
// all four entries are ported verbatim from content/compare.ts with no trimming or hedging —
// and, unlike the two headings either side of it, its own h2 has no `data-anim` attribute at
// all in the source, a further divergence from the brief's correction 4 that isn't called out.
export function NotForYou() {
  return (
    <section className="border-t border-border bg-card">
      <div className="grid grid-cols-1 gap-8 items-start max-w-[1280px] mx-auto py-14 px-5 sm:px-10 min-[900px]:grid-cols-[180px_minmax(0,1fr)] min-[900px]:gap-10 min-[900px]:py-[72px]">
        <div className="flex flex-col gap-2 min-w-0 min-[900px]:sticky min-[900px]:top-8">
          <span className="sl-num text-12 text-faint">04</span>
          <span className="sl-label">When not to switch</span>
        </div>

        <div className="flex flex-col gap-[22px] min-w-0">
          <h2 className="m-0 text-2xl font-semibold tracking-[-0.03em] leading-[1.14] text-strong max-w-[660px] [text-wrap:pretty] sm:text-[32px]">
            Cases where LiveKit is still the better call.
          </h2>
          <div className="flex flex-col gap-4">
            {NOT_FOR_YOU.map((item) => (
              <div key={item.title} className="border-l-2 border-border-strong py-0.5 pl-[18px] flex flex-col gap-1.5">
                <span className="text-[13.5px] font-semibold text-strong [text-wrap:pretty]">
                  {item.title}
                </span>
                <span className="text-13 leading-body text-muted max-w-[720px] [text-wrap:pretty]">
                  {item.body}
                </span>
              </div>
            ))}
          </div>
          <p className="m-0 text-[12.5px] text-faint [text-wrap:pretty]">
            Sightline is younger and smaller. Saying so here costs nothing and saves you a
            migration you would have reverted.
          </p>
        </div>
      </div>
    </section>
  );
}
