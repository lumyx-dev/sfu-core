'use client';

import {
  LayoutDashboard,
  RadioTower,
  Users,
  Bell,
  Gauge,
  CirclePlay,
  Terminal,
  Server,
  SlidersHorizontal,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarNav,
  SidebarProvider,
  StatusStrip,
  Wordmark,
  type NavSection,
} from '@lumyx/ui';
import Link from 'next/link';

const SECTIONS: NavSection[] = [
  {
    label: 'Live',
    items: [
      { href: '/', label: 'Overview', icon: LayoutDashboard },
      { href: '/rooms', label: 'Rooms', icon: RadioTower },
      { href: '/peers', label: 'Peers', icon: Users },
      { href: '/alerts', label: 'Alerts', icon: Bell },
    ],
  },
  {
    label: 'History',
    items: [
      { href: '/metrics', label: 'Metrics', icon: Gauge },
      { href: '/replay', label: 'Session replay', icon: CirclePlay },
      { href: '/signaling', label: 'Signaling', icon: Terminal },
    ],
  },
  {
    label: 'Instance',
    items: [
      { href: '/server', label: 'Server', icon: Server },
      { href: '/settings', label: 'Settings', icon: SlidersHorizontal },
    ],
  },
];

export function DashboardChrome({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <Sidebar collapsible="offcanvas" className="border-hairline">
        <SidebarHeader className="px-3 py-4">
          <Link href="/" className="px-2 no-underline hover:no-underline">
            <Wordmark />
          </Link>
        </SidebarHeader>
        <SidebarContent className="sl-scroll gap-5 px-3">
          <SidebarNav sections={SECTIONS} />
        </SidebarContent>
        <SidebarFooter className="px-5 py-4">
          <span className="sl-num text-11 text-faint">v0.4.1 · MIT licensed · sfu-eu-3</span>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="grid h-svh grid-rows-[auto_1fr_auto] overflow-hidden">
        {children}
        <StatusStrip
          items={[
            { label: 'Signaling', value: 'wss://127.0.0.1:3000/ws', live: true },
            { label: 'Rooms', value: '4' },
            { label: 'Peers', value: '65' },
            { label: 'Alerts', value: '4' },
            { label: 'Retention', value: '7d' },
          ]}
        />
      </SidebarInset>
    </SidebarProvider>
  );
}
