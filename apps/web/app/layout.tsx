import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { ThemeProvider } from 'next-themes';
import './globals.css';

export const metadata: Metadata = {
  // opengraph-image.png and twitter-image.png sit next to this file; Next turns them
  // into meta tags, but only resolves them to absolute URLs once it has a base.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lumyx.dev'),
  title: 'Lumyx — the WebRTC SFU that tells you why the call was bad',
  description:
    'Open-source Rust SFU with observability in the media path: jitter, packet loss, RTT, NACK ratio, freeze ratio — per peer, per room, live.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={GeistSans.variable} suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
