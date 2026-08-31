import { HairlineGrid } from '@/components/marketing/HairlineGrid';
import { REPLACES } from '@/content/compare';
import s from './Replaces.module.css';

// Source: Compare LiveKit.dc.html:116-135 — rail index "02" / label "What you stop building",
// an h2, and a 2-column hairline grid of the six REPLACES cells.
export function Replaces() {
  return (
    <section className={s.section}>
      <div className={s.layout}>
        <div className={s.rail}>
          <span className="sl-num" style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            02
          </span>
          <span className="sl-label">What you stop building</span>
        </div>

        <div className={s.body}>
          <h2 data-anim="rise" className={s.headline}>
            The observability layer you were about to write yourself.
          </h2>
          <div data-anim="rise">
            <HairlineGrid columns={2}>
              {REPLACES.map((item) => (
                <div key={item.before} className={s.cell}>
                  <span className="sl-num" style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                    {item.before}
                  </span>
                  <span className={s.after}>{item.after}</span>
                  <span className={s.cellBody}>{item.body}</span>
                </div>
              ))}
            </HairlineGrid>
          </div>
        </div>
      </div>
    </section>
  );
}
