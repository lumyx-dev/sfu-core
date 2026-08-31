import { HairlineGrid } from '@/components/marketing/HairlineGrid';
import { SUMMARY } from '@/content/compare';
import s from './Summary.module.css';

// Source: Compare LiveKit.dc.html:70-80 — three numbered blocks in a 3-column hairline grid.
export function Summary() {
  return (
    <section className={s.section}>
      <div className={s.layout}>
        <HairlineGrid columns={3}>
          {SUMMARY.map((item) => (
            <div
              key={item.index}
              data-anim="rise"
              data-anim-delay={item.delay}
              className={s.cell}
            >
              <span className="sl-num" style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                {item.index}
              </span>
              <h2 className={s.title}>{item.title}</h2>
              <p className={s.body}>{item.body}</p>
            </div>
          ))}
        </HairlineGrid>
      </div>
    </section>
  );
}
