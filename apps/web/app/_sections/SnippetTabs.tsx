'use client';

import { useState } from 'react';
import { Icon, IconButton, Tabs } from '@sightline/ui';
import { START } from '@/content/home';

// Source: Home.dc.html:79-97 — the snippet card, with its title bar (+ copy IconButton) and
// footer note kept (a first pass had dropped both; see task-6-report.md fix log).
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
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 18px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <span className="sl-label">{snippet.title}</span>
          <span style={{ flex: 1 }} />
          <IconButton label="Copy" size={28}>
            <Icon name="copy" size={14} />
          </IconButton>
        </div>
        <div
          style={{
            padding: '18px 20px',
            fontSize: 13,
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            color: 'var(--text-body)',
            minHeight: 168,
          }}
        >
          {snippet.body}
        </div>
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--surface-sunken)',
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--text-muted)', textWrap: 'pretty' }}>
            {snippet.note}
          </span>
        </div>
      </div>
    </div>
  );
}
