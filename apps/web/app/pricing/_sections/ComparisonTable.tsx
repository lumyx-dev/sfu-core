import Link from 'next/link';
import { Button } from '@sightline/ui';
import { PLAN_COLUMNS, HIGHLIGHT, PRICING_GROUPS } from '@/content/pricing';
import s from './ComparisonTable.module.css';

// Source: Pricing.dc.html:122-155 — six columns (Capability + PLAN_COLUMNS), unaffected by the
// monthly/annual period, so this stays a plain Server Component. The em dash test below is the
// literal U+2014 character content/pricing.ts uses for "not included" (task-8-brief.md
// correction 6), not a hyphen.
export function ComparisonTable() {
  return (
    <section className={s.section}>
      <div className={s.layout}>
        <div className={s.rail}>
          <span className="sl-num" style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            01
          </span>
          <span className="sl-label">Everything included</span>
          <p className={s.railNote}>
            Every limit, in one table. Nothing is hidden behind a sales call.
          </p>
        </div>

        <div className={s.tableBox}>
          <div className={s.scrollWrap}>
            <div className={s.headerRow}>
              <span className={`sl-label ${s.capabilityHead}`}>Capability</span>
              {PLAN_COLUMNS.map((name, i) => (
                <span
                  key={name}
                  className={`sl-label ${s.planCell}`}
                  style={{ color: i === HIGHLIGHT ? 'var(--accent-text)' : 'var(--text-faint)' }}
                >
                  {name}
                </span>
              ))}
            </div>

            {PRICING_GROUPS.map((group) => (
              <div key={group.title}>
                <div className={s.groupTitle}>
                  <span className="sl-label">{group.title}</span>
                </div>
                {group.rows.map((row) => (
                  <div key={row.label} className={s.dataRow}>
                    <span className={s.labelCell}>{row.label}</span>
                    {row.v.map((value, i) => (
                      <span
                        key={i}
                        className={`sl-num ${s.valueCell}`}
                        style={{
                          color:
                            i === HIGHLIGHT
                              ? 'var(--text-strong)'
                              : value === '—'
                                ? 'var(--text-faint)'
                                : 'var(--text-muted)',
                          background: i === HIGHLIGHT ? 'var(--accent-tint)' : 'transparent',
                        }}
                      >
                        {value}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className={s.footerBar}>
            <span className={s.footerNote}>
              Self-hosted has no metering: the limits are your hardware and your storage.
            </span>
            <span style={{ flex: 1 }} />
            <Link href="/signup">
              <Button variant="primary">Get started free</Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
