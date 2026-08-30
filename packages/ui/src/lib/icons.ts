import {
  Activity, Bell, Check, ChevronDown, CircleAlert, CircleCheck, CirclePlay, Copy,
  Database, Download, ExternalLink, GitBranch, Gauge, Info, LayoutDashboard, List,
  Monitor, RadioTower, RefreshCw, Search, Server, Settings, Share2, SlidersHorizontal,
  Terminal, TriangleAlert, Users, VideoOff, X,
  type LucideIcon,
} from 'lucide-react';

/** Noms kebab-case de lucide-static, tels que les maquettes les écrivent. */
export const ICONS = {
  'activity': Activity,
  'bell': Bell,
  'check': Check,
  'chevron-down': ChevronDown,
  'circle-alert': CircleAlert,
  'circle-check': CircleCheck,
  'circle-play': CirclePlay,
  'copy': Copy,
  'database': Database,
  'download': Download,
  'external-link': ExternalLink,
  'gauge': Gauge,
  'git-branch': GitBranch,
  'info': Info,
  'layout-dashboard': LayoutDashboard,
  'list': List,
  'monitor': Monitor,
  'radio-tower': RadioTower,
  'refresh-cw': RefreshCw,
  'search': Search,
  'server': Server,
  'settings': Settings,
  'share-2': Share2,
  'sliders-horizontal': SlidersHorizontal,
  'terminal': Terminal,
  'triangle-alert': TriangleAlert,
  'users': Users,
  'video-off': VideoOff,
  'x': X,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;
