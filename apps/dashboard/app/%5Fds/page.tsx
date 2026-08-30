import { Icon, ICONS, Probe, type IconName } from '@sightline/ui';
import { CoreSection } from './sections/core';
import { LayoutSection } from './sections/layout-section';

export default function DesignSystemPage() {
  return (
    <main style={{ padding: 'var(--space-9)', display: 'grid', gap: 'var(--space-9)' }}>
      <h1 style={{ fontSize: 'var(--fs-26)', letterSpacing: 'var(--ls-display)' }}>
        Sightline design system
      </h1>
      <section style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">Probe</span>
        <div><Probe /></div>
      </section>
      <section style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">Icons — 16px, stroke 1.75</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-6)', color: 'var(--text-body)' }}>
          {(Object.keys(ICONS) as IconName[]).map((name) => (
            <span key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: 'var(--fs-12)', color: 'var(--text-muted)' }}>
              <Icon name={name} />
              {name}
            </span>
          ))}
        </div>
      </section>
      <section style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">Core</span>
        <CoreSection />
      </section>
      <section style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">Layout</span>
        <LayoutSection />
      </section>
    </main>
  );
}
