'use client';

// 'use client' boundary: PeerCard.onClick / RoomCard.onClick below pass functions down from
// this page. Those can't cross the RSC boundary from a Server Component with no client
// directive — same reasoning as sections/data.tsx, sections/feedback.tsx and
// sections/navigation.tsx. Not the design system's own client component (that's still only
// packages/ui's EventList.tsx).
import {
  LatencyChip,
  type LatencyChipMetric,
  PeerCard,
  QualityIndicator,
  type QualityIndicatorLevel,
  RoomCard,
  type RoomCardHealth,
  VideoTile,
} from '@lumyx/ui';
import type { StatusDotStatus } from '@lumyx/ui';
import { PEERS, ROOMS } from '../mock';

// LatencyChip source (:2245-2308) : THRESHOLDS n'a que 5 cles — rtt/jitter/loss/nack/freeze,
// chacune [bad, warn]. Pas de cle 'bitrate', malgre le seuil bitrate_kbps<100 cite dans les
// consignes comme faisant partie des "seuils reels du repo" : la regle systeme "un chiffre
// colore = un seuil franchi" ne couvre que ces 5 metriques dans LatencyChip (cf. rapport).
const METRICS: Array<{ metric: LatencyChipMetric; unit: string; below: number; above: number }> = [
  { metric: 'rtt', unit: 'ms', below: 80, above: 240 },
  { metric: 'jitter', unit: 'ms', below: 9, above: 38 },
  { metric: 'loss', unit: '%', below: 0.2, above: 3.4 },
  { metric: 'nack', unit: '%', below: 1.1, above: 6.2 },
  { metric: 'freeze', unit: '%', below: 0, above: 1.4 },
];

// QualityIndicator source (:2312-2318) : LEVELS a 5 clefs, dans cet ordre exact.
const LEVELS: QualityIndicatorLevel[] = ['excellent', 'good', 'degraded', 'poor', 'unknown'];

const HEALTHS: RoomCardHealth[] = ['ok', 'degraded', 'error', 'idle'];

export function WebrtcSection() {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-8)' }}>
      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">
          PeerCard — les 8 PEERS (Task 8). d41f9ab7 (rtt 212) et ff104b2c (rtt 284) sont
          au-dessus du seuil rtt de 200ms de LatencyChip : leur puce RTT doit apparaitre en
          rouge (--danger). 2f81be07 (rtt 128) est au-dessus du seuil &quot;warn&quot; de 120ms
          mais sous le seuil &quot;bad&quot; de 200ms : sa puce RTT doit apparaitre en ambre
          (--warn), pas rouge. Les 5 autres restent neutres (--text-strong). Si tous les
          chiffres sont colores, ou aucun, le seuil n&apos;est pas cable.
        </span>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 'var(--space-6)',
          }}
        >
          {PEERS.map((p, i) => (
            <PeerCard
              key={p.peer_id}
              peerId={p.peer_id}
              status={p.status as StatusDotStatus}
              score={p.score}
              rtt={p.rtt}
              jitter={p.jitter}
              loss={p.loss}
              codec={p.codec}
              tracks={p.tracks}
              region={p.region}
              samples={p.series}
              selected={i === 3}
              onClick={() => { }}
            />
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">
          RoomCard — les 6 ROOMS de la maquette, dont standup-eu (health=&quot;degraded&quot;) et
          les 2 salles idle (load-test-9, demo-call-3). Le Sparkline de RoomCard a un tone fixe
          (&quot;secondary&quot;) sans threshold : health ne colore que le StatusDot, jamais les
          chiffres Peers/Uptime/Bitrate — la regle &quot;chiffre colore = seuil franchi&quot; ne
          s&apos;applique pas ici (cf. rapport).
        </span>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 'var(--space-6)',
          }}
        >
          {ROOMS.map((r) => (
            <RoomCard
              key={r.id}
              roomId={r.id}
              peers={r.peers}
              uptime={r.uptime}
              bitrate={r.bitrate}
              health={r.health as RoomCardHealth}
              samples={r.series}
              region={r.region}
              onClick={() => { }}
            />
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">
          RoomCard — health=&quot;ok&quot;/&quot;degraded&quot;/&quot;error&quot;/&quot;idle&quot;
          (table complete du mapping vers StatusDot, source :2494-2499 : ok-&gt;live,
          degraded-&gt;degraded, error-&gt;error, idle-&gt;idle)
        </span>
        <div style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
          {HEALTHS.map((health) => (
            <RoomCard
              key={health}
              roomId={`room-${health}`}
              peers={3}
              uptime="12m"
              bitrate="1.1 Mbps"
              health={health}
              region="eu-west-3"
              style={{ width: 240 }}
            />
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
        <span className="sl-label">
          LatencyChip — les 5 metriques cablees dans THRESHOLDS (rtt/jitter/loss/nack/freeze),
          chacune avec une valeur sous le seuil &quot;warn&quot; (neutre) et une au-dessus du
          seuil &quot;bad&quot; (rouge). Pas de 6e metrique &quot;bitrate&quot; : THRESHOLDS ne
          contient pas cette cle dans la source, contrairement a ce que les consignes
          suggeraient (cf. rapport).
        </span>
        {METRICS.map(({ metric, unit, below, above }) => (
          <div key={metric} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)' }}>
            <span className="sl-label" style={{ width: 70 }}>
              {metric}
            </span>
            <LatencyChip value={below} unit={unit} metric={metric} label={metric} />
            <LatencyChip value={above} unit={unit} metric={metric} label={metric} />
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)' }}>
          <span className="sl-label" style={{ width: 70 }}>
            plain
          </span>
          <LatencyChip value={80} unit="ms" metric="rtt" plain />
          <LatencyChip value={240} unit="ms" metric="rtt" plain />
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">
          QualityIndicator — les 5 level (excellent/good/degraded/poor/unknown), avec puis sans
          showLabel
        </span>
        <div style={{ display: 'flex', gap: 'var(--space-7)', flexWrap: 'wrap', alignItems: 'center' }}>
          {LEVELS.map((level) => (
            <QualityIndicator key={level} level={level} showLabel />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap', alignItems: 'center' }}>
          {LEVELS.map((level) => (
            <QualityIndicator key={level} level={level} />
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">
          VideoTile — un plein (media de substitution en &lt;div&gt;), un empty, un avec overlay,
          un en ratio=&quot;1/1&quot;
        </span>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 'var(--space-6)',
          }}
        >
          <VideoTile label="a3f91c02" sublabel="38ms" status="live">
            <div style={{ width: '100%', height: '100%', background: 'var(--n-700)' }} />
          </VideoTile>
          <VideoTile empty emptyText="No stream" />
          <VideoTile
            label="d41f9ab7"
            sublabel="212ms"
            status="degraded"
            overlay={<QualityIndicator level="poor" size={12} />}
          >
            <div style={{ width: '100%', height: '100%', background: 'var(--n-700)' }} />
          </VideoTile>
          <VideoTile label="9c0d34aa" sublabel="41ms" status="live" ratio="1/1">
            <div style={{ width: '100%', height: '100%', background: 'var(--n-700)' }} />
          </VideoTile>
        </div>
      </div>
    </div>
  );
}
