'use client';

import { useEffect, useState } from 'react';
import { DOC_NAV } from '@/content/metrics';
import { GITHUB_URL } from '@/content/nav';

// Source: Docs.dc.html:148-159. The only client island in this route (task-10-brief.md
// correction 6) — everything else on the page, including the left nav, is static. Highlights
// the section currently in view via its own IntersectionObserver, independent of
// MarketingMotion, which this page never triggers: zero data-anim attributes anywhere here
// (correction 5).
export function DocsRail() {
  const [active, setActive] = useState(DOC_NAV[0]?.id ?? '');

  useEffect(() => {
    const ids = DOC_NAV.map((n) => n.id);
    const io = new IntersectionObserver(
      (entries) => {
        // IntersectionObserver does not guarantee entries are delivered in document order, so
        // sort by vertical position before taking the topmost one; if nothing is visible, leave
        // the previously active section as-is rather than guessing.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length) setActive(visible[0].target.id);
      },
      { rootMargin: '0px 0px -70% 0px', threshold: 0 },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  return (
    <aside className="sl-scroll overflow-auto pt-9 px-5 pb-10 flex-col gap-2.5 hidden min-[960px]:flex border-l border-border">
      <span className="sl-label">On this page</span>
      {DOC_NAV.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className="pl-2.5 border-l-2 border-solid no-underline text-[12.5px] leading-[1.5] text-muted border-border data-[active=1]:text-strong data-[active=1]:border-accent"
          data-active={item.id === active ? '1' : undefined}
        >
          {item.label}
        </a>
      ))}
      <div className="flex flex-col gap-2.5 mt-5 pt-4 border-t border-border-subtle">
        <span className="sl-label">Contribute</span>
        <a
          href={GITHUB_URL}
          className="no-underline text-[12.5px] text-muted"
          target="_blank"
          rel="noreferrer"
        >
          Edit this page on GitHub
        </a>
        <a href="#" className="no-underline text-[12.5px] text-muted">
          Report an inaccuracy
        </a>
      </div>
    </aside>
  );
}
