'use client';

import { useState } from 'react';
import { AlertBanner, Button, Icon, IconButton, Input, StatusDot, Tabs } from '@sightline/ui';
import { REGIONS, SDK } from '@/content/signup';
import s from './SignupWizard.module.css';

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
    <div className={s.wizard}>
      <div className={s.stepperRow}>
        {STEPS.map((st, i) => {
          const active = i <= index;
          return (
            <div key={st.n} className={s.stepItem}>
              <span
                className={`sl-num ${s.stepNum}`}
                style={{
                  color: active ? 'var(--text-on-accent)' : 'var(--text-muted)',
                  background: active ? 'var(--accent)' : 'transparent',
                  borderColor: active ? 'var(--accent)' : 'var(--border)',
                }}
              >
                {st.n}
              </span>
              <span
                className={s.stepLabel}
                style={{ color: active ? 'var(--text-strong)' : 'var(--text-faint)' }}
              >
                {st.label}
              </span>
            </div>
          );
        })}
        <span className={s.stepperRule} />
        <span className={`sl-num ${s.stepperMeta}`}>{meta}</span>
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

// Sign up.dc.html:77-110 (`sc-if value="{{ isAccount }}"`).
function AccountStep({ onSubmit }: { onSubmit: () => void }) {
  return (
    <div className={s.step}>
      <div className={s.stepHead}>
        <h2 className={s.stepTitle}>Create your account</h2>
        <span className={s.stepSub}>
          Already have one?{' '}
          <a href="#" onClick={(e) => e.preventDefault()}>
            Sign in
          </a>
          .
        </span>
      </div>

      <div className={s.oauthGroup}>
        <Button block onClick={onSubmit}>
          Continue with GitHub
        </Button>
        <Button block onClick={onSubmit}>
          Continue with Google
        </Button>
      </div>

      <div className={s.divider}>
        <span className={s.dividerRule} />
        <span className="sl-label">or</span>
        <span className={s.dividerRule} />
      </div>

      <div className={s.formGroup}>
        <Input
          label="Work email"
          type="email"
          placeholder="you@company.com"
          wrapperStyle={{ width: '100%' }}
        />
        <Input
          label="Password"
          type="password"
          placeholder="At least 12 characters"
          hint="12 characters minimum. No composition rules."
          wrapperStyle={{ width: '100%' }}
        />
        <Button variant="primary" block onClick={onSubmit}>
          Create account
        </Button>
      </div>

      <span className={s.legal}>
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
    <div className={s.step}>
      <div className={s.stepHead}>
        <h2 className={s.stepTitle}>Create your first project</h2>
        <span className={s.stepSub}>You can change everything later except the name and the region.</span>
      </div>

      <Input
        label="Project name"
        defaultValue="live-classroom"
        hint="Used as the API identifier: lowercase, dashes. Immutable."
        wrapperStyle={{ width: '100%' }}
      />

      <div className={s.field}>
        <span className="sl-label">SFU region</span>
        <div className={s.regionGrid}>
          {REGIONS.map((r) => {
            const active = r.id === region;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onRegion(r.id)}
                className={s.regionCard}
                style={{
                  borderColor: active ? 'var(--accent-border)' : 'var(--border)',
                  background: active ? 'var(--accent-tint)' : 'var(--surface-page)',
                }}
              >
                <span className={`sl-num ${s.regionId}`}>{r.id}</span>
                <span className={`sl-num ${s.regionLatency}`}>{r.latency} from you</span>
              </button>
            );
          })}
        </div>
        <span className={s.hint}>
          Cannot be changed after creation — a second region means a second project.
        </span>
      </div>

      <div className={s.stagingRow}>
        <span className={s.stagingCopy}>
          <span className={s.stagingTitle}>Also create a staging environment</span>
          <span className={s.stagingDesc}>Separate keys and quota. Data kept 24h.</span>
        </span>
        <button
          type="button"
          onClick={() => onStaging(!staging)}
          aria-pressed={staging}
          className={s.toggle}
          style={{ background: staging ? 'var(--accent)' : 'var(--n-300)' }}
        >
          <span className={s.toggleKnob} style={{ left: staging ? 20 : 3 }} />
        </button>
      </div>

      <div className={s.actions}>
        <Button variant="primary" onClick={onSubmit}>
          Create project
        </Button>
        <Button variant="quiet" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}

// Sign up.dc.html:155-203 (`sc-if value="{{ isKeys }}"`). Renders exactly what the source shows
// and no more (task-12-brief.md): no success toast, no fake loading state, no fake error. The
// "Open the dashboard" and "Copy" controls carry no handler here because the source itself wires
// none to them — unlike every other actionable control on this page (goProject, goKeys,
// goAccount, region.pick, toggleStaging, setSdk all have one) — so they stay inert rather than
// inventing a destination or a clipboard behaviour the mockup never specified.
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

  return (
    <div className={s.step}>
      <div className={s.stepHead}>
        <div className={s.liveRow}>
          <StatusDot status="live" size={10} />
          <h2 className={s.stepTitle}>live-classroom is live</h2>
        </div>
        <span className={`sl-num ${s.stepSub}`}>
          {region} · production{staging ? ' + staging' : ''}
        </span>
      </div>

      <AlertBanner
        severity="warning"
        title="Copy your secret key now"
        message="This is the only time it is displayed. If you lose it, revoke the key and generate a new one — there is no recovery."
      />

      <div className={s.credList}>
        {credentials.map((c) => (
          <div key={c.label} className={s.credRow}>
            <span className="sl-label">{c.label}</span>
            <div className={s.credValue}>
              <span className={`sl-num ${s.credText}`}>{c.value}</span>
              <IconButton label="Copy" size={28}>
                <Icon name="copy" size={14} />
              </IconButton>
            </div>
          </div>
        ))}
      </div>

      <div className={s.sdkBlock}>
        <div className={s.sdkHead}>
          <span className="sl-label">Connect your client</span>
          <span className={s.sdkSpacer} />
          <Tabs variant="segmented" tabs={SDK_TABS} activeId={sdk} onSelect={onSdk} />
        </div>
        <div className={s.sdkBox}>
          {lines.map((line, i) => (
            <span key={i} className={s.sdkLine}>
              {line}
            </span>
          ))}
        </div>
      </div>

      <div className={s.finalRow}>
        <Button variant="primary">Open the dashboard</Button>
        <Button>Read the docs</Button>
        <span className={s.finalSpacer} />
        <span className={s.finalNote}>No peers yet — the overview fills on the first join.</span>
      </div>
    </div>
  );
}
