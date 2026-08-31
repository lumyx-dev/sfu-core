import { Badge } from '@lumyx/ui';
import type { Metric } from '@/content/metrics';
import s from './MetricSection.module.css';

// Source: Docs.dc.html:89-117 — one section per metric, anchored `id={metric.field}`. The
// field renders as a machine identifier — plain, never prettified (task-10-brief.md, "Global
// constraints").
export function MetricSection({ metric }: { metric: Metric }) {
  return (
    <section id={metric.field} className={`flex flex-col gap-3.5 pt-3 ${s.section}`}>
      <div className="flex items-baseline gap-3 flex-wrap">
        <h2 className={s.title}>{metric.name}</h2>
        <span className={`sl-num ${s.field}`}>{metric.field}</span>
        <span className="flex-1" />
        <Badge tone="danger">{metric.threshold}</Badge>
      </div>
      <p className={s.body}>{metric.body}</p>
      <div className={`grid gap-px overflow-hidden ${s.grid}`}>
        <div className={`flex flex-col gap-1 py-3 px-3.5 ${s.cell}`}>
          <span className="sl-label">Unit</span>
          <span className={`sl-num ${s.cellValue}`}>{metric.unit}</span>
        </div>
        <div className={`flex flex-col gap-1 py-3 px-3.5 ${s.cell}`}>
          <span className="sl-label">Scope</span>
          <span className={`sl-num ${s.cellValue}`}>{metric.scope}</span>
        </div>
        <div className={`flex flex-col gap-1 py-3 px-3.5 ${s.cell}`}>
          <span className="sl-label">What it breaks</span>
          <span className={s.breaks}>{metric.breaks}</span>
        </div>
      </div>
      <div className={`flex flex-col gap-[5px] py-3.5 px-4 ${s.sample}`}>
        {metric.sample.map((line, i) => (
          <span key={i} className={`whitespace-pre-wrap ${s.sampleLine}`}>
            {line}
          </span>
        ))}
      </div>
      <span className={s.action}>{metric.action}</span>
    </section>
  );
}
