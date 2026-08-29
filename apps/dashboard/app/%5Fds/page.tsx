import { Probe } from '@sightline/ui';

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
    </main>
  );
}
