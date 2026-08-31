import { Badge } from '@lumyx/ui';
import { STEPS } from '@/content/compare';
import s from './MigrationSteps.module.css';

// Source: Compare LiveKit.dc.html:137-169 — `<div class="theme-dark" id="migrate">` (task-9-brief
// correction 5) wrapping the third sticky-rail section (rail index "03" / label "Migration", not
// itself sticky — see the module.css comment). Three step cards, diffs rendered in Geist, and a
// "Compatible" badge bar. Every line in `st.lines` renders identically in the source
// (Compare LiveKit.dc.html:153-155 — flat var(--text-body), no colour keyed off the `-`/`+`
// prefix); an earlier pass here added per-line danger/ok colouring on the strength of a brief
// instruction that turned out to be the brief author's own invention, not the design's, and it
// also broke the design system's rule that colour always signals a crossed threshold, never
// decoration. Reverted — see task-9-report.md.
export function MigrationSteps() {
  return (
    <div
      className="theme-dark"
      id="migrate"
      style={{ background: 'var(--surface-page)', color: 'var(--text-body)' }}
    >
      <section className={s.section}>
        <div className={s.layout}>
          <div className={s.rail}>
            <span className="sl-num" style={{ fontSize: 12, color: 'var(--text-faint)' }}>
              03
            </span>
            <span className="sl-label">Migration</span>
          </div>

          <div className={s.body}>
            <h2 data-anim="rise" className={s.headline}>
              Three steps, and your client code never opens.
            </h2>

            <div className={s.steps}>
              {STEPS.map((step) => (
                <div key={step.n} data-anim="rise" data-anim-delay={step.delay} className={s.card}>
                  <div className={s.cardHead}>
                    <span className="sl-num" style={{ fontSize: 12, color: 'var(--accent-text)' }}>
                      {step.n}
                    </span>
                    <span className={s.cardTitle}>{step.title}</span>
                  </div>
                  <div className={s.cardLines}>
                    {step.lines.map((line, i) => (
                      <span key={i} className={s.line}>
                        {line}
                      </span>
                    ))}
                  </div>
                  <div className={s.cardNote}>
                    <span className={s.cardNoteText}>{step.note}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className={s.compatBar}>
              <Badge tone="ok">Compatible</Badge>
              <span className={s.compatText}>
                Signaling message names, token grants and the room/participant model are drop-in.
                Recording, egress pipelines and agent frameworks are not — check the docs before
                you move a workload that uses them.
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
