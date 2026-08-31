import { Badge } from '@lumyx/ui';
import type { Metric } from '@/content/metrics';

// Source: Docs.dc.html:89-117 — one section per metric, anchored `id={metric.field}`. The
// field renders as a machine identifier — plain, never prettified (task-10-brief.md, "Global
// constraints").
export function MetricSection({ metric }: { metric: Metric }) {
  return (
    <section id={metric.field} className="flex flex-col gap-3.5 pt-3 border-t border-border">
      <div className="flex items-baseline gap-3 flex-wrap">
        <h2 className="m-0 text-[22px] font-semibold tracking-[-0.02em] text-strong">
          {metric.name}
        </h2>
        <span className="sl-num text-13 text-muted">{metric.field}</span>
        <span className="flex-1" />
        <Badge tone="danger">{metric.threshold}</Badge>
      </div>
      <p className="m-0 text-[14px] leading-body text-body [text-wrap:pretty]">{metric.body}</p>
      <div className="grid gap-px overflow-hidden grid-cols-1 sm:grid-cols-3 bg-border-subtle border border-border rounded-tile">
        <div className="flex flex-col gap-1 py-3 px-3.5 bg-card">
          <span className="sl-label">Unit</span>
          <span className="sl-num text-13 text-strong">{metric.unit}</span>
        </div>
        <div className="flex flex-col gap-1 py-3 px-3.5 bg-card">
          <span className="sl-label">Scope</span>
          <span className="sl-num text-13 text-strong">{metric.scope}</span>
        </div>
        <div className="flex flex-col gap-1 py-3 px-3.5 bg-card">
          <span className="sl-label">What it breaks</span>
          <span className="text-[12.5px] text-body [text-wrap:pretty]">{metric.breaks}</span>
        </div>
      </div>
      <div className="flex flex-col gap-[5px] py-3.5 px-4 border border-border rounded-tile bg-sunken">
        {metric.sample.map((line, i) => (
          <span key={i} className="whitespace-pre-wrap text-[12.5px] leading-body text-body">
            {line}
          </span>
        ))}
      </div>
      <span className="text-[12.5px] leading-body text-muted [text-wrap:pretty]">
        {metric.action}
      </span>
    </section>
  );
}
