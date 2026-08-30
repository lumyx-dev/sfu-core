'use client';

// 'use client' boundary: AlertBanner.onDismiss, Toast.onDismiss and the action slots below pass
// functions/interactive elements down from this page. Those can't cross the RSC boundary from a
// Server Component with no client directive — same reasoning as sections/navigation.tsx.
import {
  AlertBanner,
  Button,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  SeverityBadge,
  Toast,
  ToastStack,
} from '@sightline/ui';

// AlertBanner.severity / SeverityBadge.severity / Toast.severity share one SEVERITY map in the
// source (:1170-1217, :1596-1619, :1656-1679): 'critical' | 'warning' | 'info' | 'success'. There
// is no 'danger' key — passing severity="danger" falls through to the default ('warning' for
// AlertBanner, 'info' for SeverityBadge/Toast) instead of rendering as the most severe tone. See
// task-7-report.md for the divergence from the brief's example copy, which used severity="danger".
const SEVERITIES = ['critical', 'warning', 'info', 'success'] as const;

// ToastStack.placement — source :1736-1750 only maps 3 keys (no 'top-left'); a 4th value falls
// through with no position offset at all. Rendering the 3 the source actually supports.
const PLACEMENTS = ['bottom-right', 'top-right', 'bottom-left'] as const;

export function FeedbackSection() {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-8)' }}>
      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">
          AlertBanner — copie du handoff (severity=&quot;critical&quot;, la source n&apos;a pas de
          clef &quot;danger&quot;), avec action et onDismiss
        </span>
        <AlertBanner
          severity="critical"
          title="Packet loss above threshold"
          message="Packet loss has been above 2% for 3m 12s. Force audio-only or renegotiate the session."
          meta="webinar-us · ap-south-1 · 14:06:41 · loss 7.90% vs 2%"
          action={
            <>
              <Button variant="secondary" size="sm">Renegotiate</Button>
              <Button variant="danger" size="sm">Force audio-only</Button>
            </>
          }
          onDismiss={() => {}}
        />
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">AlertBanner — 4 severites (SEVERITY map complete)</span>
        {SEVERITIES.map((severity) => (
          <AlertBanner
            key={severity}
            severity={severity}
            title={severity}
            message="Static message text for this severity."
            meta="sample-room · eu-west-3 · 09:41:02"
          />
        ))}
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">SeverityBadge — 4 severites, avec et sans icone</span>
        <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center' }}>
          {SEVERITIES.map((severity) => (
            <SeverityBadge key={severity} severity={severity} />
          ))}
          {SEVERITIES.map((severity) => (
            <SeverityBadge key={`n-${severity}`} severity={severity} showIcon={false} />
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
        <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
          <span className="sl-label">EmptyState — copie du handoff</span>
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
            <EmptyState
              icon="radio-tower"
              title="No active rooms"
              hint="Rooms appear here as soon as a peer joins."
            />
          </div>
        </div>
        <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
          <span className="sl-label">EmptyState — compact=true, avec action</span>
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
            <EmptyState
              icon="radio-tower"
              title="No active rooms"
              hint="Rooms appear here as soon as a peer joins."
              compact
              action={<Button variant="secondary" size="sm">Create a room</Button>}
            />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">
          ErrorState — copie du handoff : code et detail bruts dans un bloc inset, sans paraphrase
        </span>
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          <ErrorState
            title="Metrics endpoint unreachable"
            code="ECONNREFUSED"
            detail="GET http://127.0.0.1:8080/metrics — connect ECONNREFUSED 127.0.0.1:8080"
            action={<Button variant="secondary" size="sm">Retry</Button>}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
        <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
          <span className="sl-label">LoadingSkeleton — variant=&quot;rows&quot; (defaut), rows=4</span>
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '0 var(--space-6)' }}>
            <LoadingSkeleton variant="rows" rows={4} />
          </div>
        </div>
        <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
          <span className="sl-label">LoadingSkeleton — variant=&quot;metric&quot;, columns=4</span>
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <LoadingSkeleton variant="metric" columns={4} />
          </div>
        </div>
        <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
          <span className="sl-label">LoadingSkeleton — variant=&quot;chart&quot;</span>
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '0 var(--space-6)' }}>
            <LoadingSkeleton variant="chart" />
          </div>
        </div>
        <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
          <span className="sl-label">LoadingSkeleton — variant=&quot;tile&quot;</span>
          <div style={{ maxWidth: 320 }}>
            <LoadingSkeleton variant="tile" />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">
          Toast / ToastStack — 3 placements geres par la source (pas de &quot;top-left&quot;),
          chaque pile porte 2 Toast de severites differentes et un onDismiss
        </span>
        <div style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
          {PLACEMENTS.map((placement) => (
            <div
              key={placement}
              style={{
                position: 'relative',
                width: 380,
                height: 220,
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--surface-inset)',
                overflow: 'hidden',
              }}
            >
              <span
                className="sl-label"
                style={{ position: 'absolute', top: 'var(--space-4)', left: 'var(--space-5)' }}
              >
                {placement}
              </span>
              <ToastStack placement={placement}>
                <Toast
                  severity="critical"
                  title="Packet loss above threshold"
                  time="14:06:41"
                  onDismiss={() => {}}
                />
                <Toast
                  severity="success"
                  title="Session reconnected"
                  message="webinar-us resumed after 2 retries."
                  time="14:06:58"
                  onDismiss={() => {}}
                />
              </ToastStack>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
