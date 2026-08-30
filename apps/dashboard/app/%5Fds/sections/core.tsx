import { Badge, Button, Card, IconButton, Input, Pill, Select, StatusDot, Icon } from '@sightline/ui';

const VARIANTS = ['primary', 'secondary', 'quiet', 'danger', 'accentQuiet'] as const;
const SIZES = ['sm', 'md', 'lg'] as const;
const TONES = ['neutral', 'accent', 'secondary', 'ok', 'warn', 'danger', 'info'] as const;
// Pill's fg map only recognizes these 4 keys (source :566-571) — unlike Badge's 7-tone table,
// ok/warn/danger/info fall back to text-body as deliberate no-ops. Render the real set, not
// Badge's, so the gallery demonstrates the component actually shipped.
const PILL_TONES = ['neutral', 'accent', 'secondary', 'muted'] as const;
// StatusDot's MAP (source :522-530) has 7 keys — all of them, not a sample, since `connecting`
// is the only other breathing state and the only warn+breathing combination.
const STATUSES = ['live', 'connected', 'connecting', 'degraded', 'disconnected', 'error', 'idle'] as const;

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
        <span className="sl-label">StatusDot — 7 statuts (MAP complete), halo on/off</span>
        <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'center', flexWrap: 'wrap' }}>
          {STATUSES.map((status) => <StatusDot key={status} status={status} />)}
          {STATUSES.map((status) => <StatusDot key={`n-${status}`} status={status} halo={false} />)}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">Pill — 4 tons reels (neutral/accent/secondary/muted), count, status</span>
        <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          {PILL_TONES.map((tone) => <Pill key={tone} tone={tone} count={4}>{tone}</Pill>)}
          <Pill tone="accent" status="live">Live room</Pill>
          <Pill tone="neutral" status="idle">Idle room</Pill>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">IconButton — 2 tons (default/danger), actif, desactive</span>
        <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
          <IconButton label="Refresh"><Icon name="refresh-cw" /></IconButton>
          <IconButton label="Settings" active><Icon name="settings" /></IconButton>
          <IconButton label="Delete" tone="danger" active><Icon name="x" /></IconButton>
          <IconButton label="Close" disabled><Icon name="x" /></IconButton>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)', maxWidth: 420 }}>
        <span className="sl-label">Input & Select — 2 tailles, hint, erreur, prefix/suffix</span>
        <Input label="Room id" placeholder="test-room" hint="Lowercase, no spaces." />
        <Input label="Search" placeholder="Find a room" prefix={<Icon name="search" />} />
        <Input label="Threshold" defaultValue="2" suffix="%" size="sm" />
        <Input label="Region" defaultValue="eu-west-3" error="Unknown region." />
        <Select label="Retention" defaultValue="7d" options={[
          { value: '24h', label: '24 hours' },
          { value: '7d', label: '7 days' },
          { value: '30d', label: '30 days' },
        ]} />
        <Select label="Region" defaultValue="eu-west-3" size="sm" options={[
          { value: 'eu-west-3', label: 'eu-west-3' },
          { value: 'us-east-1', label: 'us-east-1' },
        ]} />
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)', maxWidth: 520 }}>
        <span className="sl-label">Card — avec meta, actions, footer, et non padded</span>
        <Card title="Room detail" meta="test-room" actions={<Button size="sm" variant="quiet">Open</Button>} footer="Updated 12s ago">
          <p style={{ margin: 0, color: 'var(--text-body)', fontSize: 'var(--fs-13)' }}>
            Card body content.
          </p>
        </Card>
        <Card title="Non padded" padded={false}>
          <div style={{ padding: 'var(--space-6)', background: 'var(--surface-inset)' }}>
            <p style={{ margin: 0, color: 'var(--text-body)', fontSize: 'var(--fs-13)' }}>
              padded=false — le body ne porte pas le padding standard, ce contenu le simule lui-meme.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
