'use client';
// 'use client' boundary: DataTable.onRowClick below passes a function down from this page,
// which can't cross the RSC boundary from a Server Component with no client directive — same
// reasoning as sections/feedback.tsx and sections/navigation.tsx. This is NOT the design
// system's client component (that's packages/ui's EventList.tsx, the only one of the 37
// permitted 'use client' — see task-8-report.md); this file lives in apps/dashboard and is
// outside the guard script's scope.
import {
  DataTable,
  type DataTableColumn,
  EventList,
  type EventListEntry,
  type EventListEntryType,
  MetricCard,
  MetricGrid,
  ProgressBar,
  Sparkline,
  type SparklineTone,
  StatusDot,
  TimeSeriesChart,
} from '@lumyx/ui';
import { PEERS, type Peer } from '../mock';

// Ordre exact de Sparkline.TONES (source :930) : accent/secondary/warn/neutral/ok -> --series-1..5,
// danger -> --danger. Pas de mapping direct vers --accent/--ok/--warn/--danger pour les 5
// premieres cles, contrairement a ce que le brief laissait entendre (cf. task-9-report.md).
const SPARKLINE_TONES: SparklineTone[] = ['accent', 'secondary', 'warn', 'neutral', 'ok', 'danger'];

// Recopie verbatim de `labels` (Dashboard UI.dc.html:342) — les memes libelles que la maquette.
const TIME_LABELS = ['14:02', '14:17', '14:32', '14:47', '15:02'];

const PEER_COLUMNS: DataTableColumn<Peer>[] = [
  { key: 'peer_id', header: 'Peer', strong: true },
  { key: 'room', header: 'Room', muted: true },
  { key: 'score', header: 'Score', numeric: true, align: 'right', strong: true },
  { key: 'rtt', header: 'RTT', numeric: true, align: 'right', render: (r) => `${r.rtt} ms` },
  { key: 'jitter', header: 'Jitter', numeric: true, align: 'right', render: (r) => `${r.jitter} ms` },
  { key: 'loss', header: 'Loss', numeric: true, align: 'right', render: (r) => `${r.loss}%` },
  { key: 'codec', header: 'Codec', muted: true, width: 90 },
  {
    key: 'status',
    header: 'Status',
    render: (r) => {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <StatusDot status={r.status === 'live' ? 'live' : 'degraded'} size={8} />
          {r.status}
        </span>
      );
    },
  },
];

const PEER_ROWS = PEERS;

const EVENTS: EventListEntry[] = [
  { time: '14:06:41', message: 'Peer joined', detail: 'a3f91c02', type: 'event' },
  { time: '14:06:44', message: 'Peer joined', detail: '0b8e2f61', type: 'event' },
  { time: '14:07:02', message: 'Renegotiation started', detail: '5e7b21f4', type: 'info' },
  { time: '14:07:05', message: 'ICE failed', detail: 'ff104b2c', type: 'error' },
  { time: '14:07:11', message: 'Peer left', detail: 'd41f9ab7', type: 'muted' },
  { time: '14:07:20', message: 'Keyframe requested', detail: '9c0d34aa', type: 'send' },
  { time: '14:07:33', message: 'Peer joined', detail: '2f81be07', type: 'event' },
];

// Type hors de l'union EventListEntryType (ex: un canal ajoute cote serveur apres coup, ou une
// source externe pas typee). s[e.type] est alors undefined et `|| s.info` (EventList.tsx :54)
// retombe silencieusement sur le style visuel d'info — pas de crash, pas de classe manquante.
const UNKNOWN_TYPE_EVENT: EventListEntry[] = [
  {
    time: '14:08:02',
    message: 'Custom channel event',
    detail: 'plugin-x',
    type: 'debug' as unknown as EventListEntryType,
  },
];

export function DataSection() {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-8)' }}>
      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">
          DataTable — normal, colonnes PEERS (align/numeric/muted/strong/render, Codec porte
          width=90), selectedIndex=2 (ligne 5e7b21f4 : accent-tint + liseré 2px accent, cf.
          source :605)
        </span>
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          <DataTable columns={PEER_COLUMNS} rows={PEER_ROWS} selectedIndex={2} onRowClick={() => { }} />
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">DataTable — dense=true, memes colonnes et selectedIndex=2</span>
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          <DataTable columns={PEER_COLUMNS} rows={PEER_ROWS} selectedIndex={2} dense onRowClick={() => { }} />
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">
          MetricGrid divided=true (defaut), 4 MetricCard aux noms de champs reels du /metrics SFU
          (rooms, peers, avg_packet_loss, avg_rtt_ms — README.md:78-85) — couvre align, compact,
          status et deltaTone (up/down/flat)
        </span>
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <MetricGrid columns={4}>
            <MetricCard label="rooms" value={3} delta="+1" deltaTone="up" sublabel="active now" />
            <MetricCard label="peers" value={12} delta="-2" deltaTone="down" sublabel="last 5m" />
            <MetricCard
              label="avg_packet_loss"
              value={0.2}
              unit="%"
              delta="0.0"
              deltaTone="flat"
              status="warn"
              align="right"
            />
            <MetricCard label="avg_rtt_ms" value={38} unit="ms" sublabel="p50" status="ok" compact />
          </MetricGrid>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">MetricGrid divided=false, columns=2</span>
        <MetricGrid columns={2} divided={false}>
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
            <MetricCard label="rooms" value={3} sublabel="active now" />
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
            <MetricCard label="peers" value={12} sublabel="last 5m" />
          </div>
        </MetricGrid>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)', maxWidth: 260 }}>
        <span className="sl-label">MetricCard — status=&quot;error&quot; (3e valeur de l&apos;enum ok/warn/error)</span>
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          <MetricCard label="ice_failures" value={3} status="error" sublabel="last 5m" />
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-6)', maxWidth: 420 }}>
        <span className="sl-label">
          ProgressBar — tones accent/warn/danger/secondary, valeur au-dessus du threshold (marqueur
          2px, pas de changement de couleur — cf. source :845), indeterminate (sl-shimmer), et
          showValue sans label (le head ne rend que la valeur)
        </span>
        <ProgressBar label="CPU" value={42} showValue tone="accent" />
        <ProgressBar label="Memory" value={88} showValue tone="warn" />
        <ProgressBar label="Packet loss" value={7.9} max={10} threshold={2} showValue unit="%" tone="danger" />
        <ProgressBar label="Buffering" tone="secondary" indeterminate />
        <ProgressBar value={64} showValue tone="ok" />
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)', maxWidth: 520 }}>
        <span className="sl-label">
          EventList — autoScroll, height=220, faits accomplis en sentence case avec l&apos;identifiant
          en detail terminal ; les 5 types de canal (info/event/send/error/muted)
        </span>
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          <EventList entries={EVENTS} height={220} autoScroll />
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)', maxWidth: 520 }}>
        <span className="sl-label">EventList — dense=true, height=160</span>
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          <EventList entries={EVENTS} height={160} dense />
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)', maxWidth: 520 }}>
        <span className="sl-label">
          EventList — type non reconnu (repli silencieux sur le style visuel d&apos;info)
        </span>
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          <EventList entries={UNKNOWN_TYPE_EVENT} height={64} />
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">
          Sparkline — un par tone (table exacte de la source : accent/secondary/warn/neutral/ok
          -&gt; --series-1..5, danger -&gt; --danger, dans cet ordre), meme serie (a3f91c02) pour
          comparer les couleurs
        </span>
        <div style={{ display: 'flex', gap: 'var(--space-7)', alignItems: 'center', flexWrap: 'wrap' }}>
          {SPARKLINE_TONES.map((tone) => (
            <Sparkline key={tone} data={PEERS[0].series} tone={tone} />
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">Sparkline — fill=true (defaut) puis fill=false, meme serie et tone</span>
        <div style={{ display: 'flex', gap: 'var(--space-7)', alignItems: 'center' }}>
          <Sparkline data={PEERS[3].series} tone="danger" fill />
          <Sparkline data={PEERS[3].series} tone="danger" fill={false} />
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">Sparkline — dot=true (defaut) puis dot=false, meme serie et tone</span>
        <div style={{ display: 'flex', gap: 'var(--space-7)', alignItems: 'center' }}>
          <Sparkline data={PEERS[4].series} tone="ok" dot />
          <Sparkline data={PEERS[4].series} tone="ok" dot={false} />
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">
          Sparkline — threshold sous le minimum de la serie (ligne pointillee danger a --danger,
          dasharray 3 4, opacity 0.45)
        </span>
        <Sparkline data={PEERS[0].series} tone="accent" threshold={20} />
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)', maxWidth: 280 }}>
        <span className="sl-label">
          MetricCard — Sparkline dans le slot chart (son usage reel dans les maquettes)
        </span>
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          <MetricCard
            label="avg_rtt_ms"
            value={38}
            unit="ms"
            delta="-4"
            deltaTone="down"
            sublabel="p50 · 60s"
            chart={<Sparkline data={PEERS[0].series} tone="accent" width={200} height={40} />}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">TimeSeriesChart — 1 serie (rtt de a3f91c02, tone accent), unit=&quot;ms&quot;</span>
        <div style={{ maxWidth: 640 }}>
          <TimeSeriesChart
            series={[{ name: 'RTT', data: PEERS[0].series, tone: 'accent' }]}
            labels={TIME_LABELS}
            unit="ms"
          />
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">
          TimeSeriesChart — 3 series (rtt de 3 peers), threshold=150 + thresholdLabel=&quot;SLA&quot;,
          unit=&quot;ms&quot; — chaque serie choisit sa couleur via sa propre prop tone (pas de
          rotation automatique sur --series-1..5 par index, cf. task-9-report.md) ; d41f9ab7 porte
          fill=false (pas de degrade sous sa courbe) ; cursor=62 positionne le repere vertical a
          62% de la largeur
        </span>
        <div style={{ maxWidth: 640 }}>
          <TimeSeriesChart
            series={[
              { name: 'a3f91c02', data: PEERS[0].series, tone: 'accent' },
              { name: '5e7b21f4', data: PEERS[2].series, tone: 'warn' },
              { name: 'd41f9ab7', data: PEERS[3].series, tone: 'ok', fill: false },
            ]}
            labels={TIME_LABELS}
            threshold={150}
            thresholdLabel="SLA"
            unit="ms"
            cursor={62}
          />
        </div>
      </div>
    </div>
  );
}
