import { Badge, Button, Card, IconButton, Input, Pill, Select, StatusDot, Icon } from '@sightline/ui';

const VARIANTS = ['primary', 'secondary', 'quiet', 'danger', 'accentQuiet'] as const;
const SIZES = ['sm', 'md', 'lg'] as const;
const TONES = ['neutral', 'accent', 'secondary', 'ok', 'warn', 'danger', 'info'] as const;
const STATUSES = ['live', 'degraded', 'idle', 'error'] as const;

export function CoreSection() {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-8)' }}>
      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">Button — 5 variants x 3 tailles, + disabled et block</span>
        {SIZES.map((size) => (
          <div key={size} style={{ display: 'flex', gap: 'var(--space-5)', alignItems: 'center', flexWrap: 'wrap' }}>
            {VARIANTS.map((variant) => (
              <Button key={variant} variant={variant} size={size}>{variant}</Button>
            ))}
            <Button variant="primary" size={size} disabled>disabled</Button>
            <Button variant="secondary" size={size} icon={<Icon name="download" />}>with icon</Button>
          </div>
        ))}
        <div style={{ maxWidth: 320 }}><Button variant="primary" block>block</Button></div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">Badge — 7 tons, + uppercase et solid</span>
        <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          {TONES.map((tone) => <Badge key={tone} tone={tone}>{tone}</Badge>)}
          {TONES.map((tone) => <Badge key={`u-${tone}`} tone={tone} uppercase>{tone}</Badge>)}
          {TONES.map((tone) => <Badge key={`s-${tone}`} tone={tone} solid>{tone}</Badge>)}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">StatusDot — 4 statuts, halo on/off</span>
        <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'center' }}>
          {STATUSES.map((status) => <StatusDot key={status} status={status} />)}
          {STATUSES.map((status) => <StatusDot key={`n-${status}`} status={status} halo={false} />)}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">Pill — 7 tons, avec count et status</span>
        <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          {TONES.map((tone) => <Pill key={tone} tone={tone} count={4}>{tone}</Pill>)}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">IconButton — 3 tons, actif, desactive</span>
        <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
          <IconButton label="Refresh"><Icon name="refresh-cw" /></IconButton>
          <IconButton label="Settings" active><Icon name="settings" /></IconButton>
          <IconButton label="Close" disabled><Icon name="x" /></IconButton>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)', maxWidth: 420 }}>
        <span className="sl-label">Input & Select — 3 tailles, hint, erreur</span>
        <Input label="Room id" placeholder="test-room" hint="Lowercase, no spaces." />
        <Input label="Threshold" defaultValue="2" suffix="%" size="sm" />
        <Input label="Region" defaultValue="eu-west-3" error="Unknown region." />
        <Select label="Retention" defaultValue="7d" options={[
          { value: '24h', label: '24 hours' },
          { value: '7d', label: '7 days' },
          { value: '30d', label: '30 days' },
        ]} />
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)', maxWidth: 520 }}>
        <span className="sl-label">Card — avec meta, actions, footer, et non padded</span>
        <Card title="Room detail" meta="test-room" actions={<Button size="sm" variant="quiet">Open</Button>} footer="Updated 12s ago">
          <p style={{ margin: 0, color: 'var(--text-body)', fontSize: 'var(--fs-13)' }}>
            Card body content.
          </p>
        </Card>
      </div>
    </div>
  );
}
