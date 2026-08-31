"use client";
import * as React from "react";
import Link from "next/link";
import { Button, Badge, Tabs, TabsList, TabsTrigger } from '@lumyx/ui';
import { PLANS, PRICING_FAQ } from "@/lib/site-data";

export function PricingBlock() {
  const [period, setPeriod] = React.useState<"monthly" | "annual">("monthly");
  const plans = PLANS[period];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-6">
        <div className="flex max-w-[620px] flex-col gap-3">
          <h2 className="text-[40px] font-semibold leading-[1.1] tracking-[-0.03em] text-strong text-pretty">
            You only pay for minutes you didn’t want to operate yourself.
          </h2>
          <p className="text-14 leading-relaxed text-muted text-pretty">
            Egress is included up to each plan’s cap. Every plan has a spend cap you set — past it, new rooms are refused
            and running sessions are preserved.
          </p>
        </div>
        <span className="flex-1" />
        <Tabs value={period} onValueChange={(v) => setPeriod(v as "monthly" | "annual")}>
          <TabsList>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="annual">Yearly −20%</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-hairline bg-subtle sm:grid-cols-2 xl:grid-cols-5">
        {plans.map((pl) => (
          <div
            key={pl.name}
            className="relative flex flex-col gap-3.5 bg-card px-[18px] py-6"
            style={pl.featured ? { boxShadow: "inset 0 2px 0 var(--accent)" } : undefined}
          >
            <div className="flex min-h-5 items-center gap-2">
              <span className="sl-label">{pl.name}</span>
              {pl.featured ? <Badge tone="accent">Most chosen</Badge> : null}
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="sl-num text-[28px] font-semibold tracking-[-0.03em] text-strong">{pl.price}</span>
              {pl.per ? <span className="text-12 text-muted">{pl.per}</span> : null}
            </div>
            <span className="sl-num text-[12.5px] text-muted text-pretty">{pl.headline}</span>
            <span className="border-t border-subtle pt-3.5 text-[12.5px] leading-relaxed text-muted text-pretty">{pl.who}</span>
            <div className="flex flex-col gap-2.5">
              {pl.features.map((ft) => (
                <span key={ft} className="sl-num text-[12.5px] text-body">{ft}</span>
              ))}
            </div>
            <span className="flex-1" />
            <Button size="sm" variant={pl.variant} className="w-full" asChild>
              <Link href={pl.cta === "Contact us" ? "#" : "/signup"} className="no-underline hover:no-underline">{pl.cta}</Link>
            </Button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3.5 rounded-lg border border-hairline bg-card px-5 py-4">
        <span className="sl-label">Overage</span>
        <span className="sl-num text-13 text-body">Starter €0.0012/min · Scale €0.0009/min · egress beyond the cap €0.09/GB</span>
        <span className="flex-1" />
        <span className="sl-num text-[12.5px] text-faint">A participant-minute = one minute of one peer in a room.</span>
      </div>

      <div className="flex flex-wrap items-center gap-3.5">
        <Button variant="primary" asChild><Link href="/signup" className="no-underline hover:no-underline">Get started free</Link></Button>
        <Button>Talk to us about Business</Button>
        <span className="flex-1" />
        <Link href="/pricing" className="text-13 font-medium">Full plan comparison →</Link>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {PRICING_FAQ.map((q) => (
          <div key={q.q} className="flex flex-col gap-2 border-t border-hairline pt-4">
            <span className="text-13 font-semibold text-strong text-pretty">{q.q}</span>
            <span className="text-[12.5px] leading-relaxed text-muted text-pretty">{q.a}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
