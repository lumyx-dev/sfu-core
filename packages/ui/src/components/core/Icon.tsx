import {
  Activity, ArrowDownRight, ArrowUpRight, Bell, Check, ChevronDown, ChevronLeft,
  ChevronRight, CircleAlert, CircleCheck, CirclePlay, Clock, Copy, Database,
  Download, ExternalLink, Eye, Filter as Funnel, Gauge, GitBranch, Info, LayoutDashboard,
  List, Mic, MicOff, Monitor, PanelLeft, Pause, Play, RadioTower, RefreshCw,
  Search, Server, Settings, Share2, Signal, SlidersHorizontal, Telescope,
  Terminal, TrendingDown, TrendingUp, TriangleAlert, Users, Video, VideoOff,
  Wifi, WifiOff, X, Zap, type LucideIcon,
} from "lucide-react";

import { cn } from "../../lib/cn";

/**
 * The 49 icons the design system vendors, keyed by their Lucide slug.
 *
 * Upstream, `Icon` fetched an SVG from unpkg at runtime and injected it with
 * `dangerouslySetInnerHTML`. That is fine on a design canvas and wrong in an
 * app: a network round-trip per glyph, nothing on the server pass, and an
 * innerHTML sink. Importing from `lucide-react` gives the same artwork,
 * server-rendered, with the set closed to what the system actually uses.
 *
 * Lucide is a flagged substitution — the source repo ships no icon set. Adding
 * a name here is fine; drawing a new pictogram for Sightline is not. If Lucide
 * has no monoline match, use a label.
 */
export const icons = {
  "activity": Activity,
  "arrow-down-right": ArrowDownRight,
  "arrow-up-right": ArrowUpRight,
  "bell": Bell,
  "check": Check,
  "chevron-down": ChevronDown,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "circle-alert": CircleAlert,
  "circle-check": CircleCheck,
  "circle-play": CirclePlay,
  "clock": Clock,
  "copy": Copy,
  "database": Database,
  "download": Download,
  "external-link": ExternalLink,
  "eye": Eye,
  "funnel": Funnel,
  "gauge": Gauge,
  "git-branch": GitBranch,
  "info": Info,
  "layout-dashboard": LayoutDashboard,
  "list": List,
  "mic": Mic,
  "mic-off": MicOff,
  "monitor": Monitor,
  "panel-left": PanelLeft,
  "pause": Pause,
  "play": Play,
  "radio-tower": RadioTower,
  "refresh-cw": RefreshCw,
  "search": Search,
  "server": Server,
  "settings": Settings,
  "share-2": Share2,
  "signal": Signal,
  "sliders-horizontal": SlidersHorizontal,
  "telescope": Telescope,
  "terminal": Terminal,
  "trending-down": TrendingDown,
  "trending-up": TrendingUp,
  "triangle-alert": TriangleAlert,
  "users": Users,
  "video": Video,
  "video-off": VideoOff,
  "wifi": Wifi,
  "wifi-off": WifiOff,
  "x": X,
  "zap": Zap,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof icons;

export interface IconProps {
  /** Lucide slug, e.g. `"radio-tower"`. */
  name: IconName;
  /** House default is 16. */
  size?: number;
  /**
   * House default is 1.75 — heavier than Lucide's own 2 would read at 14px,
   * and matched to Geist's stroke.
   */
  strokeWidth?: number;
  className?: string;
  "aria-hidden"?: boolean;
}

export function Icon({
  name,
  size = 16,
  strokeWidth = 1.75,
  className,
  "aria-hidden": ariaHidden = true,
}: IconProps) {
  const Glyph = icons[name];
  return (
    <Glyph
      size={size}
      strokeWidth={strokeWidth}
      aria-hidden={ariaHidden}
      aria-label={ariaHidden ? undefined : name}
      className={cn("shrink-0", className)}
    />
  );
}
