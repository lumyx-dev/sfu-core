// UNVERIFIED — chiffres proposés par le handoff de design, non validés produit.
// Origine : $HANDOFF/designs/Pricing.dc.html (const PLANS, PRICING_GROUPS, FAQ + estimate()).
// Le modèle Cloud (plans, quotas, unités de facturation, prix) doit être confirmé contre
// sightline-cloud avant toute mise en ligne publique.

export type Period = 'monthly' | 'annual';

export interface Estimate {
  plan: string;
  cost: string;
  note: string;
}

export interface Plan {
  name: string;
  price: string;
  per: string;
  headline: string;
  who: string;
  features: string[];
  cta: string;
  variant: 'primary' | 'secondary';
  featured: boolean;
}

export interface PricingRow {
  label: string;
  v: string[];
}

export interface PricingGroup {
  title: string;
  rows: PricingRow[];
}

export interface FaqEntry {
  q: string;
  a: string;
}

const FREE_MINUTES = 10_000;
const STARTER_MINUTES = 50_000;
const SCALE_MINUTES = 500_000;
const BUSINESS_MINUTES = 1_200_000;
const STARTER_OVERAGE = 0.0012;
const SCALE_OVERAGE = 0.0009;

const fmt = (n: number) => n.toLocaleString('en-US');
const eur = (n: number) =>
  '€' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export function estimate(minutes: number, period: Period): Estimate {
  const m = minutes;
  const yearly = period === 'annual';
  const starterBase = yearly ? 39 : 49;
  const scaleBase = yearly ? 399 : 499;

  if (m <= FREE_MINUTES) {
    return {
      plan: 'Free',
      cost: '€0',
      note: 'Under 10,000 participant-minutes a month you stay on Free — no card, no expiry. Past the cap, new rooms are refused until you pick a plan.',
    };
  }

  const starter = starterBase + Math.max(0, m - STARTER_MINUTES) * STARTER_OVERAGE;
  const scale = scaleBase + Math.max(0, m - SCALE_MINUTES) * SCALE_OVERAGE;

  if (m > BUSINESS_MINUTES) {
    return {
      plan: 'Business',
      cost: 'Custom',
      note: 'Above roughly 1.2M minutes a month, negotiated volume beats list price. Dedicated regions and an SLA come with it.',
    };
  }

  if (starter <= scale) {
    return {
      plan: 'Starter',
      cost: eur(Math.round(starter)),
      note:
        m > STARTER_MINUTES
          ? `Starter base ${eur(starterBase)} + ${fmt(m - STARTER_MINUTES)} overage minutes at €0.0012. Scale would cost ${eur(Math.round(scale))}.`
          : 'Starter includes 50,000 minutes, so nothing above the base at this volume.',
    };
  }

  return {
    plan: 'Scale',
    cost: eur(Math.round(scale)),
    note:
      m > SCALE_MINUTES
        ? `Scale base ${eur(scaleBase)} + ${fmt(m - SCALE_MINUTES)} overage minutes at €0.0009. Starter would cost ${eur(Math.round(starter))}.`
        : 'Scale includes 500,000 minutes and costs less than Starter overage at this volume.',
  };
}

export const PLAN_COLUMNS = ['Self-hosted', 'Free', 'Starter', 'Scale', 'Business'];
export const HIGHLIGHT = 3;

export const PLANS: Record<Period, Plan[]> = {
  monthly: [
    {
      name: 'Self-hosted',
      price: '€0',
      per: 'forever',
      headline: 'MIT, no metering',
      who: 'You run the binary on your own infra.',
      features: [
        'Unlimited participant-minutes',
        'All 6 metrics + thresholds',
        'Dashboard included',
        'Retention = your storage',
      ],
      cta: 'View on GitHub',
      variant: 'secondary',
      featured: false,
    },
    {
      name: 'Free',
      price: '€0',
      per: '/mo',
      headline: '10,000 participant-minutes',
      who: 'Prototypes, staging, or a first trickle of production traffic.',
      features: ['50 GB egress included', '1 project · 1 region', '24-hour retention', 'Email alerts'],
      cta: 'Get started free',
      variant: 'secondary',
      featured: false,
    },
    {
      name: 'Starter',
      price: '€49',
      per: '/mo',
      headline: '50,000 participant-minutes',
      who: 'First production app, one or two environments.',
      features: ['1 TB egress included', '3 projects · 2 regions', '7-day retention', 'Email + webhook alerts'],
      cta: 'Get started free',
      variant: 'secondary',
      featured: false,
    },
    {
      name: 'Scale',
      price: '€499',
      per: '/mo',
      headline: '500,000 participant-minutes',
      who: 'Video is the product and someone is on call.',
      features: [
        '4 TB egress included',
        'Unlimited projects · 4 regions',
        '30-day retention + session replay',
        'Slack + PagerDuty',
      ],
      cta: 'Get started free',
      variant: 'primary',
      featured: true,
    },
    {
      name: 'Business',
      price: 'Custom',
      per: '',
      headline: 'Negotiated volume',
      who: 'Contractual commitments and dedicated capacity.',
      features: ['Dedicated regions', '99.95% SLA · 1h support', 'SSO + audit log', '90-day retention or more'],
      cta: 'Contact us',
      variant: 'secondary',
      featured: false,
    },
  ],
  annual: [
    {
      name: 'Self-hosted',
      price: '€0',
      per: 'forever',
      headline: 'MIT, no metering',
      who: 'You run the binary on your own infra.',
      features: [
        'Unlimited participant-minutes',
        'All 6 metrics + thresholds',
        'Dashboard included',
        'Retention = your storage',
      ],
      cta: 'View on GitHub',
      variant: 'secondary',
      featured: false,
    },
    {
      name: 'Free',
      price: '€0',
      per: '/mo',
      headline: '10,000 participant-minutes',
      who: 'Prototypes, staging, or a first trickle of production traffic.',
      features: ['50 GB egress included', '1 project · 1 region', '24-hour retention', 'Email alerts'],
      cta: 'Get started free',
      variant: 'secondary',
      featured: false,
    },
    {
      name: 'Starter',
      price: '€39',
      per: '/mo',
      headline: '50,000 min · billed yearly',
      who: 'First production app, one or two environments.',
      features: ['1 TB egress included', '3 projects · 2 regions', '7-day retention', 'Email + webhook alerts'],
      cta: 'Get started free',
      variant: 'secondary',
      featured: false,
    },
    {
      name: 'Scale',
      price: '€399',
      per: '/mo',
      headline: '500,000 min · billed yearly',
      who: 'Video is the product and someone is on call.',
      features: [
        '4 TB egress included',
        'Unlimited projects · 4 regions',
        '30-day retention + session replay',
        'Slack + PagerDuty',
      ],
      cta: 'Get started free',
      variant: 'primary',
      featured: true,
    },
    {
      name: 'Business',
      price: 'Custom',
      per: '',
      headline: 'Negotiated volume',
      who: 'Contractual commitments and dedicated capacity.',
      features: ['Dedicated regions', '99.95% SLA · 1h support', 'SSO + audit log', '90-day retention or more'],
      cta: 'Contact us',
      variant: 'secondary',
      featured: false,
    },
  ],
};

export const PRICING_GROUPS: PricingGroup[] = [
  {
    title: 'Usage',
    rows: [
      { label: 'Participant-minutes included', v: ['Unmetered', '10,000', '50,000', '500,000', 'Negotiated'] },
      { label: 'Overage rate', v: ['—', 'Hard stop', '€0.0012/min', '€0.0009/min', 'Custom'] },
      { label: 'Egress included', v: ['Your bandwidth', '50 GB', '1 TB', '4 TB', 'Custom'] },
      { label: 'Concurrent peers', v: ['Your hardware', '25', '500', '5,000', 'Custom'] },
      { label: 'Projects', v: ['Unlimited', '1', '3', 'Unlimited', 'Unlimited'] },
      { label: 'Regions', v: ['Self-managed', '1', '2', '4', 'Dedicated'] },
      { label: 'Spend cap', v: ['—', 'Not needed', 'Included', 'Included', 'Included'] },
    ],
  },
  {
    title: 'Observability',
    rows: [
      { label: 'All 6 metrics, per peer and per room', v: ['Included', 'Included', 'Included', 'Included', 'Included'] },
      { label: 'Metrics retention', v: ['Your storage', '24 hours', '7 days', '30 days', '90 days+'] },
      { label: 'Room topology', v: ['Included', 'Included', 'Included', 'Included', 'Included'] },
      { label: 'Session replay', v: ['Included', '—', '—', 'Included', 'Included'] },
      { label: 'Prometheus endpoint', v: ['Included', '—', 'Included', 'Included', 'Included'] },
      { label: 'CSV export', v: ['Your database', '—', 'Included', 'Included', 'Included'] },
    ],
  },
  {
    title: 'Alerting',
    rows: [
      { label: 'Default + custom thresholds', v: ['Included', 'Included', 'Included', 'Included', 'Included'] },
      { label: 'Email alerts', v: ['Included', 'Included', 'Included', 'Included', 'Included'] },
      { label: 'Signed webhooks', v: ['Included', '—', 'Included', 'Included', 'Included'] },
      { label: 'Slack', v: ['Self-wired', '—', '—', 'Included', 'Included'] },
      { label: 'PagerDuty', v: ['Self-wired', '—', '—', 'Included', 'Included'] },
    ],
  },
  {
    title: 'Team & support',
    rows: [
      { label: 'Team members', v: ['Unlimited', '1', '3', 'Unlimited', 'Unlimited'] },
      { label: 'Keys per environment', v: ['Self-managed', 'Production only', 'Included', 'Included', 'Included'] },
      { label: 'SSO + audit log', v: ['—', '—', '—', '—', 'Included'] },
      { label: 'Support', v: ['Community', 'Community', 'Email · 48h', 'Email · 24h', 'Dedicated · 1h'] },
      { label: 'Uptime SLA', v: ['—', '—', '—', '99.9%', '99.95%'] },
    ],
  },
];

export const FAQ: FaqEntry[] = [
  {
    q: 'What exactly is a participant-minute?',
    a: 'One minute of one peer present in a room. A 4-person call for 10 minutes is 40 participant-minutes. Publishing or only subscribing counts the same.',
  },
  {
    q: 'What happens when I hit the spend cap?',
    a: 'New rooms are refused with an explicit error code, sessions already running are preserved to the end, and an alert fires before the cap is reached.',
  },
  {
    q: 'Is anything held back from the open-source version?',
    a: 'No. The SFU, the six metrics, the thresholds, the alerting and the dashboard are all in the MIT repo. Cloud sells operation — regions, quotas, retention, keys per environment.',
  },
  {
    q: 'Can I move from Cloud back to self-hosted?',
    a: 'Yes. Same signaling and same token grants: point your clients at your own URL. Metrics history exports as CSV before you leave.',
  },
  {
    q: 'How is egress measured?',
    a: 'Outbound bytes from the SFU to peers. Inbound is never billed, and peer-to-peer traffic that never touches the SFU is not counted.',
  },
  {
    q: 'Do failed or abandoned calls count?',
    a: 'A peer is metered from the moment it joins a room to the moment it disconnects. An ICE failure that never joins costs nothing.',
  },
  {
    q: 'Is the free tier time-limited?',
    a: 'No. 10,000 participant-minutes per month, no card, no expiry. It resets on the 1st, UTC.',
  },
  {
    q: 'Can I mix Cloud and self-hosted?',
    a: 'Common setup: self-hosted for internal environments, Cloud for production regions you would rather not operate. Both report to the same dashboard shape.',
  },
];
