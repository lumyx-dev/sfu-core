import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sightline — the WebRTC SFU that tells you why the call was bad',
  description:
    'Open-source Rust SFU with observability in the media path: jitter, packet loss, RTT, NACK ratio, freeze ratio — per peer, per room, live.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body>{children}</body>
    </html>
  );
}
