# @lumyx/web

<<<<<<< HEAD
The Sightline marketing site — the public pages (home, pricing, the LiveKit comparison, docs,
=======
The Lumyx marketing site — the public pages (home, pricing, the LiveKit comparison, docs,
>>>>>>> 15cfcbac43ea3d10794f309c8dc50fe75c5c4b4b
changelog, sign up). A Next.js App Router app that consumes the shared `@lumyx/ui` component
and token library for all of its UI.

## Not production content

**This app must not be deployed publicly yet.** It builds and runs cleanly, but a large share of
what it says has not been verified against the actual product:

- **Pricing** (`content/pricing.ts`) — plans, quotas, billing units and prices come from a design
  proposal made without access to the Cloud repo.
- **Benchmarks** (`content/benchmarks.ts`) — figures are illustrative, not measured.
- **Releases** (`content/releases.ts`) — changelog entries were authored for the design handoff,
  not pulled from an actual release history.
- **The metrics reference** (`content/metrics.ts`, `/docs`) — the six metrics and thresholds
  documented there do not exist in `apps/sfu/src` today; the README there marks them
  "Planned — next milestone."
- **The comparison claims** (`content/compare.ts`, `content/home.ts`) — including a full column
  of claims about LiveKit, a named third party's product, which is an unverified
  characterisation and carries real reputational and legal risk if published as-is.

Every one of these is called out in the design spec's own risk section — see
`docs/superpowers/specs/2026-08-30-sightline-marketing-site-design.md` §12 — which makes
"must not be deployed publicly" the headline risk of this branch. Confirm the numbers and claims
above against the real implementation before this site goes live anywhere public.

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
