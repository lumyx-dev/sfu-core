import { Badge } from '@sightline/ui';
import type { Metric } from '@/content/metrics';
import s from './MetricSection.module.css';

// Source: Docs.dc.html:89-117 — one section per metric, anchored `id={metric.field}`. The
// field renders as a machine identifier — plain, never prettified (task-10-brief.md, "Global
// constraints").
export function MetricSection({ metric }: { metric: Metric }) {
  return (
    <section id={metric.field} className={s.section}>
      <div className={s.heading}>
        <h2 className={s.title}>{metric.name}</h2>
        <span className={`sl-num ${s.field}`}>{metric.field}</span>
        <span className={s.headingSpacer} />
        <Badge tone="danger">{metric.threshold}</Badge>
      </div>
      <p className={s.body}>{metric.body}</p>
      <div className={s.grid}>
        <div className={s.cell}>
          <span className="sl-label">Unit</span>
          <span className={`sl-num ${s.cellValue}`}>{metric.unit}</span>
        </div>
        <div className={s.cell}>
          <span className="sl-label">Scope</span>
          <span className={`sl-num ${s.cellValue}`}>{metric.scope}</span>
        </div>
        <div className={s.cell}>
          <span className="sl-label">What it breaks</span>
          <span className={s.breaks}>{metric.breaks}</span>
        </div>
      </div>
      <div className={s.sample}>
        {metric.sample.map((line, i) => (
          <span key={i} className={s.sampleLine}>
            {line}
          </span>
        ))}
      </div>
      <span className={s.action}>{metric.action}</span>
    </section>
  );
}
