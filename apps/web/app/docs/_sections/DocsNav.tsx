import { DOC_SECTIONS } from '@/content/metrics';
import s from './DocsNav.module.css';

// Source: Docs.dc.html:52-60 (grouped sections) and its script's own top-level `DOC_NAV`
// constant. The active item is a static flag hardcoded in content/metrics.ts — "the page you
// are on" — so this whole nav is a Server Component with no client state
// (task-10-brief.md correction 6). Every id but 'thresholds' is a placeholder anchor: those
// other doc pages are not built by this task.
export function DocsNav() {
  return (
    <nav className={`sl-scroll overflow-auto pt-6 px-4 pb-10 ${s.nav}`}>
      {DOC_SECTIONS.map((section) => (
        <div key={section.title} className="flex flex-col gap-0.5 mb-[22px]">
          <span className="sl-label px-2.5 pb-2">{section.title}</span>
          {section.items.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`flex items-center gap-2 py-[7px] px-2.5 no-underline ${s.item}`}
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
