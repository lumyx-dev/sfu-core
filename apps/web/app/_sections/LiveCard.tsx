import {
  DataTable,
  LatencyChip,
  MetricCard,
  MetricGrid,
  Pill,
  QualityIndicator,
  StatusDot,
  TimeSeriesChart,
} from '@lumyx/ui';
import type { DataColumn } from '@lumyx/ui';
import { HERO_PEERS, TOPO_LEGEND, series, type HeroPeer } from '@/content/home';
import s from './LiveCard.module.css';

// Source: Home.dc.html:113-181 — the full `#observability` card (header, metric row, bitrate
// chart + peers table, room topology + legend). This is the one card the source has; it belongs
// entirely to this task (see task-6-report.md fix log — an earlier pass had wrongly scoped this
// down to just the header and the middle row).
const CHART_LABELS = ['13:36', '13:43', '13:50', '13:57', '14:06'];

const heroPeerCols: DataColumn<HeroPeer>[] = [
  {
    key: 'peerId',
    header: 'Peer',
    strong: true,
    render: (r) => (
      <span className="inline-flex items-center gap-2">
        <StatusDot status={r.status} size={6} halo={false} />
        {r.peerId}
      </span>
    ),
  },
  {
    key: 'quality',
    header: 'Quality',
    render: (r) => <QualityIndicator score={r.score} />,
  },
  {
    key: 'rtt',
    header: 'RTT',
    numeric: true,
    align: 'right',
    render: (r) => <LatencyChip value={r.rtt} metric="rtt" plain />,
  },
  {
    key: 'loss',
    header: 'Loss',
    numeric: true,
    align: 'right',
    render: (r) => <LatencyChip value={r.loss} metric="loss" unit="%" plain />,
  },
];

export function LiveCard() {
  return (
    <section id="observability" className="relative" style={{ background: 'var(--surface-page)' }}>
      <span aria-hidden className={s.band} />
      <div className="relative mx-auto max-w-[1280px] px-5 pb-18 md:px-6 lg:px-10">
        <div data-anim="rise" data-anim-now data-anim-delay="420" className={`${s.card} -mt-2`}>
          <div className={s.header}>
            <StatusDot status="live" />
            <span className={s.roomName}>live-classroom</span>
            <span className={`sl-num ${s.roomMeta}`}>eu-west-3 · 6 peers · 2.4 Mbps · up 2h 14m</span>
            <span className="flex-1" />
            <Pill status="connected">Live</Pill>
          </div>

          <div className={s.metricGrid}>
            <MetricGrid columns={5}>
              <MetricCard
                label="Round-trip time"
                value={38}
                unit="ms"
                sublabel="p50 · threshold 200ms"
              />
              <MetricCard label="Jitter" value={11} unit="ms" sublabel="threshold 30ms" />
              <MetricCard label="Packet loss" value="0.20" unit="%" sublabel="threshold 2%" />
              <MetricCard
                label="NACK ratio"
                value="6.20"
                unit="%"
                status="error"
                sublabel="threshold 5%"
              />
              <MetricCard
                label="Freeze ratio"
                value="1.40"
                unit="%"
                status="warn"
                sublabel="threshold 1%"
              />
            </MetricGrid>
          </div>

          <div className={s.body}>
            <div className={s.chartCol}>
              <span className="sl-label">Bitrate per peer — last 30 minutes</span>
              <TimeSeriesChart
                height={190}
                unit="kbps"
                labels={CHART_LABELS}
                series={[
                  { name: 'a3f91c02', data: series(60, 2, 2400, 260) },
                  { name: 'ff104b2c', data: series(60, 6, 900, 420), tone: 'warn', fill: false },
                ]}
              />
            </div>
            <div className={s.tableCol}>
              <div className="px-5 pt-4.5 pb-2.5">
                <span className="sl-label">Peers — worst first</span>
              </div>
              <DataTable dense columns={heroPeerCols} rows={HERO_PEERS} />
            </div>
          </div>

          <div className={s.topoRow}>
            <div className={s.topoCell}>
              <svg viewBox="0 0 620 280" style={{ width: '100%', height: 230, display: 'block' }}>
                <g fill="none">
                  <line x1={310} y1={140} x2={120} y2={58} stroke="var(--series-1)" strokeWidth={3} opacity={0.55} />
                  <line x1={310} y1={140} x2={500} y2={58} stroke="var(--series-1)" strokeWidth={2} opacity={0.55} />
                  <line x1={310} y1={140} x2={80} y2={196} stroke="var(--series-1)" strokeWidth={4} opacity={0.55} />
                  <line
                    x1={310}
                    y1={140}
                    x2={540}
                    y2={196}
                    stroke="var(--danger-solid)"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    style={{ animation: 'sl-dash 1.6s linear infinite' }}
                  />
                  <line x1={310} y1={140} x2={230} y2={248} stroke="var(--series-1)" strokeWidth={2} opacity={0.55} />
                  <line x1={310} y1={140} x2={400} y2={248} stroke="var(--warn-solid)" strokeWidth={3} opacity={0.8} />
                  <g stroke="var(--accent)" strokeWidth={3} strokeLinecap="round" strokeDasharray="14 326">
                    <line x1={120} y1={58} x2={310} y2={140} style={{ animation: 'sl-beam 2.4s linear infinite' }} />
                    <line
                      x1={80}
                      y1={196}
                      x2={310}
                      y2={140}
                      style={{ animation: 'sl-beam 2.9s linear infinite 0.5s' }}
                    />
                    <line
                      x1={500}
                      y1={58}
                      x2={310}
                      y2={140}
                      style={{ animation: 'sl-beam 3.3s linear infinite 1.1s' }}
                    />
                    <line
                      x1={230}
                      y1={248}
                      x2={310}
                      y2={140}
                      style={{ animation: 'sl-beam 2.7s linear infinite 1.6s' }}
                    />
                  </g>
                </g>
                <rect
                  x={256}
                  y={112}
                  width={108}
                  height={56}
                  rx={14}
                  fill="var(--surface-card)"
                  stroke="var(--accent-border)"
                  strokeWidth={1.5}
                />
                <text
                  x={310}
                  y={135}
                  textAnchor="middle"
                  fontFamily="Geist,system-ui"
                  fontSize={12.5}
                  fontWeight={600}
                  fill="var(--text-strong)"
                >
                  SFU
                </text>
                <text
                  x={310}
                  y={152}
                  textAnchor="middle"
                  fontFamily="Geist,system-ui"
                  fontSize={10.5}
                  fill="var(--text-muted)"
                >
                  forwarding · 6
                </text>
                <g fontFamily="Geist,system-ui" fontSize={10.5} fill="var(--text-body)" textAnchor="middle">
                  <circle cx={120} cy={58} r={27} fill="var(--surface-card)" stroke="var(--border-strong)" />
                  <text x={120} y={62}>a3f91c02</text>
                  <circle cx={500} cy={58} r={27} fill="var(--surface-card)" stroke="var(--border-strong)" />
                  <text x={500} y={62}>0b8e2f61</text>
                  <circle cx={80} cy={196} r={27} fill="var(--surface-card)" stroke="var(--border-strong)" />
                  <text x={80} y={200}>5e7b21f4</text>
                  <circle cx={540} cy={196} r={27} fill="var(--danger-tint)" stroke="var(--danger-solid)" />
                  <text x={540} y={200}>d41f9ab7</text>
                  <circle cx={230} cy={248} r={27} fill="var(--surface-card)" stroke="var(--border-strong)" />
                  <text x={230} y={252}>9c0d34aa</text>
                  <circle cx={400} cy={248} r={27} fill="var(--warn-tint)" stroke="var(--warn-solid)" />
                  <text x={400} y={252}>2f81be07</text>
                </g>
              </svg>
            </div>
            <div className={s.legendCol}>
              {TOPO_LEGEND.map((t) => (
                <div key={t.title} className={s.legendItem}>
                  <span className={s.legendTitle}>{t.title}</span>
                  <span className={s.legendBody}>{t.body}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className={s.disclaimer}>
          Real fields, real thresholds, mock traffic. This is the dashboard that ships with the
          SFU — not a picture of one.
        </p>
      </div>
    </section>
  );
}
