export interface NavLink {
  label: string;
  href: string;
}

export interface FooterColumn {
  title: string;
  links: NavLink[];
}

export const SITE_VERSION = 'v0.4.1';

export const GITHUB_URL = 'https://github.com/FrekiManagarm/sightline';

export const HEADER_NAV: NavLink[] = [
  { label: 'Why Sightline', href: '/#why' },
  { label: 'Observability', href: '/#observability' },
  { label: 'vs LiveKit', href: '/compare/livekit' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Docs', href: '/docs' },
];

export const FOOTER_COLUMNS: FooterColumn[] = [
  {
    title: 'Product',
    links: [
      { label: 'Observability', href: '/#observability' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'vs LiveKit', href: '/compare/livekit' },
      { label: 'Cloud console', href: '#' },
    ],
  },
  {
    title: 'Developers',
    links: [
      { label: 'Docs', href: '/docs' },
      { label: 'Metrics reference', href: '/docs#thresholds' },
      { label: 'Changelog', href: '/changelog' },
      { label: 'Status', href: '#' },
    ],
  },
  {
    title: 'Open source',
    links: [
      { label: 'GitHub', href: GITHUB_URL },
      { label: 'Roadmap', href: '#' },
      { label: 'Contributing', href: '#' },
      { label: 'License', href: '#' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Blog', href: '#' },
      { label: 'Contact', href: '#' },
      { label: 'Sign in', href: '/signup' },
    ],
  },
];
