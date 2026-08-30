import { AppShell, Card, DashboardGrid, GridItem, SplitPane, StatusStrip } from '@sightline/ui';

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
        <span className="sl-label">
          DashboardGrid — GridItem rowSpan=2 (grid-row: span 2 sur une grille a grid-auto-rows
          fixe ; la cellule de gauche occupe la hauteur des deux cellules de droite)
        </span>
        <DashboardGrid columns={4} style={{ gridAutoRows: 80 }}>
          <GridItem span={2} rowSpan={2}>
            <Card title="span 2, rowSpan 2" style={{ height: '100%' }}>
              <p style={{ margin: 0, color: 'var(--text-body)', fontSize: 'var(--fs-13)' }}>
                Occupies 2 rows.
              </p>
            </Card>
          </GridItem>
          <GridItem span={2}>
            <Card title="span 2" style={{ height: '100%' }}>
              <p style={{ margin: 0, color: 'var(--text-body)', fontSize: 'var(--fs-13)' }}>Row 1.</p>
            </Card>
          </GridItem>
          <GridItem span={1}>
            <Card title="span 1" style={{ height: '100%' }}>
              <p style={{ margin: 0, color: 'var(--text-body)', fontSize: 'var(--fs-13)' }}>Row 2.</p>
            </Card>
          </GridItem>
          <GridItem span={1}>
            <Card title="span 1" style={{ height: '100%' }}>
              <p style={{ margin: 0, color: 'var(--text-body)', fontSize: 'var(--fs-13)' }}>Row 2.</p>
            </Card>
          </GridItem>
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
        <span className="sl-label">
          StatusStrip — items de la maquette (Alerts en ton danger), + Latency ajoute en ton warn
          pour couvrir les 2 tons de StatusStripItem
        </span>
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <StatusStrip
            left="test-room · eu-west-3"
            items={[
              { label: 'Rooms', value: 4 },
              { label: 'Peers', value: 65 },
              { label: 'Alerts', value: 4, tone: 'danger' },
              { label: 'Latency', value: '128ms', tone: 'warn' },
              { label: 'Retention', value: '7d' },
            ]}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">
          AppShell — enveloppe plein cadre (sidebar/toolbar/footer/children) ; a gauche sans theme
          ni maxWidth (pleine largeur, pas de centrage — la source n&apos;a aucun defaut pour
          maxWidth) ; a droite theme=&quot;dark&quot;+maxWidth=320 (force le noir independamment
          du theme ambiant de cette passe de la galerie, et centre le contenu)
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
          <div style={{ height: 260, border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <AppShell
              sidebar={
                <div style={{ width: 160, height: '100%', background: 'var(--surface-inset)', padding: 'var(--space-5)', fontSize: 'var(--fs-12)', color: 'var(--text-muted)' }}>
                  sidebar slot
                </div>
              }
              toolbar={
                <div style={{ padding: 'var(--space-5)', borderBottom: '1px solid var(--border)', fontSize: 'var(--fs-13)', color: 'var(--text-strong)' }}>
                  toolbar slot
                </div>
              }
              footer={
                <div style={{ padding: 'var(--space-4) var(--space-5)', borderTop: '1px solid var(--border)', fontSize: 'var(--fs-12)', color: 'var(--text-muted)' }}>
                  footer slot
                </div>
              }
            >
              <p style={{ margin: 0, color: 'var(--text-body)', fontSize: 'var(--fs-13)' }}>
                children — pas de maxWidth : pleine largeur, pas de centrage.
              </p>
            </AppShell>
          </div>
          <div style={{ height: 260, border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <AppShell
              theme="dark"
              maxWidth={320}
              sidebar={
                <div style={{ width: 160, height: '100%', background: 'var(--surface-inset)', padding: 'var(--space-5)', fontSize: 'var(--fs-12)', color: 'var(--text-muted)' }}>
                  sidebar slot
                </div>
              }
              toolbar={
                <div style={{ padding: 'var(--space-5)', borderBottom: '1px solid var(--border)', fontSize: 'var(--fs-13)', color: 'var(--text-strong)' }}>
                  toolbar slot
                </div>
              }
              footer={
                <div style={{ padding: 'var(--space-4) var(--space-5)', borderTop: '1px solid var(--border)', fontSize: 'var(--fs-12)', color: 'var(--text-muted)' }}>
                  footer slot
                </div>
              }
            >
              <p style={{ margin: 0, color: 'var(--text-body)', fontSize: 'var(--fs-13)' }}>
                children — theme=&quot;dark&quot; force le noir ici meme quand cette passe de la
                galerie est claire ; maxWidth centre.
              </p>
            </AppShell>
          </div>
        </div>
      </div>
    </div>
  );
}
