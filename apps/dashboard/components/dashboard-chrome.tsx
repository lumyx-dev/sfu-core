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
import { AppShell, StatusStrip } from '@lumyx/ui';

const SECTIONS = [
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
    <AppShell
      sections={SECTIONS}
      footer={<span className="sl-num text-11 text-faint">v0.4.1 · MIT licensed · sfu-eu-3</span>}
    >
      <div className="sl-scroll min-w-0 overflow-auto p-6">{children}</div>
      <StatusStrip
        items={[
          { label: 'Signaling', value: 'wss://127.0.0.1:3000/ws', live: true },
          { label: 'Rooms', value: '4' },
          { label: 'Peers', value: '65' },
          { label: 'Alerts', value: '4' },
          { label: 'Retention', value: '7d' },
        ]}
      />
    </AppShell>
  );
}
