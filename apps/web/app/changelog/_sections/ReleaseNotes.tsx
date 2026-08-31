import { Badge, Button, SeverityBadge } from '@lumyx/ui';
import { GITHUB_URL } from '@/content/nav';
import { RELEASES } from '@/content/releases';
import s from './ReleaseNotes.module.css';

// Source: Changelog.dc.html:62-121. Entirely static — RELEASES is fixed content, not fetched —
// and carries zero motion attributes (task-11-brief.md correction 1: `grep -c data-anim`
// returns 0 on the source). The nav's date column strips the year (`r.date.replace(/
// \d{4}$/, '')` in the source's own `renderVals()`), a behaviour the brief never mentions;
// the article body keeps the full date.
export function ReleaseNotes() {
  return (
    <section className={s.section}>
      <div className={s.layout}>
        <nav className={s.nav}>
          <span className={`sl-label ${s.navLabel}`}>Releases</span>
          {RELEASES.map((r) => (
            <a
              key={r.version}
              href={`#${r.version}`}
              className={s.navLink}
              style={{ color: r.latest ? 'var(--text-strong)' : 'var(--text-muted)' }}
            >
              <span className={`sl-num ${s.navVersion}`}>{r.version}</span>
              <span className={`sl-num ${s.navDate}`}>{r.date.replace(/ \d{4}$/, '')}</span>
            </a>
          ))}
        </nav>

        <div className={s.list}>
          {RELEASES.map((r) => (
            <article key={r.version} id={r.version} className={s.article}>
              <div className={s.articleHead}>
                <h2 className={`sl-num ${s.version}`}>{r.version}</h2>
                {r.latest && <Badge tone="accent">Latest</Badge>}
                <span className="flex-1" />
                <span className={`sl-num ${s.meta}`}>{r.date}</span>
                <a href="#" className={`sl-num ${s.commit}`}>
                  {r.commit}
                </a>
              </div>

              <p className={s.summary}>{r.summary}</p>

              {r.hasBreaking && r.breaking && (
                <div className={s.breaking}>
                  <SeverityBadge severity="critical" label="Breaking" />
                  <span className={s.breakingText}>{r.breaking}</span>
                </div>
              )}

              <div className={s.groups}>
                {r.groups.map((g) => (
                  <div key={g.kind} className={s.group}>
                    <span className={s.groupBadge}>
                      <Badge tone={g.tone}>{g.kind}</Badge>
                    </span>
                    <div className={s.groupItems}>
                      {g.items.map((item) => (
                        <span key={item} className={s.groupItem}>
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}

          <div className={s.olderCard}>
            <span className={s.olderText}>Older releases live in the repository, with their diffs.</span>
            <span className="flex-1" />
            <a href={`${GITHUB_URL}/releases`} target="_blank" rel="noreferrer">
              <Button size="sm">See all releases on GitHub</Button>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
