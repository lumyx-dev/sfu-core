import { GROUPS } from '@/content/compare';
import s from './CompareTable.module.css';

// Source: Compare LiveKit.dc.html:82-114 — rail index "01" / label "Side by side", and the
// Dimension / Sightline / LiveKit comparison table with a sticky header (task-9-brief.md
// corrections 4 and 6).
export function CompareTable() {
  return (
    <section className={s.section}>
      <div className={s.layout}>
        <div className={s.rail}>
          <span className="sl-num" style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            01
          </span>
          <span className="sl-label">Side by side</span>
          <p className={s.railNote}>
            Architectural defaults, not feature counts. Both projects ship far more than this
            table.
          </p>
        </div>

        <div className={s.tableBox}>
          <div className={s.scrollWrap}>
            <div className={s.headerRow}>
              <span className={`sl-label ${s.headDimension}`}>Dimension</span>
              <span
                className={`sl-label ${s.headPlan}`}
                style={{ color: 'var(--accent-text)' }}
              >
                Sightline
              </span>
              <span className={`sl-label ${s.headPlan}`}>LiveKit</span>
            </div>

            {GROUPS.map((group) => (
              <div key={group.title}>
                <div className={s.groupTitle}>
                  <span className="sl-label">{group.title}</span>
                </div>
                {group.rows.map((row) => (
                  <div key={row.label} className={s.dataRow}>
                    <span className={s.labelCell}>{row.label}</span>
                    <span className={s.oursCell}>{row.ours}</span>
                    <span className={s.theirsCell}>{row.theirs}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className={s.footerBar}>
            <span className={s.footerNote}>
              Open an issue if a row is out of date and it gets fixed.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
