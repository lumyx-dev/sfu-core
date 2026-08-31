import Link from 'next/link';
import { Button } from '@lumyx/ui';

// Source: Home.dc.html:335-343. The second button is `variant="ghost"` in the source; @lumyx/ui
// only exposes 'primary' | 'secondary' | 'quiet' | 'danger' | 'accentQuiet' (no 'ghost'). `quiet`
// is the closest semantic match — a design-system vocabulary gap, flagged in task-7-report.md,
// same class as the missing 'danger' chart tone found in an earlier task. Not fixed here;
// packages/ui is out of scope for this task.
export function FinalCta() {
  return (
    <section className="border-t border-border-subtle">
      <div className="max-w-[1280px] mx-auto px-5 py-14 flex flex-col gap-[22px] items-start sm:px-10 md:py-[88px]">
        <h2
          data-anim="rise"
          className="m-0 text-[34px] font-semibold tracking-[-0.035em] leading-[1.05] text-strong max-w-[820px] [text-wrap:pretty] md:text-[52px]"
        >
          Next time video gets bad, you&rsquo;ll know which peer, which metric, and for how long.
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/signup">
            <Button variant="primary" size="lg">
              Get started free
            </Button>
          </Link>
          <Link href="/docs">
            <Button variant="quiet" size="lg">
              Read the docs
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
