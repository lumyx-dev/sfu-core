import Link from "next/link";
import { Button, Badge, MetricCard, MetricGrid } from '@lumyx/ui';
import { SiteHeader, DarkBand, SectionHead } from "@/components/site/chrome";
import { QuickStart, LiveConsole } from "@/components/site/hero-console";
import { MARQUEE, PAINS, COMPARE_ROWS, REPO } from "@/lib/site-data";
import { PricingBlock } from "@/components/site/pricing-block";
import { SiteFooter } from "@/components/site/chrome";

export default function HomePage() {
  return (
    <>
      {/* Hero band: a dark scope, not a dark-mode branch. */}
      <DarkBand className="relative overflow-hidden">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            backgroundImage: "radial-gradient(var(--n-700) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            maskImage: "radial-gradient(130% 78% at 26% 0%, #000 26%, transparent 74%)",
            WebkitMaskImage: "radial-gradient(130% 78% at 26% 0%, #000 26%, transparent 74%)",
          }}
        />
        <SiteHeader />

        <section id="top" className="relative mx-auto grid max-w-[1280px] grid-cols-1 items-start gap-14 px-10 pt-[84px] lg:grid-cols-[1.05fr_1fr]">
          <div className="flex flex-col gap-6">
            <span className="sl-label text-accent-text">Open-source WebRTC infrastructure</span>
            <h1 className="text-[62px] font-semibold leading-[1.02] tracking-[-0.035em] text-strong text-pretty">
              The WebRTC SFU that tells you<br />why the call was bad.
            </h1>
            <p className="max-w-[520px] text-[17px] leading-relaxed text-muted text-pretty">
              A Rust SFU for teams shipping real video products — not AI voice agents. Selective forwarding, and
              observability in the media path: jitter, packet loss, RTT, NACK ratio, per peer, per room, live.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" variant="primary" asChild>
                <Link href="/signup" className="no-underline hover:no-underline">Get started free</Link>
              </Button>
              <a href={REPO} className="inline-flex h-[42px] items-center rounded-sm border border-stroke px-[18px] text-[13.5px] font-medium text-strong no-underline hover:bg-hover hover:no-underline">
                View on GitHub
              </a>
            </div>
          </div>
          <QuickStart />
        </section>

        {/* Field names, not labels — this is the raw metric vocabulary. */}
        <div
          aria-hidden
          className="relative mt-14 overflow-hidden border-t border-subtle pb-[30px] pt-4"
          style={{
            maskImage: "linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent)",
            WebkitMaskImage: "linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent)",
          }}
        >
          <div className="flex w-max animate-[sl-marquee_38s_linear_infinite]">
            {[0, 1].map((dup) =>
              MARQUEE.map((m) => (
                <span key={dup + m} className="sl-num inline-flex items-center gap-2.5 whitespace-nowrap px-[26px] text-13 text-faint">
                  {m}<span className="size-1 rounded-pill bg-accent" />
                </span>
              ))
            )}
          </div>
        </div>
      </DarkBand>

      <section id="observability" className="relative bg-page">
        <span aria-hidden className="absolute inset-x-0 top-0 h-[120px] bg-[var(--n-900)]" />
        <div className="relative mx-auto max-w-[1280px] px-10 pb-[72px]">
          <LiveConsole />
          <p className="mt-3.5 text-[12.5px] text-faint text-pretty">
            Real fields, real thresholds, mock traffic. This is the dashboard that ships with the SFU — not a picture of one.
          </p>
        </div>
      </section>

      <section id="why" className="border-t border-hairline bg-card">
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-start gap-10 px-10 py-20 lg:grid-cols-[180px_1fr]">
          <SectionHead index="01" label="Why Sightline" blurb="Three things that hurt in production, and what replaces them." />
          <div className="flex flex-col gap-11">
            {PAINS.map((p, i) => (
              <div key={p.index} className="grid grid-cols-1 items-center gap-11 border-b border-hairline pb-11 lg:grid-cols-2">
                <div className={`flex flex-col gap-3.5 ${i === 1 ? "lg:order-2" : ""}`}>
                  <span className="sl-num text-12 text-faint">{p.index}</span>
                  <h2 className="text-34 font-semibold leading-[1.12] tracking-[-0.03em] text-strong text-pretty">{p.headline}</h2>
                  <p className="max-w-[460px] text-14 leading-relaxed text-muted text-pretty">{p.body}</p>
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    {p.chips.map((c) => (
                      <span key={c} className="sl-num inline-flex h-[26px] items-center rounded-pill border border-hairline bg-page px-[11px] text-12 text-body">{c}</span>
                    ))}
                  </div>
                </div>
                <div className={`min-w-0 ${i === 1 ? "lg:order-1" : ""}`}>
                  {p.proof ? <ProofTable label={p.proof.label} badge={p.proof.badge} rows={p.proof.rows} muteLast={i === 2} /> : <AlertProof />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <DarkBand id="compare" className="border-t border-hairline">
        <section className="mx-auto grid max-w-[1280px] grid-cols-1 items-start gap-10 px-10 py-20 lg:grid-cols-[180px_1fr]">
          <div className="flex flex-col gap-2">
            <span className="sl-num text-12 text-faint">02</span>
            <span className="sl-label">Coming from LiveKit</span>
          </div>
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-end gap-6">
              <h2 className="max-w-[620px] text-[40px] font-semibold leading-[1.1] tracking-[-0.03em] text-strong text-pretty">
                Same signaling. Different priorities.
              </h2>
              <span className="flex-1" />
              <Link href="/compare" className="text-13 font-medium">See the full comparison →</Link>
            </div>
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
                  Comparison of architectural defaults, not of feature counts. Corrections welcome as a PR.
                </span>
              </div>
            </div>
          </div>
        </section>
      </DarkBand>

      <section id="pricing" className="border-t border-hairline">
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-start gap-10 px-10 py-20 lg:grid-cols-[180px_1fr]">
          <SectionHead index="03" label="Pricing" blurb="Free forever self-hosted. Per participant-minute on Cloud." />
          <PricingBlock />
        </div>
      </section>

      <DarkBand className="border-t border-hairline">
        <section className="mx-auto grid max-w-[1280px] grid-cols-1 items-start gap-10 px-10 py-[72px] lg:grid-cols-[180px_1fr]">
          <div className="flex flex-col gap-2">
            <span className="sl-num text-12 text-faint">04</span>
            <span className="sl-label">Open source</span>
          </div>
          <div className="flex flex-wrap items-center gap-10">
            <div className="flex flex-col gap-3.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <Badge tone="accent">MIT license</Badge>
                <Badge>rustc 1.79+</Badge>
                <Badge>Developed in public</Badge>
              </div>
              <a href={REPO} className="text-13 font-medium">Read the source · star the repo →</a>
            </div>
            <span className="flex-1" />
            <p className="max-w-[440px] text-14 leading-relaxed text-muted text-pretty">
              MIT licensed, developed in public. Issues, benchmarks and RFCs are the roadmap — there is no private fork of
              this code, and no feature held back for a paid tier.
            </p>
          </div>
        </section>

        <section className="border-t border-subtle">
          <div className="mx-auto flex max-w-[1280px] flex-col items-start gap-[22px] px-10 py-[88px]">
            <h2 className="max-w-[820px] text-[52px] font-semibold leading-[1.05] tracking-[-0.035em] text-strong text-pretty">
              Next time video gets bad, you’ll know which peer, which metric, and for how long.
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" variant="primary" asChild>
                <Link href="/signup" className="no-underline hover:no-underline">Get started free</Link>
              </Button>
              <Button size="lg" variant="ghost" asChild>
                <Link href="/docs" className="no-underline hover:no-underline">Read the docs</Link>
              </Button>
            </div>
          </div>
        </section>
        <div className="border-t border-subtle"><SiteFooter /></div>
      </DarkBand>
    </>
  );
}

function ProofTable({ label, badge, rows, muteLast }: { label: string; badge: string; rows: [string, string][]; muteLast?: boolean }) {
  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-card">
      <div className="flex items-center gap-2.5 border-b border-subtle px-5 py-3.5">
        <span className="sl-label">{label}</span>
        <span className="flex-1" />
        <Badge tone={badge === "docker run" ? "ok" : "neutral"}>{badge}</Badge>
      </div>
      {rows.map(([k, v], i) => (
        <div key={k} className={`flex items-baseline justify-between gap-4 px-5 py-3.5 ${i < rows.length - 1 ? "border-b border-subtle" : ""}`}>
          <span className="flex-none text-13 text-muted">{k}</span>
          <span className={`sl-num text-right text-13 ${muteLast && i === rows.length - 1 ? "text-faint" : "font-medium text-strong"}`}>{v}</span>
        </div>
      ))}
    </div>
  );
}

function AlertProof() {
  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-card shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-2.5 border-b border-subtle px-5 py-3.5">
        <span className="sl-label">Alerts — open</span>
        <span className="flex-1" />
        <span className="sl-num text-12 text-muted">webinar-us · ap-south-1</span>
      </div>
      <MetricGrid columns={2} className="rounded-none border-0 shadow-none">
        <MetricCard label="Packet loss" value="7.90" unit="%" state="danger" threshold="threshold 2% · 3m 12s" />
        <MetricCard label="NACK ratio" value="11.40" unit="%" state="danger" threshold="threshold 5%" />
        <MetricCard label="Round-trip time" value={284} unit="ms" state="danger" threshold="threshold 200ms" />
        <MetricCard label="Freeze ratio" value="4.10" unit="%" state="danger" threshold="threshold 1%" />
      </MetricGrid>
      <div className="border-t border-subtle bg-sunken px-5 py-3.5">
        <span className="text-12 text-muted">No exporter, no dashboard JSON to maintain, no Grafana to keep alive.</span>
      </div>
    </div>
  );
}
