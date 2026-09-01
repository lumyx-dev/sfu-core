import Link from "next/link";
import { Button, Card, LumyxMark } from '@lumyx/ui';
import { ThemeToggle } from "@/components/site/theme-toggle";
import { CodePanel } from "@/components/site/code-panel";
import { PlatformBento } from "@/components/site/platform-bento";
import { CONFIG_STEPS, FEATURE_GROUPS, NO_LIST, TIERS } from "@/lib/platform-data";
import { REPO } from "@/lib/site-data";
import { organizationJsonLd, softwareApplicationJsonLd } from "@/lib/schema";

const NAV = [
  { href: "/", label: "Product" },
  { href: "/#platform", label: "Observability" },
  { href: "/docs", label: "Docs" },
  { href: "/blog", label: "Blog" },
  { href: "/pricing", label: "Pricing" },
  { href: "/changelog", label: "Changelog" },
];

/**
 * The landing page — "Platform".
 * Dense, product-first, many entry points.
 */
export default function HomePage() {
  return (
    <DarkBand className="min-h-dvh">
      <script type="application/ld+json">
        {JSON.stringify([organizationJsonLd(), softwareApplicationJsonLd()]).replace(/</g, "\\u003c")}
      </script>
      <header className="flex h-[60px] items-center gap-[26px] border-b border-subtle px-8">
        <Link href="/" className="flex items-center gap-2.5 no-underline hover:no-underline">
          <LumyxMark size={18} className="text-accent" />
          <span className="text-[15px] font-semibold tracking-[-0.02em] text-strong">Lumyx</span>
        </Link>
        <nav className="hidden items-center gap-5 md:flex">
          {NAV.map((n) => (
            <Link key={n.label} href={n.href} className="text-[12.5px] text-muted no-underline hover:text-strong hover:no-underline">
              {n.label}
            </Link>
          ))}
        </nav>
        <span className="flex-1" />
        <ThemeToggle />
        <Link href="/signup" className="text-[12.5px] text-muted no-underline hover:text-strong hover:no-underline">
          Sign in
        </Link>
        <Button size="sm" variant="primary" asChild>
          <Link href="/signup" className="no-underline hover:no-underline">Start free</Link>
        </Button>
      </header>

      {/* Hero — one idea, centred, with the announcement pill above it. */}
      <section className="flex flex-col items-center gap-[22px] border-b border-subtle px-8 pb-14 pt-[72px] text-center">
        <Link
          href="/changelog"
          className="inline-flex h-7 items-center gap-2 rounded-pill border border-hairline bg-card p-[3px] pr-2 text-[12.5px] text-muted no-underline hover:no-underline"
        >
          <span className="inline-flex h-[18px] items-center rounded-pill bg-accent px-2 text-11 font-semibold tracking-[0.04em] text-on-accent">
            New
          </span>
          Session replay is out of beta
          <span className="text-faint">→</span>
        </Link>

        <h1 className="max-w-[880px] text-[66px] font-semibold leading-[1.02] tracking-[-0.04em] text-strong text-balance">
          Ship real-time video you can actually debug
        </h1>
        <p className="max-w-[620px] text-[17px] leading-relaxed text-muted text-pretty">
          Lumyx is an open-source WebRTC SFU written in Rust. Selective forwarding, with jitter, packet loss,
          RTT, NACK and freeze measured inside the media path — per peer, per room, every 500ms.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          <Button size="lg" variant="primary" asChild>
            <Link href="/signup" className="no-underline hover:no-underline">Start building now</Link>
          </Button>
          <a
            href={REPO}
            className="inline-flex h-[42px] items-center overflow-hidden rounded-sm border border-stroke text-[13.5px] text-strong no-underline hover:no-underline"
          >
            <span className="sl-num flex h-full items-center border-r border-stroke bg-card px-3.5">1.2k</span>
            <span className="px-3.5">Open source</span>
          </a>
        </div>
      </section>

      {/* Configuration — the tabbed code panel drives the whole story. */}
      <section id="platform" className="grid grid-cols-1 items-start gap-8 border-b border-subtle px-8 py-14 lg:grid-cols-[1.25fr_1fr]">
        <CodePanel />

        <div className="flex flex-col gap-4 pt-3">
          <h2 className="text-[28px] font-semibold leading-[1.12] tracking-[-0.028em] text-strong text-pretty">
            Configure it once, then stop thinking about it
          </h2>
          <p className="text-16 leading-relaxed text-muted text-pretty">
            Thresholds, remediation and destinations live in one file. The same six metrics reach your dashboard,
            your Prometheus, your webhook and your client SDK — no exporter to write, no collector to run.
          </p>

          <div className="flex flex-col pt-0.5">
            {CONFIG_STEPS.map((s, i) => (
              <div
                key={s.index}
                className={`flex gap-3 border-t border-subtle py-3 ${i === CONFIG_STEPS.length - 1 ? "border-b" : ""}`}
              >
                <span className="sl-num w-[18px] flex-none text-12 text-faint">{s.index}</span>
                <span className="text-[13.5px] leading-relaxed text-muted">
                  <strong className="font-semibold text-strong">{s.title}</strong> — {s.body}
                </span>
              </div>
            ))}
          </div>

          <Link href="/docs" className="text-[13.5px] font-medium">Read the configuration reference</Link>
        </div>
      </section>

      {/* The platform, in three shown promises. */}
      <section className="flex flex-col gap-2 px-8 pb-2 pt-16">
        <span className="sl-label text-accent-text">The platform</span>
        <h2 className="max-w-[620px] text-[40px] font-semibold leading-[1.06] tracking-[-0.035em] text-strong text-balance">
          Three things, each one you&rsquo;d otherwise build yourself
        </h2>
      </section>

      <div className="px-8 py-8">
        <PlatformBento />
      </div>

      {/* One hairline band instead of three floating columns. */}
      <div className="mx-8 mb-14 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-hairline bg-subtle md:grid-cols-3">
        {NO_LIST.map((n) => (
          <div key={n.title} className="flex flex-col gap-2 bg-card p-6">
            <span className="text-[19px] font-semibold tracking-[-0.02em] text-strong">{n.title}</span>
            <span className="text-[13.5px] leading-relaxed text-muted text-pretty">{n.body}</span>
          </div>
        ))}
      </div>

      {/* Feature index — sticky rail, grouped pills. */}
      <section className="grid grid-cols-1 items-start gap-10 border-y border-subtle px-8 py-14 lg:grid-cols-[260px_1fr]">
        <div className="flex flex-col gap-3 lg:sticky lg:top-6">
          <h2 className="text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] text-strong">
            Everything else that ships with it
          </h2>
          <Link href="/docs" className="text-[13.5px] font-medium">View all features</Link>
        </div>

        <div className="flex flex-col">
          {FEATURE_GROUPS.map((g, i) => (
            <div
              key={g.group}
              className={`flex flex-col gap-3 border-t border-subtle py-5 ${i === FEATURE_GROUPS.length - 1 ? "border-b" : ""}`}
            >
              <span className="sl-label text-faint">{g.group}</span>
              <div className="flex flex-wrap gap-2">
                {g.items.map((item) => (
                  <Link
                    key={item}
                    href="/docs"
                    className="inline-flex min-h-[30px] flex-none items-center whitespace-nowrap rounded-pill border border-hairline bg-card px-3 py-1.5 text-13 text-body no-underline hover:border-stroke hover:text-strong hover:no-underline"
                  >
                    {item}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing — self-hosting is free; Cloud is metered per participant-minute. */}
      <section className="flex flex-col gap-[22px] border-b border-subtle px-8 py-14">
        <div className="flex flex-wrap items-baseline gap-4">
          <h2 className="text-34 font-semibold tracking-[-0.03em] text-strong">Pricing</h2>
          <span className="text-14 text-muted">
            Self-hosting is free and unmetered. Cloud bills per participant-minute, with a spend cap on every plan.
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {TIERS.map((t) => (
            <Card
              key={t.name}
              className={`flex flex-col gap-3 p-5 ${t.featured ? "border-accent bg-accent-tint" : ""}`}
            >
              <span className={`sl-label ${t.featured ? "text-accent-text" : ""}`}>{t.name}</span>
              <span className="sl-num text-34 font-medium tracking-[-0.03em] text-strong">
                {t.price}
                {t.per ? <span className="text-16 font-normal text-muted">{t.per}</span> : null}
              </span>
              <span className="sl-num text-13 text-body">{t.quota}</span>
              <span className={`text-13 leading-relaxed ${t.featured ? "text-body" : "text-muted"}`}>{t.body}</span>
              <span className="flex-1" />
              {t.featured ? (
                <Button variant="primary" asChild>
                  <Link href="/signup" className="no-underline hover:no-underline">{t.cta}</Link>
                </Button>
              ) : (
                <Button variant="secondary" asChild>
                  <Link href="/signup" className="no-underline hover:no-underline">{t.cta}</Link>
                </Button>
              )}
            </Card>
          ))}
        </div>

        <span className="sl-num text-[12.5px] text-faint">
          A participant-minute = one minute of one peer in a room. Inbound is never billed. Annual billing takes 20%
          off Starter and Scale.
        </span>
      </section>

      {/* Three doors out. */}
      <section className="grid grid-cols-1 items-end gap-6 px-8 py-14 lg:grid-cols-[1fr_300px_300px]">
        <div className="flex flex-col gap-3.5">
          <h2 className="max-w-[440px] text-[40px] font-semibold leading-[1.05] tracking-[-0.035em] text-strong text-balance">
            Next time video gets bad, you&rsquo;ll know why.
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" variant="primary" asChild>
              <Link href="/signup" className="no-underline hover:no-underline">Get started free</Link>
            </Button>
            <Link href="/docs" className="text-[13.5px] text-muted no-underline hover:text-strong hover:no-underline">
              Read the docs
            </Link>
          </div>
        </div>

        <Card className="flex flex-col gap-2 p-5">
          <span className="text-[15px] font-semibold text-strong">Simple pricing</span>
          <span className="text-13 leading-relaxed text-muted">
            Pay per participant-minute, cap the spend, never get a surprise invoice.
          </span>
          <Link href="/pricing" className="text-13 font-medium">Explore pricing</Link>
        </Card>

        <Card className="flex flex-col gap-2 p-5">
          <span className="text-[15px] font-semibold text-strong">Self-host</span>
          <span className="text-13 leading-relaxed text-muted">
            MIT licensed, one binary, no metering and no account required.
          </span>
          <a href={REPO} className="text-13 font-medium">Self-hosting docs</a>
        </Card>
      </section>
    </div>
  );
}
