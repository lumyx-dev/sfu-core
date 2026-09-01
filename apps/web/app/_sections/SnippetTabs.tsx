'use client';

import { useState } from 'react';
import { Icon, IconButton, Tabs } from '@lumyx/ui';
import { START } from '@/content/home';

// Source: Home.dc.html:79-97 — the snippet card, with its title bar (+ copy IconButton) and
// footer note kept (a first pass had dropped both; see task-6-report.md fix log). The copy
// button is wired to the clipboard here even though the source mockup leaves it inert — a
// shipping site can't afford an affordance that visibly does nothing (coordinator ruling,
// fix pass 3).
export function SnippetTabs() {
  const [active, setActive] = useState(START.tabs[0].id);
  const snippet = START.snippets[active];

  const handleCopy = () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard.writeText(snippet.body).catch(() => { });
  };

  return (
    <div className="flex flex-col gap-3">
      <Tabs tabs={START.tabs} activeId={active} onSelect={setActive} variant="segmented" />
      <div className="border border-border rounded-card bg-card overflow-hidden">
        <div className="flex items-center gap-2.5 px-[18px] py-3 border-b border-border-subtle">
          <span className="sl-label">{snippet.title}</span>
          <span className="flex-1" />
          <IconButton label="Copy" size={28} onClick={handleCopy}>
            <Icon name="copy" size={14} />
          </IconButton>
        </div>
        <div className="px-5 py-[18px] text-[13px] leading-[1.6] whitespace-pre-wrap text-body min-h-[168px]">
          {snippet.body}
        </div>
        <div className="px-5 py-3 border-t border-border-subtle bg-sunken">
          <span className="text-12 text-muted [text-wrap:pretty]">{snippet.note}</span>
        </div>
      </div>
    </div>
  );
}
