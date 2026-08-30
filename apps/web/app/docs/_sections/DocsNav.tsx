import { DOC_SECTIONS } from '@/content/metrics';
import s from './DocsNav.module.css';

// Source: Docs.dc.html:52-60 (grouped sections) and its script's own top-level `DOC_NAV`
// constant. The active item is a static flag hardcoded in content/metrics.ts — "the page you
// are on" — so this whole nav is a Server Component with no client state
// (task-10-brief.md correction 6). Every id but 'thresholds' is a placeholder anchor: those
// other doc pages are not built by this task.
export function DocsNav() {
  return (
    <nav className={`sl-scroll ${s.nav}`}>
      {DOC_SECTIONS.map((section) => (
        <div key={section.title} className={s.group}>
          <span className={`sl-label ${s.groupTitle}`}>{section.title}</span>
          {section.items.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={s.item}
              data-active={item.active ? '1' : undefined}
            >
              {item.label}
            </a>
          ))}
        </div>
      ))}
    </nav>
  );
}
