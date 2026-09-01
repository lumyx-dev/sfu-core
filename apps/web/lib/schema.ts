import { REPO, VERSION } from './site-data';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lumyx.dev';

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Lumyx',
    url: SITE_URL,
    logo: `${SITE_URL}/icon.png`,
    sameAs: [REPO],
  };
}

export function softwareApplicationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Lumyx',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Linux, macOS, Windows',
    softwareVersion: VERSION,
    description:
      'Open-source WebRTC SFU written in Rust with observability — jitter, packet loss, RTT, NACK ratio, freeze ratio — measured inside the media path.',
    url: SITE_URL,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Self-hosted, MIT licensed, unmetered.',
    },
  };
}
