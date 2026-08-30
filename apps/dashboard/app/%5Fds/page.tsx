import { Icon, ICONS, type IconName } from '@sightline/ui';
import { CoreSection } from './sections/core';
import { DataSection } from './sections/data';
import { FeedbackSection } from './sections/feedback';
import { LayoutSection } from './sections/layout-section';
import { NavigationSection } from './sections/navigation';
import { WebrtcSection } from './sections/webrtc';

// Le nom du fichier reste `layout-section.tsx` (pas `layout.tsx`) : `app/_ds/` est un segment
// route reel, et `layout.tsx` y collisionnerait avec le fichier special reserve de l'App Router.

const SECTIONS = [
  ['Core', CoreSection],
  ['Layout', LayoutSection],
  ['Navigation', NavigationSection],
  ['Feedback', FeedbackSection],
  ['Data', DataSection],
  ['WebRTC', WebrtcSection],
] as const;

function IconGallery() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-6)', color: 'var(--text-body)' }}>
      {(Object.keys(ICONS) as IconName[]).map((name) => (
        <span
          key={name}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: 'var(--fs-12)', color: 'var(--text-muted)' }}
        >
          <Icon name={name} />
          {name}
        </span>
      ))}
    </div>
  );
}

/* Rendue deux fois par DesignSystemPage — une fois nue, une fois enveloppee dans .theme-dark —
   pour que les deux themes soient controlables d'un seul scroll (aucun composant n'a de branche
   JS pour le theme : la classe repointe les alias CSS, cf. spec §6 "Dark mode"). */
function Gallery() {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-11)', padding: 'var(--space-9)' }}>
      <section style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">Icons — 16px, stroke 1.75</span>
        <IconGallery />
      </section>
      {SECTIONS.map(([name, Section]) => (
        <section key={name} style={{ display: 'grid', gap: 'var(--space-7)' }}>
          <h2 style={{ fontSize: 'var(--fs-20)', letterSpacing: 'var(--ls-tight)' }}>{name}</h2>
          <Section />
        </section>
      ))}
    </div>
  );
}

export default function DesignSystemPage() {
  return (
    <main>
      <div style={{ padding: 'var(--space-9)', paddingBottom: 0, background: 'var(--surface-page)' }}>
        <h1 style={{ fontSize: 'var(--fs-26)', letterSpacing: 'var(--ls-display)' }}>
          Sightline design system
        </h1>
      </div>
      <div style={{ background: 'var(--surface-page)' }}>
        <Gallery />
      </div>
      <div className="theme-dark" style={{ background: 'var(--surface-page)', color: 'var(--text-body)' }}>
        <Gallery />
      </div>
    </main>
  );
}
