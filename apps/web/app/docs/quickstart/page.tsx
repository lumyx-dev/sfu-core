import Link from "next/link";
import { Card, CardContent } from '@lumyx/ui';
import { DocsLayout, DocSection, CodeBlock } from "@/components/site/docs-layout";

export default function QuickstartPage() {
  return (
    <DocsLayout
      crumb="Docs · Getting started · Quickstart"
      title="Quickstart"
      description="One command to run the SFU, one to connect a client. No account, no config file — everything below runs on your machine."
      activeId="quickstart"
      toc={[
        { id: "run", label: "Run the SFU" },
        { id: "connect", label: "Connect a client" },
        { id: "watch", label: "Watch the metrics arrive" },
        { id: "next", label: "Next steps" },
      ]}
    >
      <DocSection id="run" title="Run the SFU">
        <p className="max-w-[680px] text-14 leading-relaxed text-body text-pretty">
          The image ships as a single static binary — signaling, forwarding, the collector and the dashboard all
          start together.
        </p>
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
          No Redis, no separate signaling service, no sidecar to scrape. Building from source instead is covered on{" "}
          <Link href="/docs/self-hosting" className="text-accent no-underline hover:no-underline">Self-hosting</Link>.
        </p>
      </DocSection>

      <DocSection id="connect" title="Connect a client">
        <p className="max-w-[680px] text-14 leading-relaxed text-body text-pretty">
          Client SDKs and signaling messages match LiveKit&apos;s, so the same room object works — only the URL
          changes.
        </p>
        <CodeBlock
          lines={[
            "const room = await connect(\"ws://127.0.0.1:3000/ws\", token);",
            "",
            "room.on(\"quality\", (peer, m) => {",
            "  if (m.packet_loss_ratio > 0.02) {",
            "    room.setSubscription(peer.id, { video: false });",
            "  }",
            "});",
          ]}
        />
        <p className="max-w-[680px] text-13 text-muted text-pretty">
          Every metric the collector reads off RTCP reaches the client on the same <code>quality</code> event —
          nothing extra to wire up.
        </p>
      </DocSection>

      <DocSection id="watch" title="Watch the metrics arrive">
        <p className="max-w-[680px] text-14 leading-relaxed text-body text-pretty">
          Open <code>http://127.0.0.1:3000</code> once a peer has connected. The dashboard shows the room, its
          peers, and all six metrics updating live — packet loss, RTT, jitter, NACK ratio, freeze ratio and bitrate
          — each already armed with a default threshold and a 30s debounce.
        </p>
        <Card>
          <CardContent className="flex flex-col gap-1">
            {[
              "lumyx 0.4.1 · MIT",
              "listening on :3000 · dashboard on :3000",
              "metrics collector armed · 6 metrics · 500ms",
              "0 rooms · 0 peers",
            ].map((l, i) => (
              <span key={i} className="sl-num whitespace-pre text-[12.5px] text-body">{l}</span>
            ))}
          </CardContent>
        </Card>
      </DocSection>

      <DocSection id="next" title="Next steps">
        <ul className="flex max-w-[680px] flex-col gap-2 text-14 leading-relaxed text-body">
          <li>
            <Link href="/docs/metrics-reference" className="text-accent no-underline hover:no-underline">Metrics reference</Link>
            {" "}— what each threshold breach means and how to respond.
          </li>
          <li>
            <Link href="/docs/self-hosting" className="text-accent no-underline hover:no-underline">Self-hosting</Link>
            {" "}— run it in production, with a persistent config.
          </li>
          <li>
            <Link href="/docs/cloud" className="text-accent no-underline hover:no-underline">Lumyx Cloud</Link>
            {" "}— skip infra entirely and get a project URL in one command.
          </li>
        </ul>
      </DocSection>
    </DocsLayout>
  );
}
