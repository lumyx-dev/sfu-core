import Link from "next/link";
import { Button, StatusDot } from '@lumyx/ui';
import { FOOTER_COLS, VERSION, REPO } from "@/lib/site-data";

function Mark({ size = 20 }: { size?: number }) {
  return <span className="shrink-0 rounded-[6px] bg-accent" style={{ width: size, height: size }} />;
}

const NAV = [
  { href: "/#why", label: "Why Sightline" },
  { href: "/#observability", label: "Observability" },
  { href: "/compare", label: "vs LiveKit" },
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" },
];

export function SiteHeader() {
  return (
    <header className="relative border-b border-subtle">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-[30px] px-10">
        <Link href="/" className="flex flex-none items-center gap-2.5 no-underline hover:no-underline">
          <Mark />
          <span className="text-[15px] font-semibold tracking-[-0.02em] text-strong">Sightline</span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="text-[12.5px] text-muted no-underline hover:text-strong hover:no-underline">
              {n.label}
            </Link>
          ))}
        </nav>
        <span className="flex-1" />
        <span className="sl-num hidden text-12 text-faint sm:inline">{VERSION}</span>
        <a href={REPO} className="inline-flex h-8 items-center rounded-sm border border-hairline px-3 text-[12.5px] text-body no-underline hover:bg-hover hover:no-underline">
          GitHub
        </a>
        <Button size="sm" variant="primary" asChild><Link href="/signup" className="no-underline hover:no-underline">Get started free</Link></Button>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-subtle">
      <div className="mx-auto grid max-w-[1280px] grid-cols-2 gap-8 px-10 pb-8 pt-12 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div className="flex flex-col gap-3">
          <span className="flex items-center gap-2.5">
            <Mark size={18} />
            <span className="text-13 font-semibold tracking-[-0.01em] text-strong">Sightline</span>
          </span>
          <span className="max-w-[260px] text-12 leading-relaxed text-muted text-pretty">
            Open-source WebRTC SFU with observability in the media path. Self-host it, or use Sightline Cloud.
          </span>
        </div>
        {FOOTER_COLS.map((col) => (
          <div key={col.title} className="flex flex-col gap-2.5">
            <span className="sl-label">{col.title}</span>
            {col.links.map((l) => (
              <a key={l} href="#" className="text-[12.5px] text-muted no-underline hover:text-strong hover:no-underline">{l}</a>
            ))}
          </div>
        ))}
      </div>
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-4 px-10 pb-8">
        <span className="sl-num text-12 text-faint">MIT licensed · © 2026 Sightline</span>
        <span className="flex-1" />
        <span className="sl-num text-12 text-faint">All systems operational</span>
        <StatusDot status="live" />
      </div>
    </footer>
  );
}

/** Dark bands are a `.dark` scope — no component carries a dark-mode branch. */
export function DarkBand({ id, className, children }: { id?: string; className?: string; children: React.ReactNode }) {
  return <div id={id} className={`dark bg-page text-body ${className ?? ""}`}>{children}</div>;
}

export function SectionHead({ index, label, blurb }: { index: string; label: string; blurb?: string }) {
  return (
    <div className="flex flex-col gap-2 lg:sticky lg:top-8">
      <span className="sl-num text-12 text-faint">{index}</span>
      <span className="sl-label">{label}</span>
      {blurb ? <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted text-pretty">{blurb}</p> : null}
    </div>
  );
}
