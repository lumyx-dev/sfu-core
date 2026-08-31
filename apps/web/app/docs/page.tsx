import { SiteFrame } from "@/components/site/frame";
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Card, CardHeader, CardTitle, CardContent } from '@lumyx/ui';
import { METRICS, DOC_NAV } from "@/lib/docs-data";

export default function DocsPage() {
  return (
    <SiteFrame>
      <div className="mx-auto grid max-w-[1360px] grid-cols-1 items-start gap-10 px-10 py-10 lg:grid-cols-[220px_1fr_200px]">
        <nav className="flex flex-col gap-5 lg:sticky lg:top-8">
          {DOC_NAV.map((sec) => (
            <div key={sec.title} className="flex flex-col gap-1">
              <span className="sl-label pb-1">{sec.title}</span>
              {sec.items.map((it) => (
                <a
                  key={it.id}
                  href={`#${it.id}`}
                  className={`rounded-sm px-2 py-1.5 text-13 no-underline hover:bg-hover hover:no-underline ${
                    "active" in it && it.active ? "bg-active font-medium text-strong" : "text-muted"
                  }`}
                >
                  {it.label}
                </a>
              ))}
            </div>
          ))}
        </nav>

        <main className="flex min-w-0 flex-col gap-8">
          <div className="flex flex-col gap-3">
            <span className="sl-num text-12 text-faint">Docs · Observability · Metrics reference</span>
            <h1 className="text-44 font-semibold tracking-[-0.02em] text-strong text-pretty">Metrics reference</h1>
            <p className="max-w-[680px] text-16 leading-relaxed text-muted text-pretty">
              Six metrics, read from RTCP as the media passes through the SFU. Each one is armed by default with the
              threshold below and a 30s debounce, per peer and — where the scope says so — per room.
            </p>
          </div>

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
              <div className="flex flex-col gap-1 rounded-md border border-subtle bg-sunken px-4 py-3.5">
                {m.sample.map((s) => (
                  <span key={s} className="sl-num whitespace-pre text-[12.5px] text-body">{s}</span>
                ))}
              </div>
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
        </main>

        <aside className="hidden flex-col gap-2 lg:sticky lg:top-8 lg:flex">
          <span className="sl-label pb-1">On this page</span>
          <a href="#thresholds" className="border-l-2 border-accent px-2.5 py-1 text-12 font-medium text-strong no-underline hover:no-underline">Default thresholds</a>
          {METRICS.map((m) => (
            <a key={m.field} href={`#${m.field}`} className="border-l-2 border-hairline px-2.5 py-1 text-12 text-muted no-underline hover:text-strong hover:no-underline">
              {m.name}
            </a>
          ))}
          <a href="#overrides" className="border-l-2 border-hairline px-2.5 py-1 text-12 text-muted no-underline hover:text-strong hover:no-underline">Overriding a threshold</a>
        </aside>
      </div>
    </SiteFrame>
  );
}
