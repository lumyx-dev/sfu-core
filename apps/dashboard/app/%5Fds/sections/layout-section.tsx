import { Card, DashboardGrid, GridItem, SplitPane, StatusStrip } from '@sightline/ui';

function Cell({ span }: { span: number }) {
  return (
    <GridItem span={span}>
      <Card title={`span ${span}`}>
        <p style={{ margin: 0, color: 'var(--text-body)', fontSize: 'var(--fs-13)' }}>
          {span}/12 columns.
        </p>
      </Card>
    </GridItem>
  );
}

export function LayoutSection() {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-8)' }}>
      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">DashboardGrid — mode fixe (columns=12), GridItem span 12 / 6+6 / 4+4+4 / 8+4</span>
        <DashboardGrid columns={12}>
          <Cell span={12} />
          <Cell span={6} />
          <Cell span={6} />
          <Cell span={4} />
          <Cell span={4} />
          <Cell span={4} />
          <Cell span={8} />
          <Cell span={4} />
        </DashboardGrid>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">DashboardGrid — mode auto (minColumn=280), repeat(auto-fit, minmax(280px, 1fr))</span>
        <DashboardGrid auto minColumn={280}>
          <Card title="Auto A"><p style={{ margin: 0, color: 'var(--text-body)', fontSize: 'var(--fs-13)' }}>Fills a track of at least 280px.</p></Card>
          <Card title="Auto B"><p style={{ margin: 0, color: 'var(--text-body)', fontSize: 'var(--fs-13)' }}>Fills a track of at least 280px.</p></Card>
          <Card title="Auto C"><p style={{ margin: 0, color: 'var(--text-body)', fontSize: 'var(--fs-13)' }}>Fills a track of at least 280px.</p></Card>
        </DashboardGrid>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">SplitPane — railWidth par defaut (340px, rail a droite)</span>
        <SplitPane
          left={<Card title="Canvas"><p style={{ margin: 0, color: 'var(--text-body)', fontSize: 'var(--fs-13)' }}>Main content (1fr).</p></Card>}
          right={<Card title="Rail"><p style={{ margin: 0, color: 'var(--text-body)', fontSize: 'var(--fs-13)' }}>340px rail.</p></Card>}
        />
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">SplitPane — reverse (le rail passe a gauche, meme contenu)</span>
        <SplitPane
          reverse
          left={<Card title="Canvas"><p style={{ margin: 0, color: 'var(--text-body)', fontSize: 'var(--fs-13)' }}>Main content (1fr).</p></Card>}
          right={<Card title="Rail"><p style={{ margin: 0, color: 'var(--text-body)', fontSize: 'var(--fs-13)' }}>340px rail.</p></Card>}
        />
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">StatusStrip — items de la maquette (Alerts en ton danger)</span>
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <StatusStrip
            left="test-room · eu-west-3"
            items={[
              { label: 'Rooms', value: 4 },
              { label: 'Peers', value: 65 },
              { label: 'Alerts', value: 4, tone: 'danger' },
              { label: 'Retention', value: '7d' },
            ]}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">AppShell — non rendu ici : c&apos;est un conteneur plein page, exerce par la page /_ds elle-meme (Task 11)</span>
      </div>
    </div>
  );
}
