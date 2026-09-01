import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import Script from 'next/script';
import './globals.css';

const PLAUSIBLE_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN ?? 'lumyx.dev';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lumyx.dev'),
  title: 'Lumyx — the WebRTC SFU that tells you why the call was bad',
  description:
    'Open-source Rust SFU with observability in the media path: jitter, packet loss, RTT, NACK ratio, freeze ratio — per peer, per room, live.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body>
        {children}
        {process.env.NODE_ENV === 'production' ? (
          <Script
            defer
            data-domain={PLAUSIBLE_DOMAIN}
            src="https://plausible.io/js/script.js"
            strategy="afterInteractive"
          />
        ) : null}
      </body>
    </html>
  );
}
