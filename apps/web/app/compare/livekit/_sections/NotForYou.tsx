import { NOT_FOR_YOU } from '@/content/compare';
import s from './NotForYou.module.css';

// Source: Compare LiveKit.dc.html:171-190 — "Cases where LiveKit is still the better call."
// task-9-brief.md is explicit that this section must not be softened: all four NOT_FOR_YOU
// entries are ported verbatim from content/compare.ts with no trimming or hedging.
export function NotForYou() {
  return (
    <section className={s.section}>
      <div className={s.layout}>
        <div className={s.rail}>
          <span className="sl-num" style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            04
          </span>
          <span className="sl-label">When not to switch</span>
        </div>

        <div className={s.body}>
          <h2 className={s.headline}>Cases where LiveKit is still the better call.</h2>
          <div className={s.list}>
            {NOT_FOR_YOU.map((item) => (
              <div key={item.title} className={s.item}>
                <span className={s.itemTitle}>{item.title}</span>
                <span className={s.itemBody}>{item.body}</span>
              </div>
            ))}
          </div>
          <p className={s.footnote}>
            Sightline is younger and smaller. Saying so here costs nothing and saves you a
            migration you would have reverted.
          </p>
        </div>
      </div>
    </section>
  );
}
