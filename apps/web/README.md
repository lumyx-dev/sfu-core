# @sightline/web

The Sightline marketing site — the public pages (home, pricing, the LiveKit comparison, docs,
changelog, sign up). A Next.js App Router app that consumes the shared `@sightline/ui` component
and token library for all of its UI.

## Running it

From the monorepo root, or from this directory:

```bash
bun run dev
```

The dev server runs on port **3002** (not 3000 — that's the dashboard; 3001 is the cloud app).
Open [http://localhost:3002](http://localhost:3002) to see it.

## Notes

- Content lives under `content/` (e.g. `content/pricing.ts`, `content/metrics.ts`) rather than
  hardcoded in components.
- `scripts/verify-ds.mjs` checks this app's CSS/markup against the design system's tokens —
  run it with `bun run verify:ds`.
