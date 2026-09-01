import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Card, CardHeader, CardTitle, CardContent } from '@lumyx/ui';
import { DocsLayout, CodeBlock } from "@/components/site/docs-layout";
import { METRICS } from "@/lib/docs-data";

export default function MetricsReferencePage() {
  return (
    <DocsLayout
      crumb="Docs · Observability · Metrics reference"
      title="Metrics reference"
      description="Six metrics, read from RTCP as the media passes through the SFU. Each one is armed by default with the threshold below and a 30s debounce, per peer and — where the scope says so — per room."
      activeId="metrics-reference"
      toc={[
        { id: "thresholds", label: "Default thresholds" },
        ...METRICS.map((m) => ({ id: m.field, label: m.name })),
        { id: "overrides", label: "Overriding a threshold" },
      ]}
    >
      <Card id="thresholds" className="overflow-hidden">
        <CardHeader><CardTitle>Default thresholds</CardTitle></CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Metric</TableHead><TableHead>Field</TableHead><TableHead>Unit</TableHead>
              <TableHead>Threshold</TableHead><TableHead>Scope</TableHead><TableHead>What it breaks</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {METRICS.map((m) => (
              <TableRow key={m.field}>
                <TableCell className="font-medium text-strong">{m.name}</TableCell>
                <TableCell className="sl-num text-muted">{m.field}</TableCell>
                <TableCell className="text-muted">{m.unit}</TableCell>
                <TableCell className="sl-num font-medium text-strong">{m.threshold}</TableCell>
                <TableCell className="text-muted">{m.scope}</TableCell>
                <TableCell className="text-muted">{m.breaks}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {METRICS.map((m) => (
        <section key={m.field} id={m.field} className="flex flex-col gap-3 border-t border-hairline pt-8">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-26 font-semibold tracking-[-0.02em] text-strong">{m.name}</h2>
            <Badge tone="accent" className="sl-num">{m.field}</Badge>
            <Badge className="sl-num">threshold {m.threshold}</Badge>
          </div>
          <p className="max-w-[680px] text-14 leading-relaxed text-body text-pretty">{m.body}</p>
          <CodeBlock lines={m.sample} />
          <p className="max-w-[680px] text-13 text-muted text-pretty">{m.action}</p>
        </section>
      ))}

      <section id="overrides" className="flex flex-col gap-3 border-t border-hairline pt-8">
        <h2 className="text-26 font-semibold tracking-[-0.02em] text-strong">Overriding a threshold</h2>
        <p className="max-w-[680px] text-14 leading-relaxed text-body text-pretty">
          Thresholds live per project and per environment since v0.4.0. Set one and it applies to every room in that
          environment; alerts still debounce for 30s before firing.
        </p>
        <Card>
          <CardContent className="flex flex-col gap-1">
            {[
              "PATCH /v1/projects/live-classroom/thresholds",
              "",
              '{ "packet_loss_ratio": 0.03,',
              '  "rtt_ms": 250 }',
            ].map((l, i) => (
              <span key={i} className="sl-num whitespace-pre text-[12.5px] text-body">{l}</span>
            ))}
          </CardContent>
        </Card>
      </section>
    </DocsLayout>
  );
}
