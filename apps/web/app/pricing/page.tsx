import { SiteFrame } from "@/components/site/frame";
import { PricingBlock } from "@/components/site/pricing-block";
import { SectionHead } from "@/components/site/chrome";
import { PRICING_GROUPS } from "@/lib/site-data";

const PLAN_COLS = ["Self-hosted", "Starter", "Scale", "Business"] as const;

export default function PricingPage() {
  return (
    <SiteFrame>
      <section className="border-b border-hairline">
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-start gap-10 px-10 py-20 lg:grid-cols-[180px_1fr]">
          <SectionHead index="01" label="Pricing" blurb="Free forever self-hosted. Per participant-minute on Cloud." />
          <PricingBlock />
        </div>
      </section>

      <section>
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-start gap-10 px-10 py-20 lg:grid-cols-[180px_1fr]">
          <SectionHead index="02" label="Full comparison" blurb="Every line is a real quota or a real feature flag." />
          <div className="overflow-hidden rounded-lg border border-hairline bg-card">
            <div className="grid grid-cols-[1.6fr_repeat(4,1fr)] border-b border-hairline bg-sunken">
              <span className="sl-label px-5 py-3.5">Capability</span>
              {PLAN_COLS.map((c) => (
                <span key={c} className={`sl-label px-5 py-3.5 ${c === "Scale" ? "text-accent-text" : ""}`}>{c}</span>
              ))}
            </div>
            {PRICING_GROUPS.map((g) => (
              <div key={g.title}>
                <div className="border-b border-subtle bg-inset px-5 py-2.5">
                  <span className="sl-label">{g.title}</span>
                </div>
                {g.rows.map((r) => (
                  <div key={r.label} className="grid grid-cols-[1.6fr_repeat(4,1fr)] border-b border-subtle">
                    <span className="px-5 py-3 text-13 text-body">{r.label}</span>
                    {[r.a, r.b, r.c, r.d].map((v, i) => (
                      <span key={i} className={`sl-num px-5 py-3 text-13 ${v === "—" ? "text-faint" : "text-strong"} ${i === 2 ? "bg-accent-tint" : ""}`}>{v}</span>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
    </SiteFrame>
  );
}
