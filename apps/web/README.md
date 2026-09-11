# @lumyx/web

The Lumyx marketing site — the public pages (home, pricing, comparison, docs, changelog,
sign up). A Next.js App Router app that consumes the shared `@lumyx/ui` component and token
library for all of its UI.

## Not production content

**This app must not be deployed publicly yet.** It builds and runs cleanly, but a large share of
what it says has not been verified against the actual product:

- **The whole positioning is out of date.** This site was written when Lumyx was pitched as a
  drop-in LiveKit replacement — `/compare`, the "From LiveKit" migration guide, the
  `livekit-pivoted-to-ai-agents` blog post, "Drop-in LiveKit signaling" on `/signup` and the
  footer's "vs LiveKit" all predate the repositioning against the low-level SFU toolkits
  (mediasoup, Janus, ion-sfu). The signaling-compatibility claims are also not backed by the SFU:
  the protocol is Lumyx's own JSON, not LiveKit's. Rewriting this is tracked separately.
- **Pricing** (`lib/site-data.ts`, `app/pricing/`) — plans, quotas, billing units and prices come
  from a design proposal made without access to the Cloud repo.
- **Benchmarks** (`lib/platform-data.ts`) — figures are illustrative, not measured.
- **Releases** (`app/changelog/`) — changelog entries were authored for the design handoff,
  not pulled from an actual release history.
- **The metrics reference** (`lib/docs-data.ts`, `/docs`) — the six metrics and thresholds
  documented there do not exist in `apps/sfu/src` today; the README there marks them
  "Planned — next milestone."
- **The comparison claims** (`app/compare/`, `lib/site-data.ts`) — including a full column
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

- Content lives under `lib/` (e.g. `lib/site-data.ts`, `lib/docs-data.ts`) rather than
  hardcoded in components.
- `scripts/verify-ds.mjs` checks this app's CSS/markup against the design system's tokens —
  run it with `bun run verify:ds`.
