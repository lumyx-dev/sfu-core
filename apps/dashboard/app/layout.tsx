import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import './globals.css';
import { DashboardChrome } from '@/components/dashboard-chrome';

export const metadata: Metadata = {
  title: 'Sightline — self-hosted dashboard',
  description: 'Rooms, peers, alerts and session replay for a self-hosted Sightline SFU.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body>
        <DashboardChrome>{children}</DashboardChrome>
      </body>
    </html>
  );
}
