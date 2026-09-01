# SEO Phase 1 — Foundations + First Post Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Phase 1 technical SEO foundations (structured data, sitemap, robots, analytics) and the first blog post for `apps/web`, per the gate check result below.

**Architecture:** Next.js 16 App Router conventions (`app/sitemap.ts`, `app/robots.ts`) for crawler-facing files; a small hand-authored blog registry (`lib/blog-data.ts` for metadata + `components/blog/posts/*.tsx` for bodies) matching this codebase's existing per-route page pattern (no MDX/CMS — `compare`, `pricing`, `changelog` are all hand-authored TSX, so the blog follows suit); JSON-LD rendered as literal `<script>` children (not `dangerouslySetInnerHTML`, which this repo's design-system linter forbids).

**Tech Stack:** Next.js 16.3.2 (App Router), React 19, Tailwind v4 via `@lumyx/ui` tokens, Bun, Turborepo.

**Spec:** `docs/superpowers/specs/lumyx-seo-strategy.md`

## Gate check result (2026-09-01)

Per spec section 1: core forwarding stability = **NO**, external users = **NO**, name = **Lumyx tranché** (`lumyx.dev`). This means **Phase 1 only** (spec section 5). Do not build anything from Phase 2/3 (`/livekit-alternative`, `/compare/lumyx-vs-*`, SEA, Show HN, use-case pages). The existing `/compare` page predates this plan and is out of scope — do not touch it.

**Content scope note:** spec section 5's content table lists five pages (`/rust-webrtc-sfu`, `/webrtc-observability`, `/blog/livekit-pivoted-to-ai-agents`, `/blog/str0m-vs-pion`, one bug-fix post). Per spec section 8, this plan builds only the technical foundations (Tasks 1, 2, 4) plus the one content page that "doesn't depend on any product-stability condition" — the LiveKit post (Task 3). The other four content pages are separate follow-up plans, written once their subject matter is ready (e.g. the bug-fix post needs the mid/SSRC bug actually closed first).

## Global Constraints

- **Dev-status disclosure (spec section 4, non-negotiable):** every new content page must explicitly surface "in active development" status. Use `AlertBanner` (`@lumyx/ui`, `severity="info"`) — do not invent a new component.
- **No overselling (spec section 4):** no claim of reliability superiority over LiveKit or anyone else. The blog post is analysis of LiveKit's public market position, not a Lumyx-vs-LiveKit comparison.
- **Factual and sourced (spec section 5 table):** every factual claim in the blog post must have a real, working source URL. All five claims below were verified live on 2026-09-01 (GitHub API star counts, LiveKit's own blog, Bloomberg, LiveKit pricing page, Prodinit's guide) — cite these, don't invent numbers.
- **Design system (`apps/web/scripts/verify-ds.mjs`, runs via `bun run verify:ds`):** no hardcoded hex/rgb color (use existing tokens like `text-strong`, `bg-page`, `border-hairline`), no `font-mono`/monospace, no `dangerouslySetInnerHTML`, no `*.module.css`.
- **No unit-test harness for pages in this repo** (`apps/web` has no `*.test.*` files). Verification for every task below is: `check-types` passes, `lint` passes, `verify:ds` passes, `next build` succeeds, and a manual `curl`/browser check of the rendered output. Follow the RTK convention from this repo's `CLAUDE.md` — prefix shell commands with `rtk`.
- Run all commands from `apps/web/` unless noted.

---

### Task 1: Plausible analytics

**Files:**
- Modify: `apps/web/app/layout.tsx`
- Modify: `turbo.json:4` (add env var to `globalEnv`)

**Interfaces:**
- Produces: `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` env var (falls back to `"lumyx.dev"`), a `<Script>` injected site-wide in production only.

- [ ] **Step 1: Add the env var to Turborepo's global env list**

In `turbo.json`, change:
```json
"globalEnv": ["NODE_ENV", "NEXT_PUBLIC_DASHBOARD_URL", "NEXT_PUBLIC_SITE_URL"],
```
to:
```json
"globalEnv": ["NODE_ENV", "NEXT_PUBLIC_DASHBOARD_URL", "NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_PLAUSIBLE_DOMAIN"],
```

- [ ] **Step 2: Wire the Plausible script into the root layout**

In `apps/web/app/layout.tsx`, add the import and render the script only in production:

```tsx
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { ThemeProvider } from 'next-themes';
import Script from 'next/script';
import './globals.css';

const PLAUSIBLE_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN ?? 'lumyx.dev';

export const metadata: Metadata = {
  // opengraph-image.png and twitter-image.png sit next to this file; Next turns them
  // into meta tags, but only resolves them to absolute URLs once it has a base.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lumyx.dev'),
  title: 'Lumyx — the WebRTC SFU that tells you why the call was bad',
  description:
    'Open-source Rust SFU with observability in the media path: jitter, packet loss, RTT, NACK ratio, freeze ratio — per peer, per room, live.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={GeistSans.variable} suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {children}
        </ThemeProvider>
        {process.env.NODE_ENV === 'production' ? (
          <Script
            defer
            data-domain={PLAUSIBLE_DOMAIN}
            src="https://plausible.io/js/script.js"
            strategy="afterInteractive"
          />
        ) : null}
      </body>
    </html>
  );
}
```

> **Note on baseline:** this is the file as it exists on `main` right now — no `ThemeProvider`, no `suppressHydrationWarning`. If a `next-themes`/`ThemeProvider` change has landed on `main` by the time this task runs, wrap `{children}` in whatever provider is there instead of overwriting it — only the `Script` addition and the `PLAUSIBLE_DOMAIN` constant are this task's job.

- [ ] **Step 3: Verify**

```bash
rtk check-types
rtk lint
rtk next build
```
Expected: all pass. Then run `rtk next start` (after `next build`) and `rtk curl -sI http://localhost:3000/` — confirm the page still serves 200. View-source the page: in a production build you should see the `<script defer data-domain="lumyx.dev" src="https://plausible.io/js/script.js">` tag; running `next dev` should NOT include it (guarded by `NODE_ENV`).

- [ ] **Step 4: Commit**

```bash
rtk git add apps/web/app/layout.tsx turbo.json
rtk git commit -m "feat(web): add Plausible analytics in production"
```

> **Manual follow-up (not code, cannot be done by an agent):** create the Plausible account and add `lumyx.dev` as a site at plausible.io — this requires the user's own login/billing decision. Nothing above sends real data until that site exists on Plausible's side.

---

### Task 2: JSON-LD structured data on the home page

**Files:**
- Create: `apps/web/lib/schema.ts`
- Modify: `apps/web/app/page.tsx`

**Interfaces:**
- Produces: `organizationJsonLd(): Record<string, unknown>`, `softwareApplicationJsonLd(): Record<string, unknown>` from `lib/schema.ts`.
- Consumes: `REPO`, `VERSION` from `@/lib/site-data` (already exported, confirmed in `apps/web/lib/site-data.ts:1-2`).

- [ ] **Step 1: Create the schema builders**

`apps/web/lib/schema.ts`:
```ts
import { REPO, VERSION } from './site-data';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lumyx.dev';

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Lumyx',
    url: SITE_URL,
    logo: `${SITE_URL}/icon.png`,
    sameAs: [REPO],
  };
}

export function softwareApplicationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Lumyx',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Linux, macOS, Windows',
    softwareVersion: VERSION,
    description:
      'Open-source WebRTC SFU written in Rust with observability — jitter, packet loss, RTT, NACK ratio, freeze ratio — measured inside the media path.',
    url: SITE_URL,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Self-hosted, MIT licensed, unmetered.',
    },
  };
}
```

- [ ] **Step 2: Render it on the home page**

In `apps/web/app/page.tsx`, add the import and the script as the first child of the returned tree. React does not HTML-escape text children of `<script>` (verified against this repo's React/ReactDOM version by rendering to static markup), so the `.replace(/</g, "\\u003c")` below is what makes this safe against a `</script>` breakout — see the note after the snippet for why it needs a double backslash:
In `apps/web/app/page.tsx`, add the import and the script as the first child of the returned tree (React does not HTML-escape text children of `<script>`, so this is safe against injection as long as `<` is escaped to `<` — verified against this repo's React/ReactDOM version by rendering to static markup):

```tsx
import { organizationJsonLd, softwareApplicationJsonLd } from "@/lib/schema";
```

`HomePage`'s current top-level element is `<DarkBand className="min-h-dvh">` (not a plain `<div>` — this page renders as a forced-dark scope on `main` right now, before any theme-toggle work lands). Add the script as the first child right after that opening tag:

```tsx
    <DarkBand className="min-h-dvh">
      <script type="application/ld+json">
        {JSON.stringify([organizationJsonLd(), softwareApplicationJsonLd()]).replace(/</g, "\\u003c")}
      </script>
      <header ...
```

> **Note on baseline:** if `HomePage`'s top-level wrapper is no longer `<DarkBand>` by the time this task runs, place the `<script>` as the first child of whatever that wrapper actually is — the only requirement is it is the first thing inside the returned tree. The double backslash in `"\\u003c"` is intentional: it makes the *string value* contain the literal six characters `\u003c` rather than the character `<` — a single backslash would be parsed away by JS as a real unicode escape and produce a no-op.

and inside `HomePage`, right after the opening `<div className="min-h-dvh bg-page text-body">`:

```tsx
      <script type="application/ld+json">
        {JSON.stringify([organizationJsonLd(), softwareApplicationJsonLd()]).replace(/</g, "\u003c")}
      </script>
```

- [ ] **Step 3: Verify**

```bash
rtk check-types
rtk lint
rtk verify:ds
rtk next build
```
Then `rtk next start` and `rtk curl -s http://localhost:3000/ | grep -A2 'application/ld+json'` — confirm the script tag is present and contains valid JSON (pipe the extracted content through `node -e "JSON.parse(require('fs').readFileSync(0,'utf8'))"` to confirm it parses). Also paste the output into https://validator.schema.org manually if you want a second opinion (optional, not required to pass this task).

- [ ] **Step 4: Commit**

```bash
rtk git add apps/web/lib/schema.ts apps/web/app/page.tsx
rtk git commit -m "feat(web): add Organization + SoftwareApplication JSON-LD to home page"
```

---

### Task 3: Blog infrastructure + first post

**Files:**
- Create: `apps/web/lib/blog-data.ts`
- Create: `apps/web/components/blog/posts/livekit-pivoted-to-ai-agents.tsx`
- Create: `apps/web/components/blog/registry.tsx`
- Create: `apps/web/app/blog/page.tsx`
- Create: `apps/web/app/blog/[slug]/page.tsx`
- Modify: `apps/web/components/site/chrome.tsx:10-16` (add `/blog` to the shared `NAV`)
- Modify: `apps/web/app/page.tsx:9-15` (add `/blog` to the homepage's own `NAV`)

**Interfaces:**
- Produces: `BLOG_POSTS: BlogPost[]` and `type BlogPost` from `lib/blog-data.ts` (fields: `slug`, `title`, `description`, `keyword`, `date`, `dek`) — consumed by Task 4's `sitemap.ts`.
- Produces: `BLOG_CONTENT: Record<string, React.ComponentType>` from `components/blog/registry.tsx`.
- Consumes: `SiteFrame` (`@/components/site/frame`), `SectionHead` (`@/components/site/chrome`), `AlertBanner` (`@lumyx/ui`) — all already exist, read in full above.

- [ ] **Step 1: Create the post metadata registry**

`apps/web/lib/blog-data.ts`:
```ts
export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  keyword: string;
  date: string;
  dek: string;
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "livekit-pivoted-to-ai-agents",
    title: "LiveKit pivoted to AI agents. Lumyx didn't.",
    description:
      "LiveKit raised $100M to become an AI agent platform. Here's what that means if you're building a video product, not a voice bot.",
    keyword: "livekit ai agents",
    date: "2026-09-01",
    dek: "A look at where LiveKit's funding, product and content are actually pointed in 2026 — and what that leaves open for people who just want to ship video.",
  },
];
```

- [ ] **Step 2: Write the first post's body**

`apps/web/components/blog/posts/livekit-pivoted-to-ai-agents.tsx`:
```tsx
export default function LivekitPivotedToAiAgents() {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-16 leading-relaxed text-body text-pretty">
        On January 22, 2026, LiveKit announced a $100M Series C led by Index Ventures, with Salesforce Ventures,
        Altimeter, Hanabi Capital and Redpoint Ventures participating, at a $1B valuation. That much is a funding
        headline. What matters more is how LiveKit described itself while announcing it — not as a video SFU
        company, but as{" "}
        <a href="https://livekit.com/blog/livekit-series-c">
          &ldquo;the open source framework and cloud platform for voice, video, and physical AI agents.&rdquo;
        </a>{" "}
        Bloomberg&rsquo;s own headline made the same read explicit:{" "}
        <a href="https://www.bloomberg.com/news/articles/2026-01-22/livekit-seller-of-voice-tools-to-openai-raises-100-million">
          &ldquo;LiveKit, Seller of Voice Tools to OpenAI, Raises $100 Million.&rdquo;
        </a>
      </p>

      <h2 className="text-20 font-semibold tracking-[-0.02em] text-strong">The center of gravity has moved</h2>
      <p className="text-16 leading-relaxed text-body text-pretty">
        You can see the same shift in the repos. As of today,{" "}
        <a href="https://github.com/livekit/agents">livekit/agents</a> sits at{" "}
        <span className="sl-num text-strong">13,933</span> stars against{" "}
        <a href="https://github.com/livekit/livekit">livekit/livekit</a>&rsquo;s{" "}
        <span className="sl-num text-strong">20,629</span>. The core SFU is still ahead — but that&rsquo;s a
        6.7k-star gap on a repo that&rsquo;s existed for a fraction of the time, and it&rsquo;s where nearly all of
        LiveKit&rsquo;s public content, DevRel energy and funding narrative point now.
      </p>

      <h2 className="text-20 font-semibold tracking-[-0.02em] text-strong">The pricing model tells the same story</h2>
      <p className="text-16 leading-relaxed text-body text-pretty">
        LiveKit Cloud&rsquo;s{" "}
        <a href="https://livekit.com/pricing.md">current pricing</a> is built around agent workloads, not plain
        video minutes: Build is free (5,000 WebRTC minutes + 1,000 agent minutes), Ship is $50/mo for 5,000
        agent-session minutes, Scale is $500/mo for 50,000 agent-session minutes and is the hard floor for
        HIPAA/SOC2, and Enterprise is custom. If you&rsquo;re shipping a video product with no agent in the loop,
        you&rsquo;re paying into — and building on top of — a roadmap that isn&rsquo;t optimized for you anymore.
      </p>

      <h2 className="text-20 font-semibold tracking-[-0.02em] text-strong">Self-hosting still has sharp edges</h2>
      <p className="text-16 leading-relaxed text-body text-pretty">
        None of this is a knock on LiveKit&rsquo;s engineering. A{" "}
        <a href="https://prodinit.com/blog/self-hosted-livekit-production-guide">production self-hosting guide</a>{" "}
        from July 2026 documents the same defaults every self-hosted SFU has to reckon with: Redis is required
        for multi-instance room state (its absence causes silent split-brain, not a loud error), the UDP
        50000&ndash;60000 range has to be opened and is the single most common cause of ICE failures, symmetric
        NAT needs TURN, and naive CPU-only autoscaling is flagged as the most common operational failure mode.
        Worth noting: that guide&rsquo;s framing of &ldquo;three distinct services&rdquo; (server, agent workers,
        egress) describes an agent-and-recording deployment specifically — a plain video-only LiveKit self-host
        is still one service. Don&rsquo;t let that detail get flattened into a bigger claim than it is.
      </p>

      <h2 className="text-20 font-semibold tracking-[-0.02em] text-strong">Where that leaves video-only teams</h2>
      <p className="text-16 leading-relaxed text-body text-pretty">
        If your product is video first — classrooms, telehealth, live commerce, multiplayer — and you don&rsquo;t
        need an agent runtime, you&rsquo;re now a secondary audience for the SFU you might already depend on.
        That&rsquo;s the gap Lumyx is building into: a Rust SFU that stays a video SFU, with the same jitter,
        packet loss, RTT, NACK ratio and freeze ratio metrics you&rsquo;d otherwise bolt on with Prometheus or a
        third-party SDK, measured natively in the media path instead.
      </p>

      <p className="text-13 leading-relaxed text-faint text-pretty">
        Sources: LiveKit,{" "}
        <a href="https://livekit.com/blog/livekit-series-c">
          &ldquo;LiveKit&rsquo;s Series C: Towards the voice-driven era of computing&rdquo;
        </a>{" "}
        (Jan 22, 2026); Bloomberg,{" "}
        <a href="https://www.bloomberg.com/news/articles/2026-01-22/livekit-seller-of-voice-tools-to-openai-raises-100-million">
          &ldquo;LiveKit, Seller of Voice Tools to OpenAI, Raises $100 Million&rdquo;
        </a>{" "}
        (Jan 22, 2026); GitHub API,{" "}
        <a href="https://github.com/livekit/livekit">livekit/livekit</a> and{" "}
        <a href="https://github.com/livekit/agents">livekit/agents</a> star counts (queried Sep 1, 2026);{" "}
        <a href="https://livekit.com/pricing.md">LiveKit Cloud pricing</a> (Sep 1, 2026); Prodinit,{" "}
        <a href="https://prodinit.com/blog/self-hosted-livekit-production-guide">
          &ldquo;Self-Host LiveKit on ECS: Production Guide&rdquo;
        </a>{" "}
        (Jul 6, 2026).
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Registry mapping slug to content component**

`apps/web/components/blog/registry.tsx`:
```tsx
import type { ComponentType } from "react";
import LivekitPivotedToAiAgents from "./posts/livekit-pivoted-to-ai-agents";

export const BLOG_CONTENT: Record<string, ComponentType> = {
  "livekit-pivoted-to-ai-agents": LivekitPivotedToAiAgents,
};
```

- [ ] **Step 4: Blog index page**

`apps/web/app/blog/page.tsx`:
```tsx
import Link from "next/link";
import type { Metadata } from "next";
import { SiteFrame } from "@/components/site/frame";
import { SectionHead } from "@/components/site/chrome";
import { BLOG_POSTS } from "@/lib/blog-data";

export const metadata: Metadata = {
  title: "Blog — Lumyx",
  description: "Build notes on an open-source Rust WebRTC SFU, and analysis of the market around it.",
};

export default function BlogIndexPage() {
  const posts = [...BLOG_POSTS].sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <SiteFrame>
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-start gap-10 px-10 py-20 lg:grid-cols-[180px_1fr]">
        <SectionHead index="01" label="Blog" blurb="Build notes, market analysis, and the bugs we closed." />
        <div className="flex flex-col">
          {posts.map((p, i) => (
            <Link
              key={p.slug}
              href={`/blog/${p.slug}`}
              className={`flex flex-col gap-2 border-t border-subtle py-6 no-underline hover:no-underline ${
                i === posts.length - 1 ? "border-b" : ""
              }`}
            >
              <span className="sl-num text-12 text-faint">{p.date}</span>
              <span className="text-[19px] font-semibold tracking-[-0.02em] text-strong">{p.title}</span>
              <span className="text-13 leading-relaxed text-muted text-pretty">{p.description}</span>
            </Link>
          ))}
        </div>
      </div>
    </SiteFrame>
  );
}
```

- [ ] **Step 5: Blog detail page**

`apps/web/app/blog/[slug]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AlertBanner } from '@lumyx/ui';
import { SiteFrame } from "@/components/site/frame";
import { SectionHead } from "@/components/site/chrome";
import { BLOG_POSTS } from "@/lib/blog-data";
import { BLOG_CONTENT } from "@/components/blog/registry";

export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  if (!post) return {};
  return { title: `${post.title} — Lumyx blog`, description: post.description };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  const Content = BLOG_CONTENT[slug];
  if (!post || !Content) notFound();

  return (
    <SiteFrame>
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-start gap-10 px-10 py-20 lg:grid-cols-[180px_1fr]">
        <SectionHead index="Blog" label={post.date} />
        <article className="flex max-w-[680px] flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h1 className="text-44 font-semibold tracking-[-0.02em] text-strong text-pretty">{post.title}</h1>
            <p className="text-16 leading-relaxed text-muted text-pretty">{post.dek}</p>
          </div>
          <AlertBanner
            severity="info"
            title="Lumyx is in active development"
            body="Core video forwarding stability and third-party production usage aren't validated yet. Track progress on the changelog."
          />
          <Content />
        </article>
      </div>
    </SiteFrame>
  );
}
```

- [ ] **Step 6: Add `/blog` to both nav lists**

In `apps/web/components/site/chrome.tsx`, change the shared `NAV` (used on every non-home page via `SiteHeader`):
```ts
const NAV = [
  { href: "/#why", label: "Why Lumyx" },
  { href: "/#observability", label: "Observability" },
  { href: "/compare", label: "vs LiveKit" },
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" },
  { href: "/blog", label: "Blog" },
];
```

In `apps/web/app/page.tsx`, change the homepage's own `NAV`:
```ts
const NAV = [
  { href: "/", label: "Product" },
  { href: "/#platform", label: "Observability" },
  { href: "/docs", label: "Docs" },
  { href: "/blog", label: "Blog" },
  { href: "/pricing", label: "Pricing" },
  { href: "/changelog", label: "Changelog" },
];
```

- [ ] **Step 7: Verify**

```bash
rtk check-types
rtk lint
rtk verify:ds
rtk next build
```
Expected: `/blog` and `/blog/livekit-pivoted-to-ai-agents` both appear as prerendered routes in the build output. Then `rtk next start` and:
```bash
rtk curl -s http://localhost:3000/blog | grep -o 'LiveKit pivoted to AI agents'
rtk curl -sI http://localhost:3000/blog/livekit-pivoted-to-ai-agents
```
Expected: the title text is found on the index page, and the detail page returns `200`. Load both pages in a browser and confirm the "in active development" banner renders above the article body, and every link in the sources section resolves (not 404).

- [ ] **Step 8: Commit**

```bash
rtk git add apps/web/lib/blog-data.ts apps/web/components/blog apps/web/app/blog apps/web/components/site/chrome.tsx apps/web/app/page.tsx
rtk git commit -m "feat(web): add blog with first post (livekit-pivoted-to-ai-agents)"
```

---

### Task 4: Sitemap + robots.txt

**Files:**
- Create: `apps/web/app/sitemap.ts`
- Create: `apps/web/app/robots.ts`

**Interfaces:**
- Consumes: `BLOG_POSTS` from `@/lib/blog-data` (Task 3, `date`/`slug` fields).

- [ ] **Step 1: Sitemap**

`apps/web/app/sitemap.ts`:
```ts
import type { MetadataRoute } from "next";
import { BLOG_POSTS } from "@/lib/blog-data";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lumyx.dev";

const STATIC_ROUTES: Array<{
  path: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
  priority: number;
}> = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/pricing", changeFrequency: "monthly", priority: 0.8 },
  { path: "/docs", changeFrequency: "weekly", priority: 0.8 },
  { path: "/compare", changeFrequency: "monthly", priority: 0.6 },
  { path: "/changelog", changeFrequency: "weekly", priority: 0.5 },
  { path: "/blog", changeFrequency: "weekly", priority: 0.7 },
  { path: "/signup", changeFrequency: "yearly", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: new Date(),
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  const blogEntries: MetadataRoute.Sitemap = BLOG_POSTS.map((p) => ({
    url: `${SITE_URL}/blog/${p.slug}`,
    lastModified: new Date(p.date),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticEntries, ...blogEntries];
}
```

- [ ] **Step 2: Robots**

`apps/web/app/robots.ts`:
```ts
import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lumyx.dev";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
```

- [ ] **Step 3: Verify**

```bash
rtk check-types
rtk next build
```
Then `rtk next start` and:
```bash
rtk curl -s http://localhost:3000/sitemap.xml
rtk curl -s http://localhost:3000/robots.txt
```
Expected: `sitemap.xml` is valid XML listing every static route plus `/blog/livekit-pivoted-to-ai-agents`; `robots.txt` shows `User-Agent: *`, `Allow: /`, and a `Sitemap:` line pointing at `https://lumyx.dev/sitemap.xml` (or the `NEXT_PUBLIC_SITE_URL` value if set).

- [ ] **Step 4: Commit**

```bash
rtk git add apps/web/app/sitemap.ts apps/web/app/robots.ts
rtk git commit -m "feat(web): add sitemap.xml and robots.txt"
```

---

## Out of scope for this plan (manual, non-code follow-ups from spec section 5)

- Creating Google Search Console + Bing Webmaster Tools properties for `lumyx.dev` and verifying ownership — requires the user's own Google/Microsoft account. Once a verification code exists, add it via Next's `metadata.verification` field in `app/layout.tsx` (one-line follow-up, not worth a task until the code exists).
- Creating the Plausible account/site (see Task 1's manual follow-up note).
- Netlinking: awesome-webrtc/awesome-rust submissions, crates.io publication, dev.to/Hashnode cross-post, AlternativeTo.net profile, community answers on community.livekit.io/Stack Overflow — all manual, external actions.
