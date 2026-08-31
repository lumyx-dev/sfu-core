import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import { MarketingMotion } from '@/components/motion/MarketingMotion';
import { ScrollProgress } from '@/components/motion/ScrollProgress';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });

export const metadata: Metadata = {
  title: 'Sightline — observability in the media path',
  description:
    'A Rust WebRTC SFU with jitter, packet loss, RTT and NACK ratio per peer and per room, live.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full">
        <ScrollProgress />
        {children}
        <MarketingMotion />
      </body>
    </html>
  );
}
