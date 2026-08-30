# @sightline/ui

The Sightline design system: 37 React components, 9 CSS token files, and a shared `Icon`
component (Lucide), ported verbatim from the design handoff
(`designs/_ds/sightline-design-system-*/`) into this Turborepo workspace. It ships no build step —
consumers import the TypeScript source directly and compile it themselves via
`transpilePackages`.

Full design rationale, conversion rules, and the source-of-truth component signatures live in
[`docs/superpowers/specs/2026-08-29-sightline-design-system-design.md`](../../docs/superpowers/specs/2026-08-29-sightline-design-system-design.md).
Read that before changing anything here — this README only covers how to consume the package.

## What's in the package

```
src/
  components/
    core/       Badge, Button, Card, Icon, IconButton, Input, Pill, Select, StatusDot
    layout/     AppShell, DashboardGrid (+ GridItem), SplitPane, StatusStrip
    navigation/ Breadcrumb, Sidebar, Tabs, Toolbar
    feedback/   AlertBanner, EmptyState, ErrorState, LoadingSkeleton, SeverityBadge,
                Toast (+ ToastStack)
    data/       DataTable, EventList, MetricCard, MetricGrid, ProgressBar, Sparkline,
                TimeSeriesChart
    webrtc/     LatencyChip, PeerCard, QualityIndicator, RoomCard, VideoTile
  tokens/       9 CSS files — see "Tokens" below
  lib/          cn() class helper, the Icon name → Lucide glyph map
  index.ts      barrel — every component and its prop types are re-exported from here
  styles.css    imports every tokens/*.css file, in order
```

37 components in total. Each lives in its own folder as `<Name>.tsx` + `<Name>.module.css` +
`index.ts`, styled with CSS Modules scoped through the package boundary (confirmed to work under
Next 16's `transpilePackages` — see spec §9). `EventList` is the **only** component carrying
`'use client'` (it needs a ref + effect for `autoScroll`); every other component is a plain
Server Component and renders fine from one. Component props never accept raw colors — every
color reaches a component through a CSS custom property (`var(--*)`), never a literal hex/rgb
value, which is enforced by `verify:ds` (see below).

## Consuming it from an app

Four steps, the same for `dashboard`, `sightline-cloud`, and any future app in this monorepo:

1. **Add the workspace dependency** — in the app's `package.json`:
   ```json
   "dependencies": { "@sightline/ui": "workspace:*" }
   ```
2. **Transpile it** — this package ships TypeScript/TSX source, not a build, so Next must
   compile it itself. In the app's `next.config.ts`:
   ```ts
   const nextConfig: NextConfig = {
     transpilePackages: ['@sightline/ui'],
   };
   ```
3. **Import the stylesheet once** — a single import pulls in all 9 token files plus the shared
   base/utility classes (`sl-label`, `sl-num`, `sl-scroll`, `sl-shimmer`, …). Put it in
   `app/globals.css` (or the root layout) — never per-component:
   ```css
   @import '@sightline/ui/styles.css';
   ```
4. **Wire up Geist as `--font-sans`** — the design system's type scale assumes Geist is
   available under the CSS variable the tokens read from. Declare it via `next/font` in the root
   layout and expose it as `--font-geist`:
   ```tsx
   import { Geist } from 'next/font/google';

   const geist = Geist({
     subsets: ['latin'],
     weight: ['300', '400', '500', '600', '700'],
     variable: '--font-geist',
   });

   export default function RootLayout({ children }: LayoutProps<'/'>) {
     return <html className={geist.variable}>{/* ... */}</html>;
   }
   ```
   `apps/dashboard` already does this — its declaration is what decided the family for the whole
   design system; copy it rather than reinventing it.

Dark mode needs no extra wiring on the consumer's side: wrap any subtree in a `.theme-dark`
class (or render `<AppShell theme="dark">`, which does exactly that internally) and the CSS
custom properties repoint themselves. No component branches on theme in JS.

## Tokens — do not hand-edit

`src/tokens/*.css` (9 files: `base`, `elevation`, `fonts`, `motion`, `palette`, `radius`,
`semantic`, `spacing`, `typography`) are **copied verbatim from the design handoff**. They are
not authored here and must never be hand-edited — any local change becomes drift the next time
someone re-syncs from a new handoff, and `bun run verify:ds` will catch and fail on that drift
(byte-for-byte diff against `$DS/tokens/*`, `fonts.css` excepted from the content check since the
handoff's copy references machine-local font files). If a token needs to change, it changes in
the handoff first, then gets re-copied here — not edited in place.

## Verifying changes

- `bun run check-types` — TypeScript, no emit.
- `DS=<path to the handoff's _ds folder> bun run verify:ds` — no hardcoded colors outside
  `tokens/`, `EventList` is the only `'use client'` component, no stray monospace, and (when `$DS`
  is set) the 9 token files match the handoff byte-for-byte.
- `bun run lint` — note this package has no `lint` script of its own; only apps in this monorepo
  run ESLint today.
- The `/_ds` route in `apps/dashboard` (`app/_ds/page.tsx`) is the visual gallery: every
  component in every documented prop variant, rendered once in light and once wrapped in
  `.theme-dark`. There are no snapshot/unit tests for visual fidelity — comparing `/_ds` against
  the handoff's `.dc.html` mockups side by side is the actual verification protocol (spec §8).
