import { Badge, DataTable, type DataColumn } from '@lumyx/ui';
import { METRICS, type Metric } from '@/content/metrics';

const COLUMNS: DataColumn<Metric>[] = [
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
    <div
      id="thresholds"
      className="min-w-0 overflow-hidden border border-border rounded-card bg-card"
    >
      <div className="flex items-center gap-2.5 py-3.5 px-5 border-b border-border-subtle">
        <span className="text-[14px] font-semibold tracking-[-0.01em] text-strong">
          Default thresholds
        </span>
        <span className="flex-1" />
        <span className="sl-num text-12 text-faint">override per project</span>
      </div>
      <DataTable columns={COLUMNS} rows={METRICS} />
    </div>
  );
}
