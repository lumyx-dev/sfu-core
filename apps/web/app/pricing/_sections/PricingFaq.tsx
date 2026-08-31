import { FAQ } from '@/content/pricing';
import s from './PricingFaq.module.css';

// Source: Pricing.dc.html:160-176. The eight FAQ entries render as plain always-visible
// question/answer pairs in a two-column grid — the source has no <details>/<summary> accordion
// anywhere in this section, contrary to task-8-brief.md's Step 4 (a ninth brief-vs-source
// divergence beyond the eight already called out; see task-8-report.md). No state either way,
// so this stays a Server Component.
export function PricingFaq() {
  return (
    <section className={s.section}>
      <div className={s.layout}>
        <div className={s.rail}>
          <span className="sl-num" style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            02
          </span>
          <span className="sl-label">Questions</span>
        </div>

        <div className={s.grid}>
          {FAQ.map((entry) => (
            <div key={entry.q} className={s.item}>
              <span className={s.question}>{entry.q}</span>
              <span className={s.answer}>{entry.a}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
