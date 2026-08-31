'use client';

// This section is the Client Component boundary the four navigation components rely on:
// Breadcrumb/Sidebar/Tabs each wrap onSelect in an onClick closure on a native <button>
// internally (matching the design-system source), and that closure can't cross the RSC
// boundary from a page with no client directive — see task-6-report.md.
import { Breadcrumb, Button, Icon, Sidebar, Tabs, Toolbar, type SidebarItem } from '@lumyx/ui';

// Donnees reelles de la maquette — Dashboard UI.dc.html:395-405.
const NAV_ITEMS: SidebarItem[] = [
  { id: 'overview', label: 'Overview', icon: 'layout-dashboard' },
  { id: 'rooms', label: 'Rooms', icon: 'radio-tower', count: 4 },
  { id: 'peers', label: 'Peers', icon: 'users', count: 65 },
  { id: 'alerts', label: 'Alerts', icon: 'bell', status: 'error' },
  { id: 'metrics', label: 'Metrics', icon: 'gauge' },
  { id: 'replay', label: 'Session replay', icon: 'circle-play' },
  { id: 'signaling', label: 'Signaling', icon: 'terminal' },
  { id: 'server', label: 'Server', icon: 'server', status: 'live' },
  { id: 'settings', label: 'Settings', icon: 'sliders-horizontal' },
];

const TAB_ITEMS = [
  { id: 'peers', label: 'Peers', count: 6 },
  { id: 'media', label: 'Media' },
  { id: 'signaling', label: 'Signaling' },
];

export function NavigationSection() {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-8)' }}>
      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">
          Sidebar — 248px, activeId=&quot;rooms&quot; (tint + texte accent), Alerts porte un
          StatusDot error, Server un StatusDot live, Rooms/Peers portent un count
        </span>
        <div
          style={{
            height: 420,
            display: 'flex',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          <Sidebar
            items={NAV_ITEMS}
            activeId="rooms"
            brandMeta="sfu-eu-3 · eu-west-3"
            footer="v0.4.1 · MIT licensed"
          />
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">
          Sidebar — item de type section (etiquette non cliquable, pas de Row) et item sans icone
        </span>
        <div
          style={{
            height: 200,
            display: 'flex',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          <Sidebar
            items={[
              { section: 'Monitoring' },
              { id: 'overview', label: 'Overview', icon: 'layout-dashboard' },
              { id: 'notes', label: 'Notes (sans icone)' },
            ]}
            activeId="overview"
            brandMeta="demo"
          />
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">
          Breadcrumb — dernier item non cliquable (&quot;test-room&quot;, texte fort, curseur
          default)
        </span>
        <Breadcrumb items={[{ id: 'rooms', label: 'Rooms' }, { label: 'test-room' }]} />
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">
          Breadcrumb — 3 niveaux : le maillon du milieu porte a la fois le chevron (i &gt; 0) et
          reste cliquable (non last)
        </span>
        <Breadcrumb
          items={[
            { id: 'rooms', label: 'Rooms' },
            { id: 'test-room', label: 'test-room' },
            { label: 'Peers' },
          ]}
        />
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
        <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
          <span className="sl-label">Tabs — variant=&quot;underline&quot; (defaut), liseré 2px accent en bas de l&apos;onglet actif</span>
          <Tabs tabs={TAB_ITEMS} activeId="peers" variant="underline" />
        </div>
        <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
          <span className="sl-label">Tabs — variant=&quot;segmented&quot;, fond surface-inset, pastille active surface-card + shadow-xs</span>
          <Tabs tabs={TAB_ITEMS} activeId="media" variant="segmented" />
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">Toolbar — non sticky, left + right</span>
        <Toolbar
          left={<strong style={{ color: 'var(--text-strong)', fontSize: 'var(--fs-14)' }}>test-room</strong>}
          right={
            <>
              <Button variant="quiet" size="sm" icon={<Icon name="refresh-cw" />}>
                Refresh
              </Button>
              <Button variant="primary" size="sm">Invite</Button>
            </>
          }
        />
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">
          Toolbar — children (distinct de left, tous deux rendus dans le meme slot gauche apres
          left)
        </span>
        <Toolbar
          left={<strong style={{ color: 'var(--text-strong)', fontSize: 'var(--fs-14)' }}>test-room</strong>}
          right={<Button variant="quiet" size="sm">Action</Button>}
        >
          <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-12)' }}>children slot</span>
        </Toolbar>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">Toolbar — sticky (position: sticky au scroll du conteneur)</span>
        <div style={{ height: 160, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          <Toolbar
            sticky
            left={<strong style={{ color: 'var(--text-strong)', fontSize: 'var(--fs-14)' }}>Sticky toolbar</strong>}
            right={<Button variant="secondary" size="sm">Action</Button>}
          />
          <div style={{ padding: 'var(--space-6)', color: 'var(--text-muted)', fontSize: 'var(--fs-13)' }}>
            Scroll this box — the toolbar above stays pinned to the top while this filler
            content scrolls underneath it.
            <br /><br />
            More filler content to make the container scrollable well beyond its 160px height.
            <br /><br />
            Even more filler content.
          </div>
        </div>
      </div>
    </div>
  );
}
