"use client";
import * as React from "react";
import Link from "next/link";
import { Copy } from "lucide-react";
import { Button, Input, Switch, Tabs, TabsList, TabsTrigger, StatusDot } from '@lumyx/ui';
import { REPO } from "@/lib/site-data";

const REGIONS = [
  { id: "eu-west-3", latency: "18ms" },
  { id: "us-east-1", latency: "86ms" },
  { id: "ap-south-1", latency: "142ms" },
];

const SDK: Record<string, string[]> = {
  js: ['import { Room } from "livekit-client";', "", "const room = new Room();", "await room.connect(", '  "wss://live-classroom.REGION.lumyx.cloud/ws",', "  token);"],
  rust: ["let client = lumyx::Client::new(", '  "wss://live-classroom.REGION.lumyx.cloud/ws",', "  token,", ");", 'client.join("cohort-42").await?;'],
  go: ["room, err := lumyx.Connect(", '  "wss://live-classroom.REGION.lumyx.cloud/ws",', "  token,", ")", "if err != nil { log.Fatal(err) }"],
};

const POINTS = [
  { title: "One project, ready in 30 seconds", body: "Name it, pick a region, and the keys are on screen. No sales call, no onboarding queue." },
  { title: "Drop-in LiveKit signaling", body: "Keep your client SDKs and token logic. Only the URL and the signing key change." },
  { title: "Six metrics armed by default", body: "Loss, RTT, jitter, NACK, freeze and bitrate come with documented thresholds and alerts already on." },
  { title: "A spend cap from minute one", body: "Set a ceiling before you have traffic. Past it, new rooms are refused and running sessions are preserved." },
];

type Step = "account" | "project" | "keys";

export default function SignupPage() {
  const [step, setStep] = React.useState<Step>("account");
  const [region, setRegion] = React.useState("eu-west-3");
  const [staging, setStaging] = React.useState(true);
  const [sdk, setSdk] = React.useState("js");
  const idx = step === "account" ? 0 : 1;
  const lines = SDK[sdk].map((l) => l.replace("REGION", region));

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
      {/* Pitch rail — a dark scope, like the marketing hero. */}
      <div className="dark relative flex flex-col justify-center gap-7 bg-page px-11 py-14 text-body">
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
        <Link href="/" className="relative flex items-center gap-2.5 no-underline hover:no-underline">
          <span className="size-5 rounded-[6px] bg-accent" />
          <span className="text-[15px] font-semibold tracking-[-0.02em] text-strong">Lumyx</span>
        </Link>
        <h1 className="relative max-w-[460px] text-[40px] font-semibold leading-[1.08] tracking-[-0.03em] text-strong text-pretty">
          Ten thousand participant-minutes a month, no card.
        </h1>
        <p className="relative max-w-[440px] text-[15px] leading-relaxed text-muted text-pretty">
          One project, one region, a pair of keys. The dashboard fills up the moment your first peer joins.
        </p>
        <div className="relative flex max-w-[460px] flex-col gap-4">
          {POINTS.map((p) => (
            <div key={p.title} className="flex flex-col gap-1 border-t border-subtle pt-3.5">
              <span className="text-13 font-medium text-strong">{p.title}</span>
              <span className="text-[12.5px] leading-relaxed text-muted text-pretty">{p.body}</span>
            </div>
          ))}
        </div>
        <div className="relative flex flex-wrap items-center gap-3 pt-1">
          <span className="sl-num text-[12.5px] text-faint">Or self-host it, free forever —</span>
          <a href={REPO} className="text-[12.5px] font-medium">read the source on GitHub →</a>
        </div>
      </div>

      {/* Form rail */}
      <div className="flex flex-col justify-center bg-card px-11 py-14">
        <div className="mx-auto flex w-full max-w-[460px] flex-col gap-7">
          <div className="flex items-center gap-4">
            {[{ n: "1", label: "Account" }, { n: "2", label: "First project" }].map((s, i) => (
              <span key={s.n} className="flex items-center gap-2">
                <span
                  className={`sl-num flex size-6 items-center justify-center rounded-pill text-11 font-medium ${
                    i <= idx ? "bg-accent text-white" : "bg-inset text-muted"
                  }`}
                >
                  {s.n}
                </span>
                <span className={`text-12 ${i <= idx ? "text-strong" : "text-faint"}`}>{s.label}</span>
              </span>
            ))}
          </div>

          {step === "account" ? (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <h2 className="text-[24px] font-semibold tracking-[-0.02em] text-strong">Create your account</h2>
                <span className="text-13 text-muted">Already have one? <a href="#">Sign in</a>.</span>
              </div>
              <div className="flex flex-col gap-2.5">
                <Button size="lg" className="w-full" onClick={() => setStep("project")}>Continue with GitHub</Button>
                <Button size="lg" className="w-full" onClick={() => setStep("project")}>Continue with Google</Button>
              </div>
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-hairline" />
                <span className="sl-label">or</span>
                <span className="h-px flex-1 bg-hairline" />
              </div>
              <div className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="sl-label">Work email</span>
                  <Input type="email" placeholder="you@company.com" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="sl-label">Password</span>
                  <Input type="password" placeholder="At least 12 characters" />
                  <span className="text-12 text-muted">12 characters minimum. No composition rules.</span>
                </label>
                <Button size="lg" variant="primary" className="w-full" onClick={() => setStep("project")}>Create account</Button>
              </div>
            </div>
          ) : null}

          {step === "project" ? (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <h2 className="text-[24px] font-semibold tracking-[-0.02em] text-strong">Create your first project</h2>
                <span className="text-13 text-muted text-pretty">You can change everything later except the name and the region.</span>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="sl-label">Project name</span>
                <Input defaultValue="live-classroom" className="sl-num" />
                <span className="text-12 text-muted">Used as the API identifier: lowercase, dashes. Immutable.</span>
              </label>
              <div className="flex flex-col gap-1.5">
                <span className="sl-label">Region</span>
                <div className="grid grid-cols-3 gap-2">
                  {REGIONS.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRegion(r.id)}
                      className={`flex flex-col items-start gap-1 rounded-sm border px-3 py-2.5 text-left transition-colors duration-[120ms] ${
                        region === r.id ? "border-accent bg-accent-tint" : "border-hairline bg-card hover:bg-hover"
                      }`}
                    >
                      <span className="sl-num text-12 font-medium text-strong">{r.id}</span>
                      <span className="sl-num text-11 text-muted">{r.latency}</span>
                    </button>
                  ))}
                </div>
                <span className="text-12 text-muted">Cannot be changed after creation — a second region means a second project.</span>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-md border border-hairline bg-sunken px-4 py-3.5">
                <span className="flex flex-col gap-1">
                  <span className="text-13 font-medium text-strong">Also create a staging environment</span>
                  <span className="text-12 text-muted text-pretty">Separate keys and quota. Data kept 24h.</span>
                </span>
                <Switch checked={staging} onCheckedChange={setStaging} />
              </div>
              <div className="flex items-center gap-3">
                <Button size="lg" variant="primary" onClick={() => setStep("keys")}>Create project</Button>
                <Button size="lg" variant="ghost" onClick={() => setStep("account")}>Back</Button>
              </div>
            </div>
          ) : null}

          {step === "keys" ? (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2.5">
                  <StatusDot status="live" />
                  <h2 className="text-[24px] font-semibold tracking-[-0.02em] text-strong">live-classroom is live</h2>
                </div>
                <span className="sl-num text-13 text-muted">{region} · production{staging ? " + staging" : ""}</span>
              </div>

              <div className="flex flex-col gap-2.5">
                {[
                  { label: "Signaling URL", value: `wss://live-classroom.${region}.lumyx.cloud/ws` },
                  { label: "Publishable key", value: "pk_live_c27ad930f14b" },
                  { label: "Secret key — shown once", value: "sk_live_8f31c02a4d6e9b7f2a1c" },
                ].map((c) => (
                  <div key={c.label} className="flex items-center gap-3 rounded-sm border border-subtle bg-sunken px-3.5 py-3">
                    <span className="sl-label w-[150px] flex-none">{c.label}</span>
                    <span className="sl-num min-w-0 flex-1 truncate text-13 text-strong">{c.value}</span>
                    <Button size="icon" variant="ghost" aria-label="Copy" className="size-7"><Copy /></Button>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="sl-label">Connect your client</span>
                  <span className="flex-1" />
                  <Tabs value={sdk} onValueChange={setSdk}>
                    <TabsList>
                      <TabsTrigger value="js">JS</TabsTrigger>
                      <TabsTrigger value="rust">Rust</TabsTrigger>
                      <TabsTrigger value="go">Go</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <div className="flex flex-col gap-1 rounded-md border border-subtle bg-sunken px-4 py-3.5">
                  {lines.map((l, i) => (
                    <span key={i} className="sl-num whitespace-pre-wrap text-[12.5px] text-body">{l}</span>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button size="lg" variant="primary" asChild>
                  <Link href="/cloud" className="no-underline hover:no-underline">Open the dashboard</Link>
                </Button>
                <Button size="lg" asChild><Link href="/docs" className="no-underline hover:no-underline">Read the docs</Link></Button>
                <span className="flex-1" />
                <span className="text-12 text-faint text-pretty">No peers yet — the overview fills on the first join.</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
