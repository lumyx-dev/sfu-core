'use client';

import { useState } from 'react';
import { AlertBanner, Button, Icon, IconButton, Input, StatusDot, Tabs } from '@lumyx/ui';
import { REGIONS, SDK } from '@/content/signup';

type Step = 'account' | 'project' | 'keys';

const STEPS = [
  { n: '1', label: 'Account' },
  { n: '2', label: 'First project' },
];

const SDK_TABS = [
  { id: 'js', label: 'JS' },
  { id: 'rust', label: 'Rust' },
  { id: 'go', label: 'Go' },
];

const FULL_WIDTH_WRAPPER = 'w-full';

// Source: Sign up.dc.html's `<script data-dc-script>` Component class (`state`, `renderVals`).
// Two steps plus a done screen — `'account' | 'project' | 'keys'` — not three (task-12-brief.md
// correction 6): the stepper only ever renders the two `stepDef` entries above, and `index`
// pins at 1 once past 'account', so "First project" stays lit through the done screen. This is
// the only client-side file in the route (verify-ds.mjs's CLIENT_ALLOWED already names it) —
// every other section is a Server Component.
//
// TODO(sous-projet C): wire submitAccount/submitProject to packages/auth and the Cloud API once
// that data model is validated. Today the wizard only ever advances local state — nothing here
// creates an account, a project or a key — so the flow is demonstrable end to end without a
// backend that doesn't exist yet. Do not connect this ahead of that work.
export function SignupWizard() {
  const [step, setStep] = useState<Step>('account');
  const [region, setRegion] = useState('eu-west-3');
  const [staging, setStaging] = useState(true);
  const [sdk, setSdk] = useState('js');

  const index = step === 'account' ? 0 : 1;
  const meta = step === 'keys' ? 'Done' : `Step ${index + 1} of 2`;

  const submitAccount = () => setStep('project');
  const submitProject = () => setStep('keys');

  return (
    // Sign up.dc.html:64 — `width:100%;max-width:460px;margin:0 auto;gap:22px`.
    <div className="w-full max-w-[460px] mx-auto flex flex-col gap-5.5">
      {/* Sign up.dc.html:66 — `gap:12px`. */}
      <div className="flex items-center gap-3">
        {STEPS.map((st, i) => {
          const active = i <= index;
          return (
            // Sign up.dc.html:68 — `gap:8px`.
            <div key={st.n} className="flex items-center gap-2">
              {/* Sign up.dc.html:69 — 22x22, radius 8px, 11.5px/500. */}
              <span
                className={`sl-num inline-flex items-center justify-center w-[22px] h-[22px] rounded-chip text-[11.5px] font-medium border ${
                  active
                    ? 'text-on-accent bg-accent border-accent'
                    : 'text-muted bg-transparent border-border'
                }`}
              >
                {st.n}
              </span>
              {/* Sign up.dc.html:70 — 12.5px/500. */}
              <span
                className={`text-[12.5px] font-medium ${active ? 'text-strong' : 'text-faint'}`}
              >
                {st.label}
              </span>
            </div>
          );
        })}
        {/* Sign up.dc.html:73 — the rule filling the space before the step meta. */}
        <span className="flex-1 h-px bg-border" />
        {/* Sign up.dc.html:74 — 12px, text-faint. */}
        <span className="sl-num text-12 text-faint">{meta}</span>
      </div>

      {step === 'account' && <AccountStep onSubmit={submitAccount} />}
      {step === 'project' && (
        <ProjectStep
          region={region}
          onRegion={setRegion}
          staging={staging}
          onStaging={setStaging}
          onSubmit={submitProject}
          onBack={() => setStep('account')}
        />
      )}
      {step === 'keys' && <KeysStep region={region} staging={staging} sdk={sdk} onSdk={setSdk} />}
    </div>
  );
}

// Shared step wrapper — 78:20, 113:20, 156:20 all use `gap:20px`.
const STEP_CLASS = 'flex flex-col gap-5';
// Sign up.dc.html:79/114/157 — `gap:8px`.
const STEP_HEAD_CLASS = 'flex flex-col gap-2';
// Sign up.dc.html:80/115/160 — 24px/600/-0.02em.
const STEP_TITLE_CLASS = 'm-0 text-[24px] font-semibold tracking-[-0.02em] text-strong';
// Sign up.dc.html:81/116/162 — 13px, text-muted, used for the account step's "sign in" line,
// the project step's helper line and the keys step's region/production meta line.
const STEP_SUB_CLASS = 'text-13 text-muted [text-wrap:pretty]';

// Sign up.dc.html:77-110 (`sc-if value="{{ isAccount }}"`).
function AccountStep({ onSubmit }: { onSubmit: () => void }) {
  return (
    <div className={STEP_CLASS}>
      <div className={STEP_HEAD_CLASS}>
        <h2 className={STEP_TITLE_CLASS}>Create your account</h2>
        <span className={STEP_SUB_CLASS}>
          Already have one?{' '}
          <a href="#" onClick={(e) => e.preventDefault()}>
            Sign in
          </a>
          .
        </span>
      </div>

      {/* Sign up.dc.html:84 — `gap:10px`. */}
      <div className="flex flex-col gap-2.5">
        <Button block onClick={onSubmit}>
          Continue with GitHub
        </Button>
        <Button block onClick={onSubmit}>
          Continue with Google
        </Button>
      </div>

      {/* Sign up.dc.html:89 — `gap:12px`. */}
      <div className="flex items-center gap-3">
        <span className="flex-1 h-px bg-border" />
        <span className="sl-label">or</span>
        <span className="flex-1 h-px bg-border" />
      </div>

      {/* Sign up.dc.html:95 — `gap:14px`. */}
      <div className="flex flex-col gap-3.5">
        <Input
          label="Work email"
          type="email"
          placeholder="you@company.com"
          wrapperClassName={FULL_WIDTH_WRAPPER}
        />
        <Input
          label="Password"
          type="password"
          placeholder="At least 12 characters"
          hint="12 characters minimum. No composition rules."
          wrapperClassName={FULL_WIDTH_WRAPPER}
        />
        <Button variant="primary" block onClick={onSubmit}>
          Create account
        </Button>
      </div>

      {/* Sign up.dc.html:108 — 12px/1.6, text-faint. */}
      <span className="text-12 leading-body text-faint [text-wrap:pretty]">
        No credit card for the free tier. By continuing you accept the terms of service and the
        privacy policy.
      </span>
    </div>
  );
}

// Sign up.dc.html:112-153 (`sc-if value="{{ isProject }}"`).
function ProjectStep({
  region,
  onRegion,
  staging,
  onStaging,
  onSubmit,
  onBack,
}: {
  region: string;
  onRegion: (id: string) => void;
  staging: boolean;
  onStaging: (staging: boolean) => void;
  onSubmit: () => void;
  onBack: () => void;
}) {
  return (
    <div className={STEP_CLASS}>
      <div className={STEP_HEAD_CLASS}>
        <h2 className={STEP_TITLE_CLASS}>Create your first project</h2>
        <span className={STEP_SUB_CLASS}>
          You can change everything later except the name and the region.
        </span>
      </div>

      <Input
        label="Project name"
        defaultValue="live-classroom"
        hint="Used as the API identifier: lowercase, dashes. Immutable."
        wrapperClassName={FULL_WIDTH_WRAPPER}
      />

      {/* Sign up.dc.html:119/125 — `gap:7px`/`gap:9px`, close enough to share one class: the
          Project name field uses the Input component's own built-in label/hint instead, so this
          is only reached by the SFU region group. */}
      <div className="flex flex-col gap-2.25">
        <span className="sl-label">SFU region</span>
        {/* Sign up.dc.html:127 — `repeat(2,minmax(0,1fr));gap:10px`. */}
        <div className="grid grid-cols-2 gap-2.5">
          {REGIONS.map((r) => {
            const active = r.id === region;
            return (
              // Sign up.dc.html:129 — `gap:5px;padding:12px 14px;border-radius:12px`.
              <button
                key={r.id}
                type="button"
                onClick={() => onRegion(r.id)}
                className={`flex flex-col gap-1.25 items-start px-3.5 py-3 border rounded-control cursor-pointer font-[inherit] text-left ${
                  active ? 'border-accent-border bg-accent-tint' : 'border-border bg-page'
                }`}
              >
                <span className="sl-num text-13 font-medium text-strong">{r.id}</span>
                <span className="sl-num text-12 text-muted">{r.latency} from you</span>
              </button>
            );
          })}
        </div>
        {/* Sign up.dc.html:122/135 — 12px, text-muted, standalone helper text below the region
            grid. */}
        <span className="text-12 text-muted">
          Cannot be changed after creation — a second region means a second project.
        </span>
      </div>

      {/* Sign up.dc.html:138 — `gap:16px;padding:14px 16px;border-radius:14px`. */}
      <div className="flex items-center justify-between gap-4 px-4 py-3.5 border border-border rounded-tile bg-sunken">
        <span className="flex flex-col gap-1">
          <span id="staging-toggle-title" className="text-13 font-medium text-strong">
            Also create a staging environment
          </span>
          <span className="text-12 text-muted [text-wrap:pretty]">
            Separate keys and quota. Data kept 24h.
          </span>
        </span>
        {/* Sign up.dc.html:143 — 40x23 pill switch. The source's literal white knob colour is
            var(--surface-card) here (task-12-brief.md correction 7's rule applied to the
            toggle, not just the stepper number). */}
        <button
          type="button"
          onClick={() => onStaging(!staging)}
          aria-pressed={staging}
          aria-labelledby="staging-toggle-title"
          className={`w-10 h-[23px] rounded-full border-none relative cursor-pointer flex-none transition-colors duration-[180ms] ease-out ${
            staging ? 'bg-accent' : 'bg-[var(--sl-n-300)]'
          }`}
        >
          <span
            className="absolute top-[3px] w-[17px] h-[17px] rounded-full bg-card transition-[left] duration-[180ms] ease-out"
            style={{ left: staging ? 20 : 3 }}
          />
        </button>
      </div>

      {/* Sign up.dc.html:148 — `gap:12px`. */}
      <div className="flex items-center gap-3">
        <Button variant="primary" onClick={onSubmit}>
          Create project
        </Button>
        {/* The source has this as `variant="ghost"`; @lumyx/ui only exposes 'primary' |
            'secondary' | 'quiet' | 'danger' | 'accentQuiet' (no 'ghost') — same gap the three
            FinalCta.tsx files document — `quiet` is the closest match. */}
        <Button variant="quiet" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}

// Sign up.dc.html:155-203 (`sc-if value="{{ isKeys }}"`). Renders exactly what the source shows
// and no more (task-12-brief.md): no success toast, no fake loading state, no fake error. The
// source itself wires no handler to either "Open the dashboard" or the credential rows' "Copy"
// IconButton, unlike every other actionable control on this page (goProject, goKeys, goAccount,
// region.pick, toggleStaging, setSdk all have one) — but the two are treated differently here:
//
// - Copy is wired to the clipboard (coordinator ruling, fix pass 1) the same way Home's
//   SnippetTabs.tsx does: a shipping site can't afford an affordance that visibly does nothing,
//   even though the mockup leaves it inert. No "copied" confirmation UI — the source shows none.
// - "Open the dashboard" (TODO(sous-projet C), below) stays inert: there is no dashboard to open
//   (apps/sightline-cloud is an empty shell), and wiring it would mean inventing a destination —
//   the failure mode this project is explicitly guarding against, unlike Copy, which only needs
//   a real browser API and no invented backend or route.
function KeysStep({
  region,
  staging,
  sdk,
  onSdk,
}: {
  region: string;
  staging: boolean;
  sdk: string;
  onSdk: (id: string) => void;
}) {
  const lines = (SDK[sdk] ?? SDK.js).map((line) => line.replace('REGION', region));
  const credentials = [
    { label: 'Signaling URL', value: `wss://live-classroom.${region}.sightline.cloud/ws` },
    { label: 'Publishable key', value: 'pk_live_c27ad930f14b' },
    { label: 'Secret key — shown once', value: 'sk_live_8f31c02a4d6e9b7f2a1c' },
  ];

  // Same clipboard pattern as Home's SnippetTabs.tsx: guarded for insecure origins (where
  // `navigator.clipboard` is undefined) and failing silently — no toast, no "copied" state.
  const copy = (value: string) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard.writeText(value).catch(() => { });
  };

  return (
    <div className={STEP_CLASS}>
      <div className={STEP_HEAD_CLASS}>
        {/* Sign up.dc.html:158 — `gap:10px`. */}
        <div className="flex items-center gap-2.5">
          <StatusDot status="live" size={10} />
          <h2 className={STEP_TITLE_CLASS}>live-classroom is live</h2>
        </div>
        <span className={`sl-num ${STEP_SUB_CLASS}`}>
          {region} · production{staging ? ' + staging' : ''}
        </span>
      </div>

      <AlertBanner
        severity="warning"
        title="Copy your secret key now"
        message="This is the only time it is displayed. If you lose it, revoke the key and generate a new one — there is no recovery."
      />

      {/* Sign up.dc.html:169 — `gap:10px`. */}
      <div className="flex flex-col gap-2.5">
        {credentials.map((c) => (
          // Sign up.dc.html:171 — `gap:6px`.
          <div key={c.label} className="flex flex-col gap-1.5">
            <span className="sl-label">{c.label}</span>
            {/* Sign up.dc.html:173 — `gap:10px;padding:11px 14px;border-radius:12px`. */}
            <div className="flex items-center gap-2.5 px-3.5 py-2.75 border border-border rounded-control bg-sunken">
              {/* Sign up.dc.html:174 — 12.5px, ellipsis overflow. */}
              <span className="sl-num flex-1 min-w-0 text-[12.5px] text-strong overflow-hidden text-ellipsis whitespace-nowrap">
                {c.value}
              </span>
              <IconButton label="Copy" size={28} onClick={() => copy(c.value)}>
                <Icon name="copy" size={14} />
              </IconButton>
            </div>
          </div>
        ))}
      </div>

      {/* Sign up.dc.html:169/183 — `gap:10px`. */}
      <div className="flex flex-col gap-2.5">
        {/* Sign up.dc.html:184 — `gap:10px`. */}
        <div className="flex items-center gap-2.5">
          <span className="sl-label">Connect your client</span>
          <span className="flex-1" />
          <Tabs variant="segmented" tabs={SDK_TABS} activeId={sdk} onSelect={onSdk} />
        </div>
        {/* Sign up.dc.html:189 — `padding:14px 16px;border-radius:14px;gap:5px;min-height:104px`. */}
        <div className="border border-border rounded-tile bg-sunken px-4 py-3.5 flex flex-col gap-1.25 min-h-[104px]">
          {/* Sign up.dc.html:191 — 12.5px/1.6, plain Geist like the rest of the page: the
              global constraints rule out a fixed-width font here even though it is a code
              snippet. */}
          {lines.map((line, i) => (
            <span key={i} className="text-[12.5px] leading-body text-body whitespace-pre-wrap">
              {line}
            </span>
          ))}
        </div>
      </div>

      {/* Sign up.dc.html:196 — `gap:12px;flex-wrap:wrap`. */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* TODO(sous-projet C): point this at the Cloud dashboard once it exists. Left inert —
            apps/sightline-cloud is an empty shell today, and wiring a destination that doesn't
            exist would be worse than a control that visibly does nothing. */}
        <Button variant="primary">Open the dashboard</Button>
        <Button>Read the docs</Button>
        <span className="flex-1" />
        <span className="text-12 text-faint [text-wrap:pretty]">
          No peers yet — the overview fills on the first join.
        </span>
      </div>
    </div>
  );
}
