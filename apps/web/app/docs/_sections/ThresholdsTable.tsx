import { Badge, DataTable, type DataTableColumn } from '@lumyx/ui';
import { METRICS, type Metric } from '@/content/metrics';
import s from './ThresholdsTable.module.css';

const COLUMNS: DataTableColumn<Metric>[] = [
  { key: 'name', header: 'Metric', strong: true },
  { key: 'field', header: 'Field', muted: true },
  {
    key: 'threshold',
    header: 'Default threshold',
    align: 'right',
    numeric: true,
    render: (row) => <Badge tone="danger">{row.threshold}</Badge>,
  },
  { key: 'scope', header: 'Scope', muted: true },
];

// Source: Docs.dc.html:78-86 — the "Default thresholds" DataTable, anchored `id="thresholds"`
// because it is also the left nav's "Metrics reference" target and the right rail's first
// scroll-spy anchor.
export function ThresholdsTable() {
  return (
    <div id="thresholds" className={`min-w-0 overflow-hidden ${s.box}`}>
      <div className={`flex items-center gap-2.5 py-3.5 px-5 ${s.head}`}>
        <span className={s.headTitle}>Default thresholds</span>
        <span className="flex-1" />
        <span className={`sl-num ${s.headNote}`}>override per project</span>
      </div>
      <DataTable columns={COLUMNS} rows={METRICS} />
    </div>
  );
}
