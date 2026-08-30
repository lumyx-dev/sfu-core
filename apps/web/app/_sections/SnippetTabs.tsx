'use client';

import { useState } from 'react';
import { Tabs } from '@sightline/ui';
import { START } from '@/content/home';

// Deliberately simpler than the source's snippet card (Home.dc.html:80-97), which also carries
// a per-tab title bar with a copy button and a footer note. The brief's SnippetSet shape
// (content/home.ts) only carries tabs + a flat snippet body per id, so those two extra pieces
// are dropped here rather than invented back in — see task-6-report.md.
export function SnippetTabs() {
  const [active, setActive] = useState(START.tabs[0].id);
  const snippet = START.snippets[active];

  return (
    <div className="flex flex-col gap-3">
      <Tabs tabs={START.tabs} activeId={active} onSelect={setActive} variant="segmented" />
      <div
        style={{
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--surface-card)',
          padding: '18px 20px',
          fontSize: 13,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          color: 'var(--text-body)',
        }}
      >
        {snippet}
      </div>
    </div>
  );
}
