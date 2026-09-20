import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { RootProvider } from 'fumadocs-ui/provider/next';
import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_DOCS_URL ?? 'https://docs.lumyx.dev';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Lumyx documentation',
    template: '%s — Lumyx docs',
  },
  description:
    'Run, self-host and observe a Lumyx SFU: quickstart, deployment, the six media-path metrics and the REST API.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      {/* flex + min-h-screen sont requis par les layouts de Fumadocs UI. */}
      <body className="flex min-h-screen flex-col">
        {/* Les valeurs reprennent apps/landing/app/layout.tsx : sans alignement, les deux
            domaines ouvrent dans des themes differents. RootProvider embarque next-themes. */}
        <RootProvider
          theme={{ attribute: 'class', defaultTheme: 'dark', enableSystem: false }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
