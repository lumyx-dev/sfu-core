import Link from "next/link";
import { SiteFrame } from "@/components/site/frame";
import { SectionHead } from "@/components/site/chrome";
import { Button } from '@lumyx/ui';
import { COMPARE_ROWS, REPO } from "@/lib/site-data";

const MIGRATION = [
  ["Signaling messages", "sfu_offer, sfu_answer, ICE trickle — the same names on the wire."],
  ["Token grants", "publish / subscribe, same shape. Sign with your Sightline secret key."],
  ["Client SDKs", "Unchanged. Point the Room at the new URL and connect."],
  ["What you gain", "Six metrics per peer with thresholds attached, and one binary to run."],
] as [string, string][];

export default function ComparePage() {
  return (
    <SiteFrame>
      <section className="border-b border-hairline">
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-start gap-10 px-10 py-20 lg:grid-cols-[180px_1fr]">
          <SectionHead index="01" label="Coming from LiveKit" blurb="Comparison of architectural defaults, not of feature counts." />
          <div className="flex flex-col gap-6">
            <h1 className="max-w-[620px] text-[40px] font-semibold leading-[1.1] tracking-[-0.03em] text-strong text-pretty">
              Same signaling. Different priorities.
            </h1>
            <div className="overflow-hidden rounded-lg border border-hairline bg-card">
              <div className="grid grid-cols-[1.1fr_1fr_1fr] border-b border-subtle bg-sunken">
                <span className="sl-label px-5 py-3.5">Architectural default</span>
                <span className="sl-label px-5 py-3.5 text-accent-text">Sightline</span>
                <span className="sl-label px-5 py-3.5">Typical Go SFU stack</span>
              </div>
              {COMPARE_ROWS.map((r) => (
                <div key={r.label} className="grid grid-cols-[1.1fr_1fr_1fr] border-b border-subtle">
                  <span className="px-5 py-[15px] text-13 font-medium text-strong">{r.label}</span>
                  <span className="bg-accent-tint px-5 py-[15px] text-13 text-body">{r.ours}</span>
                  <span className="px-5 py-[15px] text-13 text-muted">{r.theirs}</span>
                </div>
              ))}
              <div className="px-5 py-3.5">
                <span className="text-12 text-faint text-pretty">
                  Corrections welcome as a PR — <a href={REPO}>open one on the repo</a>.
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-start gap-10 px-10 py-20 lg:grid-cols-[180px_1fr]">
          <SectionHead index="02" label="Migrating" blurb="One URL changes. Nothing else has to." />
          <div className="flex flex-col gap-6">
            <div className="overflow-hidden rounded-lg border border-hairline bg-card">
              <div className="flex items-center gap-2.5 border-b border-subtle px-5 py-3.5">
                <span className="sl-label">Config diff</span>
              </div>
              <div className="flex flex-col gap-1.5 px-5 py-4">
                <span className="whitespace-pre-wrap text-13 text-danger">- url: wss://my-app.livekit.cloud</span>
                <span className="whitespace-pre-wrap text-13 text-ok">+ url: wss://live-classroom.eu-west-3.sightline.cloud/ws</span>
                <span className="whitespace-pre-wrap text-13 text-muted">{"// client code unchanged"}</span>
                <span className="whitespace-pre-wrap text-13 text-body">const room = new Room();</span>
                <span className="whitespace-pre-wrap text-13 text-body">await room.connect(url, token);</span>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              {MIGRATION.map(([k, v]) => (
                <div key={k} className="flex flex-col gap-2 border-t border-hairline pt-4">
                  <span className="text-13 font-semibold text-strong">{k}</span>
                  <span className="text-[12.5px] leading-relaxed text-muted text-pretty">{v}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" asChild><Link href="/signup" className="no-underline hover:no-underline">Get started free</Link></Button>
              <Button asChild><Link href="/docs" className="no-underline hover:no-underline">Read the docs</Link></Button>
            </div>
          </div>
        </div>
      </section>
    </SiteFrame>
  );
}
