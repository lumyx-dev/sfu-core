import Link from 'next/link';
import { COMPARE_ROWS } from '@/content/home';

// Source: Home.dc.html:214-243 — `<div class="theme-dark" id="compare">`. This block is dark,
// unlike the light `#why`/`#pricing` sections either side of it (a divergence the task brief
// never mentioned). Not sticky, unlike the `#why` and `#pricing` rails.
export function CompareStrip() {
  return (
    <div id="compare" className="theme-dark bg-page text-body border-t border-border">
      <div className="grid grid-cols-1 gap-10 items-start max-w-[1280px] mx-auto px-5 py-14 sm:px-10 min-[900px]:grid-cols-[180px_minmax(0,1fr)] min-[900px]:py-20">
        <div className="flex flex-col gap-2">
          <span className="sl-num text-12 text-faint">02</span>
          <span className="sl-label">Coming from LiveKit</span>
        </div>

        <div className="flex flex-col gap-6 min-w-0">
          <div className="flex items-end gap-6 flex-wrap">
            <h2
              data-anim="rise"
              className="m-0 text-[40px] font-semibold tracking-[-0.03em] leading-[1.1] text-strong max-w-[620px] [text-wrap:pretty]"
            >
              Same signaling. Different priorities.
            </h2>
            <span style={{ flex: 1 }} />
            <Link href="/compare/livekit" className="text-13 font-medium">
              See the full comparison →
            </Link>
          </div>

          <div className="overflow-x-auto max-md:pb-0.5">
            <div
              data-anim="rise"
              className="border border-border rounded-card overflow-hidden bg-card max-md:min-w-[640px]"
            >
              <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] bg-sunken border-b border-border-subtle">
                <span className="sl-label px-5 py-[13px]">Architectural default</span>
                <span className="sl-label px-5 py-[13px] text-accent-text">Sightline</span>
                <span className="sl-label px-5 py-[13px]">Typical Go SFU stack</span>
              </div>
              {COMPARE_ROWS.map((r) => (
                <div
                  key={r.label}
                  className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] border-b border-border-subtle"
                >
                  <span className="px-5 py-[15px] text-13 font-medium text-strong">{r.label}</span>
                  <span className="px-5 py-[15px] text-13 text-body bg-accent-tint">
                    {r.sightline}
                  </span>
                  <span className="px-5 py-[15px] text-13 text-muted">{r.other}</span>
                </div>
              ))}
              <div className="px-5 py-[13px]">
                <span className="text-12 text-faint [text-wrap:pretty]">
                  Comparison of architectural defaults, not of feature counts. Corrections
                  welcome as a PR.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
