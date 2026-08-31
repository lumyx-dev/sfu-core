import { Badge } from '@lumyx/ui';
import { STEPS } from '@/content/compare';

// Source: Compare LiveKit.dc.html:137-169 — `<div class="theme-dark" id="migrate">` (task-9-brief
// correction 5) wrapping the third sticky-rail section (rail index "03" / label "Migration", but
// this rail is NOT sticky — line 139 of the source omits `position:sticky;top:32px` unlike the
// other three, a further divergence from the brief's correction). Three step cards, diffs
// rendered in Geist, and a "Compatible" badge bar. Every line in `st.lines` renders identically
// in the source (Compare LiveKit.dc.html:153-155 — flat var(--text-body), no colour keyed off
// the `-`/`+` prefix); an earlier pass here added per-line danger/ok colouring on the strength of
// a brief instruction that turned out to be the brief author's own invention, not the design's,
// and it also broke the design system's rule that colour always signals a crossed threshold,
// never decoration. Reverted — see task-9-report.md.
export function MigrationSteps() {
  return (
    <div
      className="theme-dark"
      id="migrate"
      style={{ background: 'var(--surface-page)', color: 'var(--text-body)' }}
    >
      <section className="border-t border-border">
        <div className="grid grid-cols-1 gap-8 items-start max-w-[1280px] mx-auto py-14 px-5 sm:px-10 min-[900px]:grid-cols-[180px_minmax(0,1fr)] min-[900px]:gap-10 min-[900px]:py-[72px]">
          <div className="flex flex-col gap-2 min-w-0">
            <span className="sl-num text-12 text-faint">03</span>
            <span className="sl-label">Migration</span>
          </div>

          <div className="flex flex-col gap-6 min-w-0">
            <h2
              data-anim="rise"
              className="m-0 text-[26px] font-semibold tracking-[-0.03em] leading-[1.1] text-strong max-w-[660px] [text-wrap:pretty] sm:text-[38px]"
            >
              Three steps, and your client code never opens.
            </h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {STEPS.map((step) => (
                <div
                  key={step.n}
                  data-anim="rise"
                  data-anim-delay={step.delay}
                  className="border border-border rounded-card bg-card overflow-hidden flex flex-col"
                >
                  <div className="flex items-center gap-2.5 py-[14px] px-[18px] border-b border-border-subtle">
                    <span className="sl-num text-12 text-accent-text">{step.n}</span>
                    <span className="text-13 font-semibold text-strong">{step.title}</span>
                  </div>
                  <div className="py-4 px-[18px] flex flex-col gap-1.5 flex-1">
                    {step.lines.map((line, i) => (
                      <span key={i} className="text-[12.5px] leading-body text-body whitespace-pre-wrap">
                        {line}
                      </span>
                    ))}
                  </div>
                  <div className="py-3 px-[18px] border-t border-border-subtle bg-sunken">
                    <span className="text-12 leading-[1.55] text-muted [text-wrap:pretty]">
                      {step.note}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3.5 flex-wrap py-4 px-5 border border-border rounded-card bg-card">
              <Badge tone="ok">Compatible</Badge>
              <span className="text-[12.5px] text-body [text-wrap:pretty]">
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
