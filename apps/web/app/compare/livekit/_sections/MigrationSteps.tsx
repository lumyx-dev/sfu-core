import { Badge } from '@sightline/ui';
import { STEPS } from '@/content/compare';
import s from './MigrationSteps.module.css';

// Diff-line colour per the task's global constraints: `-` reads as --danger, `+` as --ok, the
// rest as --text-muted (see the comment above .line in MigrationSteps.module.css for why this
// diverges from the source's own flat colouring).
function lineClass(line: string): string {
  if (line.startsWith('-')) return s.lineRemoved;
  if (line.startsWith('+')) return s.lineAdded;
  return s.lineNeutral;
}

// Source: Compare LiveKit.dc.html:137-169 — `<div class="theme-dark" id="migrate">` (task-9-brief
// correction 5) wrapping the third sticky-rail section (rail index "03" / label "Migration", not
// itself sticky — see the module.css comment). Three step cards, diffs rendered in Geist, and a
// "Compatible" badge bar.
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
                      <span key={i} className={`${s.line} ${lineClass(line)}`}>
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
