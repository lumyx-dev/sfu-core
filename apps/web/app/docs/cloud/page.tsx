import Link from "next/link";
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Card } from '@lumyx/ui';
import { DocsLayout, DocSection, CodeBlock } from "@/components/site/docs-layout";
import { PLANS } from "@/lib/site-data";

export default function CloudPage() {
  return (
    <DocsLayout
      crumb="Docs · Getting started · Lumyx Cloud"
      title="Lumyx Cloud"
      description="Same SFU, same signaling, hosted. Cloud sells operation — regions, quotas, retention and per-environment keys — not features held back from the MIT repo."
      activeId="cloud"
      toc={[
        { id: "create", label: "Create a project" },
        { id: "regions", label: "Regions" },
        { id: "plans", label: "Plans" },
        { id: "moving", label: "Moving between Cloud and self-hosted" },
      ]}
    >
      <DocSection id="create" title="Create a project">
        <CodeBlock
          lines={[
            "npx lumyx@latest init live-classroom \\",
            "  --region eu-west-3",
            "",
            "# → wss://live-classroom.eu-west-3.lumyx.cloud/ws",
            "# → sk_live_… (shown once)",
          ]}
        />
        <p className="max-w-[680px] text-13 text-muted text-pretty">
          Free tier: 10,000 participant-minutes/month, no card required. The URL and key are the only two things
          your client needs — same SDK as{" "}
          <Link href="/docs/quickstart" className="text-accent no-underline hover:no-underline">Quickstart</Link>.
        </p>
      </DocSection>

      <DocSection id="regions" title="Regions">
        <p className="max-w-[680px] text-14 leading-relaxed text-body text-pretty">
          A project pins a home region — <code>eu-west-3</code> above, <code>ap-south-1</code> is another — and how
          many regions you can run concurrently is set by plan: 2 on Starter, 4 on Scale, dedicated regions on
          Business. Self-hosted has no such limit; it runs wherever you put the binary.
        </p>
      </DocSection>

      <DocSection id="plans" title="Plans">
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead><TableHead>Price</TableHead><TableHead>Included</TableHead><TableHead>Who it&apos;s for</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PLANS.monthly.map((p) => (
                <TableRow key={p.name}>
                  <TableCell className="font-medium text-strong">
                    {p.name}
                    {p.featured ? <Badge tone="accent" className="ml-2">Popular</Badge> : null}
                  </TableCell>
                  <TableCell className="sl-num text-body">{p.price}{p.per ? ` ${p.per}` : ""}</TableCell>
                  <TableCell className="text-muted">{p.headline}</TableCell>
                  <TableCell className="text-muted">{p.who}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
        <p className="max-w-[680px] text-13 text-muted text-pretty">
          Full feature-by-feature breakdown, including egress, retention and support SLAs, is on{" "}
          <Link href="/pricing" className="text-accent no-underline hover:no-underline">Pricing</Link>.
        </p>
      </DocSection>

      <DocSection id="moving" title="Moving between Cloud and self-hosted">
        <p className="max-w-[680px] text-14 leading-relaxed text-body text-pretty">
          Signaling and token grants are identical in both, so switching is a URL change — point clients at your own
          host instead of <code>*.lumyx.cloud</code>, no client code to rewrite. Metrics history can be exported as
          CSV before you leave, from either the dashboard or the REST API.
        </p>
      </DocSection>
    </DocsLayout>
  );
}
