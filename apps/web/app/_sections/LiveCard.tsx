import { DataTable, LatencyChip, QualityIndicator, StatusDot, TimeSeriesChart } from '@sightline/ui';
import type { DataTableColumn } from '@sightline/ui';
import { HERO_PEERS, series, type HeroPeer } from '@/content/home';
import s from './LiveCard.module.css';

// Source: Home.dc.html:113-141 — the top of the `#observability` card (header + the
// bitrate-chart/peers-table row) only. The brief scopes this task's LiveCard to that much; the
// metric row (:124-130) and the topology diagram + legend (:142-180) are not requested by
// Step 5 and are left for the full Observability section. See task-6-report.md.
const CHART_LABELS = ['13:36', '13:43', '13:50', '13:57', '14:06'];

const heroPeerCols: DataTableColumn<HeroPeer>[] = [
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
    <section className="relative" style={{ background: 'var(--surface-page)' }}>
      <span aria-hidden className={s.band} />
      <div className="relative mx-auto max-w-[1280px] px-5 pb-18 md:px-6 lg:px-10">
        <div data-anim="rise" data-anim-now data-anim-delay="420" className={`${s.card} -mt-2`}>
          <div className={s.header}>
            <StatusDot status="live" />
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
        </div>
      </div>
    </section>
  );
}
