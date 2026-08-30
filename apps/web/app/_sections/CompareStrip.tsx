import Link from 'next/link';
import { COMPARE_ROWS } from '@/content/home';
import s from './CompareStrip.module.css';

// Source: Home.dc.html:214-243 — `<div class="theme-dark" id="compare">`. This block is dark,
// unlike the light `#why`/`#pricing` sections either side of it (a divergence the task brief
// never mentioned). Not sticky, unlike the `#why` and `#pricing` rails.
export function CompareStrip() {
  return (
    <div
      id="compare"
      className="theme-dark"
      style={{ background: 'var(--surface-page)', color: 'var(--text-body)', borderTop: '1px solid var(--border)' }}
    >
      <div className={s.layout}>
        <div className={s.rail}>
          <span className="sl-num" style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            02
          </span>
          <span className="sl-label">Coming from LiveKit</span>
        </div>

        <div className={s.content}>
          <div className={s.headerRow}>
            <h2 data-anim="rise" className={s.headline}>
              Same signaling. Different priorities.
            </h2>
            <span style={{ flex: 1 }} />
            <Link href="/compare/livekit" className={s.link}>
              See the full comparison →
            </Link>
          </div>

          <div className={s.tableScroll}>
            <div data-anim="rise" className={s.table}>
              <div className={s.headRow}>
                <span className={`sl-label ${s.headCell}`}>Architectural default</span>
                <span className={`sl-label ${s.headCell} ${s.headCellAccent}`}>Sightline</span>
                <span className={`sl-label ${s.headCell}`}>Typical Go SFU stack</span>
              </div>
              {COMPARE_ROWS.map((r) => (
                <div key={r.label} className={s.dataRow}>
                  <span className={s.labelCell}>{r.label}</span>
                  <span className={s.oursCell}>{r.sightline}</span>
                  <span className={s.theirsCell}>{r.other}</span>
                </div>
              ))}
              <div className={s.footnote}>
                <span className={s.footnoteText}>
                  Comparison of architectural defaults, not of feature counts. Corrections
                  welcome as a PR.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
