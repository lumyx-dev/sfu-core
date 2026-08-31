import Link from 'next/link';
import { Button } from '@lumyx/ui';
import s from './FinalCta.module.css';

// Source: Home.dc.html:335-343. The second button is `variant="ghost"` in the source; @lumyx/ui
// only exposes 'primary' | 'secondary' | 'quiet' | 'danger' | 'accentQuiet' (no 'ghost'). `quiet`
// is the closest semantic match — a design-system vocabulary gap, flagged in task-7-report.md,
// same class as the missing 'danger' chart tone found in an earlier task. Not fixed here;
// packages/ui is out of scope for this task.
export function FinalCta() {
  return (
    <section style={{ borderTop: '1px solid var(--border-subtle)' }}>
      <div className={s.layout}>
        <h2 data-anim="rise" className={s.headline}>
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
