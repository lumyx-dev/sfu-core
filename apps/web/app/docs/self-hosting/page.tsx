import Link from "next/link";
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Card } from '@lumyx/ui';
import { DocsLayout, DocSection, CodeBlock } from "@/components/site/docs-layout";

const CHECKLIST = [
  { item: "TLS termination", detail: "Put a reverse proxy in front for wss:// and https:// — the binary speaks plain ws/http." },
  { item: "Persistent storage", detail: "In-memory retention only survives the process. Add Postgres or object storage to keep history past that." },
  { item: "Prometheus scrape", detail: "Point your existing Prometheus at :3000/metrics — see the Prometheus endpoint reference." },
  { item: "Alert destinations", detail: "Wire Slack, PagerDuty or a webhook before traffic arrives, not after the first threshold breach." },
];

export default function SelfHostingPage() {
  return (
    <DocsLayout
      crumb="Docs · Getting started · Self-hosting"
      title="Self-hosting"
      description="One binary, no external dependencies to start. Run it with Docker for a quick deploy, or build from source when you need to vendor it."
      activeId="self-hosting"
      toc={[
        { id: "requirements", label: "Requirements" },
        { id: "docker", label: "Run with Docker" },
        { id: "source", label: "Build from source" },
        { id: "config", label: "Configuration" },
        { id: "checklist", label: "Production checklist" },
      ]}
    >
      <DocSection id="requirements" title="Requirements">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>To run the image</TableHead><TableHead>To build from source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="text-body">Docker or any OCI runtime</TableCell>
                <TableCell className="text-body">Rust 1.79+</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted">No external services required</TableCell>
                <TableCell className="text-muted">No CGO boundary — pure Rust in the media path</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      </DocSection>

      <DocSection id="docker" title="Run with Docker">
        <CodeBlock
          lines={[
            "docker run -p 3000:3000 \\",
            "  ghcr.io/frekimanagarm/lumyx:latest",
            "",
            "# signaling  ws://127.0.0.1:3000/ws",
            "# dashboard  http://127.0.0.1:3000",
          ]}
        />
        <p className="max-w-[680px] text-13 text-muted text-pretty">
          Scale it out when you actually need to — a single process handles a room until concurrent peers or egress
          say otherwise.
        </p>
      </DocSection>

      <DocSection id="source" title="Build from source">
        <CodeBlock
          lines={[
            "cargo add lumyx-sfu",
            "",
            "# or run the workspace binary",
            "cargo run -p lumyx-sfu --release",
          ]}
        />
        <p className="max-w-[680px] text-13 text-muted text-pretty">
          Rust 1.79+. The media path has no GC and no CGO boundary, so a release build behaves the same on your
          hardware as it does in the published image.
        </p>
      </DocSection>

      <DocSection id="config" title="Configuration">
        <p className="max-w-[680px] text-14 leading-relaxed text-body text-pretty">
          Thresholds, alert destinations and remediation live in <code>lumyx.toml</code> next to the binary. Nothing
          in it is required to start — every metric below already has a sane default.
        </p>
        <CodeBlock
          lines={[
            "# Thresholds are yours. These are the defaults.",
            "",
            "[alerts.packet_loss]",
            "above = 0.02",
            'sustained_for = "30s"',
            'severity = "breached"',
            'notify = ["slack:#oncall", "pagerduty"]',
            "",
            "[remediation]",
            "auto_audio_only = true",
          ]}
        />
        <p className="max-w-[680px] text-13 text-muted text-pretty">
          Full field reference: <Link href="/docs/metrics-reference" className="text-accent no-underline hover:no-underline">Metrics reference</Link>.
        </p>
      </DocSection>

      <DocSection id="checklist" title="Production checklist">
        <div className="flex flex-col divide-y divide-hairline rounded-md border border-subtle">
          {CHECKLIST.map((c) => (
            <div key={c.item} className="flex flex-col gap-1 px-4 py-3.5">
              <div className="flex items-center gap-2">
                <Badge tone="accent">{c.item}</Badge>
              </div>
              <span className="max-w-[600px] text-13 leading-relaxed text-muted text-pretty">{c.detail}</span>
            </div>
          ))}
        </div>
      </DocSection>
    </DocsLayout>
  );
}
