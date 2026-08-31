# Site marketing Sightline (`apps/web`) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire `apps/web`, une application Next.js qui reproduit fidèlement les six maquettes marketing du handoff (Home, Pricing, Compare LiveKit, Docs, Changelog, Sign up) en consommant `@sightline/ui`.

**Architecture:** Les sections de page restent des Server Components et ne portent que des attributs `data-anim` ; un unique composant client monté dans le layout fait l'`IntersectionObserver`, le découpage mot-par-mot et la barre de progression. Le layout et les breakpoints s'écrivent en utilitaires Tailwind, la typographie display et les animations en CSS Modules, et toute couleur passe par un token `var(--*)`. Le contenu éditorial vit dans `content/*.ts` typé, jamais dans le JSX.

**Tech Stack:** TypeScript 5, React 19.2.8, Next 16.3.2 (App Router), Tailwind CSS v4, `@sightline/ui` (workspace), `bun test`, bun 1.3.11, Turborepo 2.

**Spec:** `docs/superpowers/specs/2026-08-30-sightline-marketing-site-design.md`

**Source du port :** `~/Downloads/design_handoff_sightline/`
Dans ce plan ce chemin est noté `$HANDOFF`. Les maquettes sont dans `$HANDOFF/designs/*.dc.html`.

```bash
# À exporter dans chaque session de travail sur ce plan :
export HANDOFF=~/Downloads/design_handoff_sightline
```

**Comment lire une maquette.** Un `.dc.html` = un template HTML entre `<x-dc>` et `</x-dc>`, tout en styles inline avec les valeurs exactes, plus une classe de logique `class Component extends DCLogic` dans le `<script data-dc-script>` en bas de fichier. `{{ foo }}` vient de `renderVals()`, `<sc-for list="{{ items }}" as="it">` est un `.map()`, `<sc-if value="{{ cond }}">` est un `&&`, et `<x-import component-from-global-scope="SightlineDesignSystem_ae3b12.Button" variant="primary">` est `<Button variant="primary">`. Ouvrir le fichier dans un navigateur fonctionne en local (tout est relatif) et montre le rendu et les interactions réelles.

## Global Constraints

Ces règles s'appliquent à **toutes** les tâches.

- **Aucune couleur en dur.** Pas de `#rrggbb`, pas de `rgb(`, pas de `rgba(` dans `apps/web/app/**` ni `apps/web/components/**`. Tout passe par `var(--*)`. Seule exception déclarée : `apps/web/app/globals.css`, exempté par le vérificateur de la Task 2, où vivent les rares valeurs marketing-locales.
- **Frontière Tailwind / CSS Modules.** Layout, flux, espacement et breakpoints en utilitaires Tailwind (`flex`, `grid`, `gap-6`, `px-10`, `max-w-*`, `md:`, `lg:`). Typographie display, grilles à ratios exacts, dégradés, ombres composées et keyframes en `Nom.module.css`. Critère : une valeur qui existe dans l'échelle du système passe en utilitaire, une valeur hors échelle passe en CSS.
- **`'use client'` uniquement sur les îlots interactifs déclarés** : `MarketingMotion`, `ScrollProgress`, `Spotlight`, `SnippetTabs` (Home), `CostEstimator` (Pricing), `DocsRail` (Docs), `SignupWizard` (Sign up). Tout autre `'use client'` doit être justifié en commentaire dans le code.
- **Ordre d'import de `globals.css` :** `@sightline/ui/styles.css` **avant** `tailwindcss`. C'est l'ordre de `apps/dashboard` et celui que le pont `@theme` du design system suppose.
- **Casing sentence case** pour tout ce qu'un humain lit. Les identifiants machine ne sont jamais embellis : `a3f91c02`, `test-room`, `eu-west-3`, `vp8` s'affichent tels quels.
- **Tous les nombres portent leur unité** (`38ms`, `0.20%`, `1.29 GB`, `€49/mo`), les petits pourcentages gardent 2 décimales, les comptes sont groupés (`1,284,920`), et **tout nombre live porte la classe `.sl-num`**.
- **Zéro emoji** dans les pages. **Zéro monospace** — Geist uniquement, les chiffres utilisent les tabular figures via `.sl-num`.
- **`text-wrap: pretty`** sur tous les titres et paragraphes.
- **Pas de gradient** sur les surfaces, boutons ou textes. Exceptions autorisées, toutes décoratives et déjà présentes dans les maquettes : la trame de points du hero, le spotlight, le fade sous une courbe de graphe.
- **`prefers-reduced-motion: reduce` est testé à un seul endroit**, dans `MarketingMotion` (Task 4). Aucun autre composant ne le teste.
- **Le `body` ne défile jamais horizontalement.** Un contenu large défile dans son propre conteneur `overflow-x-auto`.
- **En cas d'écart entre le README du handoff et un `.dc.html`, le `.dc.html` fait foi.** Trois écarts sont déjà connus et documentés dans le spec : l'estimateur n'a qu'un curseur, Sign up fait deux étapes plus un écran final, et le rail de Docs est à droite.

---

### Task 1: Scaffold de `apps/web`

**Files:**
- Create: `apps/web/` (via CLI), puis modifier `apps/web/package.json`, `apps/web/next.config.ts`, `apps/web/app/globals.css`, `apps/web/app/layout.tsx`, `apps/web/app/page.tsx`

**Interfaces:**
- Consumes: `@sightline/ui` (workspace), `@sightline/ui/styles.css`
- Produces: une app Next lançable sur le port 3002, les keyframes `sl-*` disponibles globalement, et le token `--spotlight-tint`

- [ ] **Step 1: Créer l'app avec le CLI de bun**

Depuis la racine du monorepo :

```bash
bun create next-app apps/web --ts --app --tailwind --no-src-dir --eslint \
  --use-bun --import-alias "@/*"
```

Si le CLI pose malgré tout une question interactive (Turbopack par exemple), répondre par le défaut proposé : tout ce qui compte est réécrit aux steps suivants. Supprimer ensuite les assets de démo :

```bash
rm -f apps/web/public/*.svg
```

- [ ] **Step 2: Aligner `apps/web/package.json` sur le monorepo**

Remplacer intégralement le fichier par :

```json
{
  "name": "@sightline/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3002",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "check-types": "tsc --noEmit",
    "test": "bun test",
    "verify:ds": "node scripts/verify-ds.mjs"
  },
  "dependencies": {
    "@sightline/ui": "workspace:*",
    "next": "16.3.2",
    "react": "19.2.8",
    "react-dom": "19.2.8"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.3.2",
    "tailwindcss": "^4",
    "typescript": "^5"
  },
  "packageManager": "bun@1.2.21",
  "ignoreScripts": ["sharp", "unrs-resolver"],
  "trustedDependencies": ["sharp", "unrs-resolver"]
}
```

Le script `verify:ds` référence un fichier qui n'existe pas encore — il est créé en Task 2. C'est voulu : `package.json` n'est pas réécrit deux fois.

Puis installer depuis la racine : `bun install`

- [ ] **Step 3: `apps/web/next.config.ts`**

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@sightline/ui'],
};

export default nextConfig;
```

- [ ] **Step 4: `apps/web/app/globals.css`**

Remplacer intégralement le fichier généré par :

```css
@import '@sightline/ui/styles.css';
@import 'tailwindcss';

/* Valeurs marketing-locales. Ce fichier est le seul de apps/web autorisé à porter une
   valeur de couleur littérale — cf. scripts/verify-ds.mjs. En pratique il n'y en a
   aucune : le spotlight se dérive de --accent par color-mix. */
:root {
  --spotlight-tint: color-mix(in srgb, var(--accent) 22%, transparent);
}

/* Vocabulaire d'entrée du marketing. Copié depuis le handoff — ne pas retoucher les
   courbes ni les durées. */
@keyframes sl-rise {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: none; }
}
@keyframes sl-fade {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes sl-slide {
  from { opacity: 0; transform: translateX(-14px); }
  to   { opacity: 1; transform: none; }
}
@keyframes sl-word {
  from { opacity: 0; transform: translateY(14px) scale(.985); filter: blur(4px); }
  to   { opacity: 1; transform: none; filter: blur(0); }
}
@keyframes sl-marquee {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
@keyframes sl-beam {
  from { stroke-dashoffset: 340; }
  to   { stroke-dashoffset: 0; }
}
@keyframes sl-dash {
  to { stroke-dashoffset: -36; }
}
```

`--spotlight-tint` remplace le `rgba(79,57,246,.22)` écrit en dur dans la maquette : `color-mix(in srgb, var(--accent) 22%, transparent)` produit exactement la même couleur tout en restant dérivé du token, ce qui la fait suivre `.theme-dark` gratuitement.

- [ ] **Step 5: `apps/web/app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });

export const metadata: Metadata = {
  title: 'Sightline — observability in the media path',
  description:
    'A Rust WebRTC SFU with jitter, packet loss, RTT and NACK ratio per peer and per room, live.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
```

- [ ] **Step 6: Page temporaire de fumée**

Remplacer `apps/web/app/page.tsx` par :

```tsx
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 style={{ fontSize: 'var(--fs-26)' }}>Sightline</h1>
      <p style={{ color: 'var(--text-muted)' }}>scaffold ok</p>
    </main>
  );
}
```

- [ ] **Step 7: Vérifier que l'app démarre et compile**

```bash
cd apps/web && bun run build && bun run check-types
```

Attendu : build vert, aucune erreur de types. Puis `bun run dev` et vérifier dans un navigateur sur `http://localhost:3002` que le fond est `--surface-page` (un gris très légèrement froid, pas du blanc pur) et que le texte est en Geist — c'est la preuve que `@sightline/ui/styles.css` est bien chargé avant Tailwind.

- [ ] **Step 8: Commit**

```bash
git add apps/web bun.lock
git commit -m "feat(web): scaffold de l'app marketing sur le port 3002"
```

---

### Task 2: Vérificateur de contraintes pour `apps/web`

`packages/ui/scripts/verify-ds.mjs` est scopé à `packages/ui/src` et vérifie en plus des règles qui n'ont de sens que pour le design system (tokens verbatim, `'use client'` sur `EventList` seul). On ne l'étend pas à travers la frontière du package : `apps/web` reçoit son propre vérificateur, plus court, que `turbo run verify:ds` ramasse automatiquement puisque le script porte le même nom.

**Files:**
- Create: `apps/web/scripts/verify-ds.mjs`

**Interfaces:**
- Consumes: rien
- Produces: `bun run verify:ds` dans `apps/web`, qui sort en code 1 sur violation

- [ ] **Step 1: Écrire le vérificateur**

```js
#!/usr/bin/env node
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SCANNED = ['app', 'components', 'content'].map((d) => join(ROOT, d));

// Seul fichier autorisé à porter une valeur de couleur littérale : c'est là que vivent
// les rares valeurs marketing-locales, comme tokens/ l'est pour packages/ui.
const COLOR_EXEMPT = join(ROOT, 'app', 'globals.css');

// Îlots interactifs déclarés par le plan. Tout autre 'use client' est une violation.
const CLIENT_ALLOWED = new Set([
  'MarketingMotion.tsx',
  'ScrollProgress.tsx',
  'Spotlight.tsx',
  'SnippetTabs.tsx',
  'CostEstimator.tsx',
  'PlanSwitcher.tsx',
  'DocsRail.tsx',
  'SignupWizard.tsx',
]);

const failures = [];
const fail = (rule, detail) => failures.push(`[${rule}] ${detail}`);

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = SCANNED.flatMap(walk);
const rel = (p) => p.slice(ROOT.length);

// Même stratégie inversée que packages/ui : tout #hex ou rgb()/rgba() est présumé être une
// couleur en dur, sauf les références d'ancre et de fragment SVG, qui ne sont pas des couleurs.
const SAFE_HEX_REF =
  /(?:\bxlink:href|\bhref)\s*=\s*(?:"#[^"]*"|'#[^']*'|\{\s*['"]#[^'"}]*['"]\s*\})|\burl\(\s*#[^)]*\)/g;
const HEX = /#[0-9a-fA-F]{3,8}\b/;
const RGB = /\brgba?\(/;

// 1. Aucune couleur en dur hors globals.css
for (const f of files) {
  if (f === COLOR_EXEMPT) continue;
  readFileSync(f, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      const scrubbed = line.replace(SAFE_HEX_REF, '');
      if (HEX.test(scrubbed) || RGB.test(scrubbed)) {
        fail('no-hardcoded-color', `${rel(f)}:${i + 1} — ${line.trim()}`);
      }
    });
}

// 2. 'use client' sur les seuls îlots déclarés
for (const f of files.filter((f) => extname(f) === '.tsx')) {
  const isClient = /^\s*['"]use client['"]/m.test(readFileSync(f, 'utf8'));
  if (isClient && !CLIENT_ALLOWED.has(basename(f))) {
    fail('use-client', `${rel(f)} porte 'use client' — ilot non declare dans le plan`);
  }
}

// 3. Zéro monospace
for (const f of files) {
  if (/monospace|ui-monospace|'SF Mono'|Menlo|Consolas/i.test(readFileSync(f, 'utf8'))) {
    fail('no-monospace', `${rel(f)} contient une font monospace`);
  }
}

// 4. Pas de dangerouslySetInnerHTML
for (const f of files) {
  if (readFileSync(f, 'utf8').includes('dangerouslySetInnerHTML')) {
    fail('no-dangerous-html', rel(f));
  }
}

if (failures.length) {
  console.error(`\n✗ ${failures.length} violation(s) des contraintes du design system\n`);
  failures.forEach((f) => console.error('  ' + f));
  process.exit(1);
}
console.log('✓ contraintes du design system respectees (apps/web)');
```

- [ ] **Step 2: Vérifier que le vérificateur passe sur l'état actuel**

```bash
cd apps/web && bun run verify:ds
```

Attendu : `✓ contraintes du design system respectees (apps/web)`

- [ ] **Step 3: Vérifier qu'il attrape réellement une violation**

Un vérificateur qu'on n'a jamais vu échouer ne vérifie rien. Introduire temporairement une couleur en dur dans `apps/web/app/page.tsx` :

```tsx
<p style={{ color: '#ff0000' }}>rouge</p>
```

Puis relancer `bun run verify:ds`.
Attendu : sortie en code 1, avec la ligne `[no-hardcoded-color] /app/page.tsx:N — <p style={{ color: '#ff0000' }}>rouge</p>`.

Retirer ensuite la ligne et relancer : le vérificateur doit repasser au vert.

- [ ] **Step 4: Commit**

```bash
git add apps/web/scripts/verify-ds.mjs apps/web/package.json
git commit -m "chore(web): verificateur de contraintes du design system"
```

---

### Task 3: Navigation, en-tête et pied de page

**Files:**
- Create: `apps/web/content/nav.ts`
- Create: `apps/web/components/chrome/Wordmark.tsx`
- Create: `apps/web/components/chrome/SiteHeader.tsx`, `SiteHeader.module.css`
- Create: `apps/web/components/chrome/SiteFooter.tsx`
- Modify: `apps/web/app/page.tsx`

**Interfaces:**
- Consumes: `Button`, `IconButton`, `Icon` de `@sightline/ui`
- Produces:
  - `content/nav.ts` : `export const HEADER_NAV: NavLink[]`, `export const FOOTER_COLUMNS: FooterColumn[]`, `export const SITE_VERSION: string`, avec `interface NavLink { label: string; href: string }` et `interface FooterColumn { title: string; links: NavLink[] }`
  - `<Wordmark />` — accepte `{ size?: number }`, défaut 20
  - `<SiteHeader theme?: 'light' | 'dark' />` — `dark` ajoute la classe `theme-dark`
  - `<SiteFooter />`

- [ ] **Step 1: Écrire `content/nav.ts`**

Les colonnes de pied de page se lisent dans la constante `FOOTER` de la classe de logique de `$HANDOFF/designs/Pricing.dc.html` (quatre colonnes : Product, Developers, Open source, Company). Les `href` qui pointent vers un `.dc.html` deviennent les routes réelles de l'app ; ceux qui valent `'#'` restent `'#'`.

```ts
export interface NavLink {
  label: string;
  href: string;
}

export interface FooterColumn {
  title: string;
  links: NavLink[];
}

export const SITE_VERSION = 'v0.4.1';

export const GITHUB_URL = 'https://github.com/FrekiManagarm/sightline';

export const HEADER_NAV: NavLink[] = [
  { label: 'Observability', href: '/#observability' },
  { label: 'Why Sightline', href: '/#why' },
  { label: 'vs LiveKit', href: '/compare/livekit' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Docs', href: '/docs' },
];

export const FOOTER_COLUMNS: FooterColumn[] = [
  {
    title: 'Product',
    links: [
      { label: 'Observability', href: '/#observability' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'vs LiveKit', href: '/compare/livekit' },
      { label: 'Cloud console', href: '#' },
    ],
  },
  {
    title: 'Developers',
    links: [
      { label: 'Docs', href: '/docs' },
      { label: 'Metrics reference', href: '/docs#thresholds' },
      { label: 'Changelog', href: '/changelog' },
      { label: 'Status', href: '#' },
    ],
  },
  {
    title: 'Open source',
    links: [
      { label: 'GitHub', href: GITHUB_URL },
      { label: 'Roadmap', href: '#' },
      { label: 'Contributing', href: '#' },
      { label: 'License', href: '#' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Blog', href: '#' },
      { label: 'Contact', href: '#' },
      { label: 'Sign in', href: '/signup' },
    ],
  },
];
```

- [ ] **Step 2: Écrire `Wordmark.tsx`**

Le handoff confirme qu'il n'existe aucun logo : la marque est un carré `--accent` en radius 6px suivi du mot « Sightline » en 15px/600/`-0.02em`.

```tsx
export function Wordmark({ size = 20 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        aria-hidden
        style={{
          width: size,
          height: size,
          borderRadius: 6,
          background: 'var(--accent)',
          flex: 'none',
        }}
      />
      <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-strong)' }}>
        Sightline
      </span>
    </span>
  );
}
```

- [ ] **Step 3: Écrire `SiteHeader.tsx` et son module CSS**

L'en-tête fait 64px avec `border-bottom: 1px solid var(--border-subtle)`. À gauche le wordmark, au centre les cinq liens de nav en 12.5px `--text-muted`, à droite la version en `.sl-num` 12px, un bouton GitHub ghost de 32px en radius 12px, et un `Button` primary sm vers `/signup`. Sous 768px les liens de nav sont masqués — le CTA et le wordmark restent.

`SiteHeader.module.css` :

```css
.link {
  font-size: 12.5px;
  color: var(--text-muted);
  text-decoration: none;
  transition: color var(--dur-1) var(--ease-out);
}
.link:hover {
  color: var(--text-strong);
  text-decoration: none;
}
```

`SiteHeader.tsx` :

```tsx
import Link from 'next/link';
import { Button } from '@sightline/ui';
import { HEADER_NAV, SITE_VERSION, GITHUB_URL } from '@/content/nav';
import { Wordmark } from './Wordmark';
import s from './SiteHeader.module.css';

export function SiteHeader({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  return (
    <header
      className={theme === 'dark' ? 'theme-dark' : undefined}
      style={{ borderBottom: '1px solid var(--border-subtle)' }}
    >
      <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-8 px-5 md:px-6 lg:px-10">
        <Link href="/" aria-label="Sightline — home">
          <Wordmark />
        </Link>
        <nav className="hidden flex-1 items-center gap-6 md:flex">
          {HEADER_NAV.map((l) => (
            <Link key={l.href} href={l.href} className={s.link}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 md:ml-0">
          <span className="sl-num hidden md:inline" style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            {SITE_VERSION}
          </span>
          <a
            href={GITHUB_URL}
            className={s.link}
            style={{ fontSize: 12.5 }}
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          <Link href="/signup">
            <Button variant="primary" size="sm">
              Get started free
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Écrire `SiteFooter.tsx`**

Quatre colonnes, en-têtes en `.sl-label`, liens en 12.5px `--text-muted`, séparateur haut en `--border-subtle`. Une colonne sous 768px, deux à partir de `md:`, quatre à partir de `lg:`.

```tsx
import Link from 'next/link';
import { FOOTER_COLUMNS, SITE_VERSION } from '@/content/nav';
import { Wordmark } from './Wordmark';

export function SiteFooter() {
  return (
    <footer style={{ borderTop: '1px solid var(--border-subtle)' }}>
      <div className="mx-auto max-w-[1280px] px-5 py-14 md:px-6 lg:px-10">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4">
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title} className="flex flex-col gap-3">
              <span className="sl-label">{col.title}</span>
              {col.links.map((l) => (
                <Link
                  key={l.label}
                  href={l.href}
                  style={{ fontSize: 12.5, color: 'var(--text-muted)', textDecoration: 'none' }}
                >
                  {l.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div
          className="mt-12 flex flex-wrap items-center justify-between gap-4 pt-6"
          style={{ borderTop: '1px solid var(--border-subtle)' }}
        >
          <Wordmark size={16} />
          <span className="sl-num" style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            {SITE_VERSION} · MIT
          </span>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 5: Monter l'en-tête et le pied de page sur la page d'accueil temporaire**

```tsx
import { SiteHeader } from '@/components/chrome/SiteHeader';
import { SiteFooter } from '@/components/chrome/SiteFooter';

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1280px] px-5 py-24 md:px-6 lg:px-10">
        <h1 style={{ fontSize: 'var(--fs-26)' }}>Sightline</h1>
      </main>
      <SiteFooter />
    </>
  );
}
```

- [ ] **Step 6: Vérifier**

```bash
cd apps/web && bun run verify:ds && bun run check-types && bun run build
```

Attendu : les trois au vert. Puis `bun run dev` et comparer l'en-tête à celui de `$HANDOFF/designs/Home.dc.html` ouvert dans un autre onglet : hauteur 64px, filet bas discret, cinq liens en gris moyen. Réduire la fenêtre sous 768px et vérifier que les liens disparaissent sans que rien ne déborde horizontalement.

- [ ] **Step 7: Commit**

```bash
git add apps/web/content apps/web/components apps/web/app/page.tsx
git commit -m "feat(web): en-tete, pied de page et navigation"
```

---

### Task 4: Runtime d'animation marketing

C'est le cœur technique du port. Les sections ne portent que des attributs ; ce composant fait tout le travail, et il est le seul endroit du site où `prefers-reduced-motion` est testé.

**Files:**
- Create: `apps/web/components/motion/MarketingMotion.tsx`
- Create: `apps/web/components/motion/ScrollProgress.tsx`
- Create: `apps/web/components/motion/Spotlight.tsx`
- Modify: `apps/web/app/layout.tsx`

**Interfaces:**
- Consumes: les keyframes `sl-*` de `globals.css` et le token `--spotlight-tint` (Task 1)
- Produces:
  - `<MarketingMotion />` — sans props, à monter une fois dans le layout
  - `<ScrollProgress />` — sans props, barre fixée en haut
  - `<Spotlight />` — sans props, à placer en enfant absolu d'un conteneur portant `data-hero`
  - le contrat d'attributs : `data-anim`, `data-anim-delay`, `data-anim-now`, `data-words`, `data-words-delay`, `data-hero`, `data-spotlight`

- [ ] **Step 1: Écrire `MarketingMotion.tsx`**

Port de `componentDidMount()` des maquettes, avec deux ajouts explicites : le découpage mot-par-mot et le `rootMargin` que le README du handoff documente.

```tsx
'use client';

import { useEffect } from 'react';

const DURATION = 560;
const EASE = 'cubic-bezier(0.16,0.84,0.32,1)';
const FAILSAFE_MS = 6000;

export function MarketingMotion() {
  useEffect(() => {
    // Le seul test de prefers-reduced-motion du site. On sort avant d'avoir masqué
    // quoi que ce soit : tout reste visible et lisible, rien ne joue.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const play = (el: HTMLElement) => {
      if (el.dataset.animPlayed) return;
      el.dataset.animPlayed = '1';
      const kind = el.getAttribute('data-anim') || 'rise';
      const delay = Number(el.getAttribute('data-anim-delay') || 0);
      el.style.animation = `sl-${kind} ${DURATION}ms ${EASE} ${delay}ms both`;
    };

    // Titres révélés mot par mot : on découpe avant que l'observer ne voie les éléments.
    document.querySelectorAll<HTMLElement>('[data-words]').forEach((el) => {
      if (el.dataset.wordsSplit) return;
      el.dataset.wordsSplit = '1';
      const base = Number(el.getAttribute('data-words-delay') || 0);
      const words = (el.textContent || '').split(/\s+/).filter(Boolean);
      el.textContent = '';
      words.forEach((word, i) => {
        const span = document.createElement('span');
        span.textContent = word;
        span.style.display = 'inline-block';
        span.style.animation = `sl-word ${DURATION}ms ${EASE} ${base + i * 45}ms both`;
        el.appendChild(span);
        if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
      });
    });

    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-anim]'));
    const deferred: HTMLElement[] = [];
    els.forEach((el) => {
      if (el.hasAttribute('data-anim-now')) play(el);
      else {
        el.style.opacity = '0';
        deferred.push(el);
      }
    });

    let io: IntersectionObserver | undefined;
    if (deferred.length && 'IntersectionObserver' in window) {
      io = new IntersectionObserver(
        (entries) =>
          entries.forEach((e) => {
            if (e.isIntersecting) {
              play(e.target as HTMLElement);
              io?.unobserve(e.target);
            }
          }),
        { threshold: 0.1, rootMargin: '0px 0px -6% 0px' },
      );
      deferred.forEach((el) => io?.observe(el));
    } else {
      deferred.forEach(play);
    }

    // Filet de sécurité : un observer qui ne se déclenche jamais ne doit pas pouvoir
    // laisser du contenu invisible.
    const failsafe = window.setTimeout(() => deferred.forEach(play), FAILSAFE_MS);

    return () => {
      window.clearTimeout(failsafe);
      io?.disconnect();
    };
  }, []);

  return null;
}
```

- [ ] **Step 2: Écrire `ScrollProgress.tsx`**

Barre de 2px en `--accent`, fixée en haut, largeur = ratio de scroll.

```tsx
'use client';

import { useEffect, useState } from 'react';

export function ScrollProgress() {
  const [ratio, setRatio] = useState(0);

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setRatio(max > 0 ? window.scrollY / max : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <div
      aria-hidden
      data-progress
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: 2,
        width: `${ratio * 100}%`,
        background: 'var(--accent)',
        zIndex: 50,
        transition: 'width 80ms linear',
      }}
    />
  );
}
```

- [ ] **Step 3: Écrire `Spotlight.tsx`**

Suit le pointeur dans le conteneur ancêtre portant `data-hero`. La couleur vient du token `--spotlight-tint` défini en Task 1 — aucune valeur littérale ici.

```tsx
'use client';

import { useEffect, useRef } from 'react';

export function Spotlight() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    const hero = el?.closest<HTMLElement>('[data-hero]');
    if (!el || !hero) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const onMove = (e: PointerEvent) => {
      const r = hero.getBoundingClientRect();
      el.style.background = `radial-gradient(460px circle at ${e.clientX - r.left}px ${
        e.clientY - r.top
      }px, var(--spotlight-tint), transparent 68%)`;
      el.style.opacity = '1';
    };
    const onLeave = () => {
      el.style.opacity = '0';
    };

    hero.addEventListener('pointermove', onMove);
    hero.addEventListener('pointerleave', onLeave);
    return () => {
      hero.removeEventListener('pointermove', onMove);
      hero.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      data-spotlight
      style={{
        position: 'absolute',
        inset: 0,
        opacity: 0,
        pointerEvents: 'none',
        transition: 'opacity 300ms var(--ease-out)',
      }}
    />
  );
}
```

- [ ] **Step 4: Monter le runtime dans le layout**

Dans `apps/web/app/layout.tsx`, ajouter les imports et les deux composants dans le `<body>`, après `{children}` :

```tsx
import { MarketingMotion } from '@/components/motion/MarketingMotion';
import { ScrollProgress } from '@/components/motion/ScrollProgress';
```

```tsx
      <body className="min-h-full">
        <ScrollProgress />
        {children}
        <MarketingMotion />
      </body>
```

- [ ] **Step 5: Vérifier le runtime sur un cas réel**

Ajouter temporairement à `apps/web/app/page.tsx`, dans le `<main>` :

```tsx
        <div style={{ height: '120vh' }} />
        <p data-anim="rise" data-anim-delay="200" style={{ fontSize: 'var(--fs-20)' }}>
          révélé au scroll
        </p>
        <div style={{ height: '60vh' }} />
```

Puis `bun run dev` et vérifier dans un navigateur, dans cet ordre :

1. Le paragraphe est **invisible** au chargement, puis monte et apparaît quand on scrolle jusqu'à lui.
2. La barre de progression en haut se remplit à mesure qu'on scrolle.
3. Dans les DevTools, Rendering → *Emulate CSS media feature prefers-reduced-motion: reduce*, recharger : le paragraphe est **immédiatement visible** sans animation, et la barre de progression reste à zéro. C'est le test qui compte — un contenu rendu invisible pour un utilisateur en reduced-motion serait le pire bug possible de ce runtime.

Retirer ensuite le bloc temporaire.

- [ ] **Step 6: Vérifier et commit**

```bash
cd apps/web && bun run verify:ds && bun run check-types && bun run build
git add apps/web/components/motion apps/web/app/layout.tsx
git commit -m "feat(web): runtime d'animation marketing (reveal, progression, spotlight)"
```

---

### Task 5: Estimateur de coût — TDD

C'est la seule vraie logique du sous-projet, et c'est de l'arithmétique de facturation. Les tests viennent avant l'implémentation.

**Files:**
- Create: `apps/web/content/pricing.test.ts`
- Create: `apps/web/content/pricing.ts`

**Interfaces:**
- Consumes: rien
- Produces:
  - `export type Period = 'monthly' | 'annual'`
  - `export interface Estimate { plan: string; cost: string; note: string }`
  - `export function estimate(minutes: number, period: Period): Estimate`
  - `export const PLANS: Record<Period, Plan[]>`, `export const PLAN_COLUMNS: string[]`, `export const HIGHLIGHT: number`, `export const PRICING_GROUPS: PricingGroup[]`, `export const FAQ: FaqEntry[]` (consommés par la Task 8)

- [ ] **Step 1: Écrire les tests qui échouent**

`apps/web/content/pricing.test.ts` :

```ts
import { test, expect } from 'bun:test';
import { estimate } from './pricing';

test('sous 10 000 minutes on reste sur Free', () => {
  expect(estimate(0, 'monthly').plan).toBe('Free');
  expect(estimate(9_999, 'monthly').plan).toBe('Free');
  expect(estimate(10_000, 'monthly').plan).toBe('Free');
  expect(estimate(10_000, 'monthly').cost).toBe('€0');
});

test('Free est un hard stop : pas d overage facture', () => {
  expect(estimate(10_000, 'monthly').note).toContain('new rooms are refused');
});

test('juste au-dessus de la limite Free on bascule sur Starter a sa base', () => {
  const e = estimate(10_001, 'monthly');
  expect(e.plan).toBe('Starter');
  expect(e.cost).toBe('€49');
});

test('Starter inclut 50 000 minutes, donc rien au-dessus de la base', () => {
  expect(estimate(50_000, 'monthly').cost).toBe('€49');
});

test('au-dela de 50 000 minutes Starter facture l overage a 0,0012', () => {
  // 49 + 70 000 * 0.0012 = 133
  expect(estimate(120_000, 'monthly').cost).toBe('€133');
});

test('a l egalite exacte Starter l emporte sur Scale', () => {
  // 49 + 375 000 * 0.0012 = 499 = base Scale
  const e = estimate(425_000, 'monthly');
  expect(e.plan).toBe('Starter');
  expect(e.cost).toBe('€499');
});

test('une minute plus loin Scale devient moins cher', () => {
  const e = estimate(425_001, 'monthly');
  expect(e.plan).toBe('Scale');
  expect(e.cost).toBe('€499');
});

test('au-dela de 500 000 minutes Scale facture l overage a 0,0009', () => {
  // 499 + 700 000 * 0.0009 = 1129
  const e = estimate(1_200_000, 'monthly');
  expect(e.plan).toBe('Scale');
  expect(e.cost).toBe('€1,129');
});

test('au-dela de 1,2M de minutes on bascule sur Business', () => {
  const e = estimate(1_200_001, 'monthly');
  expect(e.plan).toBe('Business');
  expect(e.cost).toBe('Custom');
});

test('en annuel les bases sont 39 et 399', () => {
  expect(estimate(10_001, 'annual').cost).toBe('€39');
  // 39 + 300 000 * 0.0012 = 399 = base Scale annuelle, egalite -> Starter
  const tie = estimate(350_000, 'annual');
  expect(tie.plan).toBe('Starter');
  expect(tie.cost).toBe('€399');
  expect(estimate(350_001, 'annual').plan).toBe('Scale');
});

test('la note cite le cout du plan concurrent', () => {
  const e = estimate(1_200_000, 'monthly');
  expect(e.note).toContain('Starter would cost €1,429');
});
```

- [ ] **Step 2: Lancer les tests et vérifier qu'ils échouent**

```bash
cd apps/web && bun test content/pricing.test.ts
```

Attendu : ÉCHEC, avec une erreur de résolution du module `./pricing` (le fichier n'existe pas encore).

- [ ] **Step 3: Écrire l'implémentation minimale**

`apps/web/content/pricing.ts` — port à l'identique de la méthode `estimate()` de la classe de logique de `$HANDOFF/designs/Pricing.dc.html`. Ne rien « améliorer » : les bornes, l'ordre des tests et le sens de l'égalité sont le comportement validé.

```ts
// UNVERIFIED — chiffres proposés par le handoff de design, non validés produit.
// Origine : $HANDOFF/designs/Pricing.dc.html (const PLANS, PRICING_GROUPS, FAQ + estimate()).
// Le modèle Cloud (plans, quotas, unités de facturation, prix) doit être confirmé contre
// sightline-cloud avant toute mise en ligne publique.

export type Period = 'monthly' | 'annual';

export interface Estimate {
  plan: string;
  cost: string;
  note: string;
}

const FREE_MINUTES = 10_000;
const STARTER_MINUTES = 50_000;
const SCALE_MINUTES = 500_000;
const BUSINESS_MINUTES = 1_200_000;
const STARTER_OVERAGE = 0.0012;
const SCALE_OVERAGE = 0.0009;

const fmt = (n: number) => n.toLocaleString('en-US');
const eur = (n: number) =>
  '€' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export function estimate(minutes: number, period: Period): Estimate {
  const m = minutes;
  const yearly = period === 'annual';
  const starterBase = yearly ? 39 : 49;
  const scaleBase = yearly ? 399 : 499;

  if (m <= FREE_MINUTES) {
    return {
      plan: 'Free',
      cost: '€0',
      note: 'Under 10,000 participant-minutes a month you stay on Free — no card, no expiry. Past the cap, new rooms are refused until you pick a plan.',
    };
  }

  const starter = starterBase + Math.max(0, m - STARTER_MINUTES) * STARTER_OVERAGE;
  const scale = scaleBase + Math.max(0, m - SCALE_MINUTES) * SCALE_OVERAGE;

  if (m > BUSINESS_MINUTES) {
    return {
      plan: 'Business',
      cost: 'Custom',
      note: 'Above roughly 1.2M minutes a month, negotiated volume beats list price. Dedicated regions and an SLA come with it.',
    };
  }

  if (starter <= scale) {
    return {
      plan: 'Starter',
      cost: eur(Math.round(starter)),
      note:
        m > STARTER_MINUTES
          ? `Starter base ${eur(starterBase)} + ${fmt(m - STARTER_MINUTES)} overage minutes at €0.0012. Scale would cost ${eur(Math.round(scale))}.`
          : 'Starter includes 50,000 minutes, so nothing above the base at this volume.',
    };
  }

  return {
    plan: 'Scale',
    cost: eur(Math.round(scale)),
    note:
      m > SCALE_MINUTES
        ? `Scale base ${eur(scaleBase)} + ${fmt(m - SCALE_MINUTES)} overage minutes at €0.0009. Starter would cost ${eur(Math.round(starter))}.`
        : 'Scale includes 500,000 minutes and costs less than Starter overage at this volume.',
  };
}
```

- [ ] **Step 4: Lancer les tests et vérifier qu'ils passent**

```bash
cd apps/web && bun test content/pricing.test.ts
```

Attendu : 11 tests au vert.

- [ ] **Step 5: Ajouter les données de plans, la grille comparative et la FAQ**

Toujours dans `apps/web/content/pricing.ts`, sous la fonction. Le contenu se copie depuis la classe de logique de `$HANDOFF/designs/Pricing.dc.html` : `PLANS` (les deux tableaux `monthly` et `annual`, cinq entrées chacun), `PLAN_COLUMNS`, `HIGHLIGHT`, `PRICING_GROUPS` (quatre groupes — Usage, Observability, Alerting, Team & support) et `FAQ` (huit entrées). Les types à déclarer :

```ts
export interface Plan {
  name: string;
  price: string;
  per: string;
  headline: string;
  who: string;
  features: string[];
  cta: string;
  variant: 'primary' | 'secondary';
  featured: boolean;
}

export interface PricingRow {
  label: string;
  v: string[];
}

export interface PricingGroup {
  title: string;
  rows: PricingRow[];
}

export interface FaqEntry {
  q: string;
  a: string;
}

export const PLAN_COLUMNS = ['Self-hosted', 'Free', 'Starter', 'Scale', 'Business'];
export const HIGHLIGHT = 3;
export const PLANS: Record<Period, Plan[]>;
export const PRICING_GROUPS: PricingGroup[];
export const FAQ: FaqEntry[];
```

Les valeurs se copient **mot pour mot** depuis la classe de logique de `$HANDOFF/designs/Pricing.dc.html`, sans reformuler — ce sont des chaînes éditoriales validées. Localiser la source ainsi :

```bash
sed -n '/data-dc-script/,$p' "$HANDOFF/designs/Pricing.dc.html" | sed -n '1,95p'
```

Ce qu'on y trouve, dans l'ordre : `PLANS` (deux tableaux `monthly` et `annual` de cinq objets chacun, aux champs identiques à l'interface `Plan` ci-dessus), `PLAN_COLUMNS`, `HIGHLIGHT`, `PRICING_GROUPS` (quatre groupes — Usage 7 lignes, Observability 6, Alerting 5, Team & support 5, chaque ligne ayant exactement 5 valeurs dans l'ordre de `PLAN_COLUMNS`), et `FAQ` (huit paires `{ q, a }`).

Deux points de vigilance au moment de la copie : les tableaux `v` de `PRICING_GROUPS` doivent tous faire exactement 5 entrées, sinon le tableau comparatif se décale silencieusement ; et le tiret utilisé pour « non inclus » est un tiret cadratin `—`, pas un trait d'union — `ComparisonTable` (Task 8) le teste littéralement pour choisir `--text-faint`.

- [ ] **Step 6: Vérifier et commit**

```bash
cd apps/web && bun test && bun run check-types && bun run verify:ds
git add apps/web/content/pricing.ts apps/web/content/pricing.test.ts
git commit -m "feat(web): estimateur de cout et donnees de pricing"
```

---

### Task 6: Home — en-tête sombre, hero et carte live

**Files:**
- Create: `apps/web/app/_sections/Hero.tsx`, `Hero.module.css`
- Create: `apps/web/app/_sections/SnippetTabs.tsx`
- Create: `apps/web/app/_sections/LiveCard.tsx`, `LiveCard.module.css`
- Create: `apps/web/content/home.ts`
- Modify: `apps/web/app/page.tsx`

**Interfaces:**
- Consumes: `SiteHeader` (Task 3), `Spotlight` (Task 4), `Tabs`, `Button`, `StatusDot`, `MetricCard`, `DataTable` de `@sightline/ui`
- Produces:
  - `content/home.ts` :
    ```ts
    export interface SnippetSet {
      tabs: { id: string; label: string }[];
      snippets: Record<string, string>;
    }
    export interface HeroPeer {
      id: string;
      loss: string;
      rtt: string;
      status: 'live' | 'warn' | 'error';
    }
    export interface CompareRow {
      label: string;
      sightline: string;
      other: string;
    }
    export const START: SnippetSet;
    export const HERO_PEERS: HeroPeer[];
    export const COMPARE_ROWS: CompareRow[]; // consommée par la Task 7
    export function series(n: number, seed: number, base: number, amp: number): number[];
    ```
    `START.tabs` alimente le `Tabs` et `START.snippets[id]` donne le corps du snippet — c'est la forme que `SnippetTabs` consomme au Step 2, ne pas en dévier.
  - `<Hero />`, `<LiveCard />`

**Source :** `$HANDOFF/designs/Home.dc.html`, template lignes 45–185, constantes `HERO_PEERS` et `START` de la classe de logique.

- [ ] **Step 1: Extraire le contenu dans `content/home.ts`**

Copier depuis la classe de logique de `Home.dc.html` : `HERO_PEERS` (les peers affichés dans la carte live) et `START` (les onglets de snippet de démarrage, avec pour chaque onglet un `id`, un `label` et le corps du snippet). Déclarer les types correspondants. La fonction `series(n, seed, base, amp)` de la source génère les points de courbe : la porter telle quelle en fonction pure exportée, elle est déterministe.

- [ ] **Step 2: Écrire `SnippetTabs.tsx` (îlot client)**

```tsx
'use client';

import { useState } from 'react';
import { Tabs } from '@sightline/ui';
import { START } from '@/content/home';

export function SnippetTabs() {
  const [active, setActive] = useState(START.tabs[0].id);
  const snippet = START.snippets[active];

  return (
    <div className="flex flex-col gap-3">
      <Tabs tabs={START.tabs} activeId={active} onSelect={setActive} variant="segmented" />
      <div
        style={{
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--surface-card)',
          padding: 18,
          fontSize: 12.5,
          lineHeight: 1.7,
          whiteSpace: 'pre-wrap',
          color: 'var(--text-body)',
        }}
      >
        {snippet}
      </div>
    </div>
  );
}
```

Le snippet reste en Geist — le système interdit le monospace, et `verify:ds` le vérifie.

- [ ] **Step 3: Écrire `Hero.module.css`**

Les valeurs display et la trame de points, qui sont toutes hors échelle :

```css
.title {
  margin: 0;
  font-size: 40px;
  font-weight: 600;
  letter-spacing: -0.035em;
  line-height: 1.02;
  color: var(--text-strong);
  text-wrap: pretty;
}
@media (min-width: 1120px) {
  .title { font-size: 62px; }
}

.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 40px;
  align-items: start;
  padding-top: 56px;
}
@media (min-width: 1120px) {
  .grid {
    grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
    gap: 56px;
    padding-top: 84px;
  }
}

/* Trame de points du hero, masquée en haut à gauche. Décorative — la seule imagerie
   du site avec le spotlight. */
.dots {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(var(--n-700) 1px, transparent 1px);
  background-size: 24px 24px;
  opacity: 0.5;
  pointer-events: none;
  mask-image: radial-gradient(130% 78% at 26% 0%, #000 0%, transparent 100%);
  -webkit-mask-image: radial-gradient(130% 78% at 26% 0%, #000 0%, transparent 100%);
}

.lead {
  margin: 0;
  font-size: 17px;
  line-height: 1.6;
  color: var(--text-muted);
  max-width: 520px;
  text-wrap: pretty;
}
```

Les deux `#000` du masque ne sont pas des couleurs de rendu mais des stops d'opacité de masque — c'est pourtant une valeur littérale, et le vérificateur la refusera. Écrire `var(--n-950)` à la place : le masque n'utilise que le canal alpha, la teinte est sans effet.

- [ ] **Step 4: Écrire `Hero.tsx`**

Section sombre : le conteneur porte `theme-dark` et `data-hero`, contient `<Spotlight />` et la trame en absolu, puis la grille. L'eyebrow est en `.sl-label` `--accent-text` avec `data-anim="slide" data-anim-now data-anim-delay="0"`, le h1 porte `data-words data-words-delay="40"`, le paragraphe `data-anim="rise" data-anim-now data-anim-delay="520"`, la rangée de CTA `data-anim-delay="600"`, la colonne de droite `data-anim-delay="320"`. Les deux CTA sont un `Button variant="primary"` vers `/signup` et un `Button variant="secondary"` vers le dépôt GitHub. Reprendre les textes exacts du template (lignes 65–112 de la source).

- [ ] **Step 5: Écrire `LiveCard.tsx` et son module**

Carte en `--shadow-lg`, radius 18px, posée à cheval sur la fin du hero : une bande `--n-900` de 120px en absolu derrière elle, et la carte remontée par un `margin-top` négatif. En-tête de carte en `padding: 12px 18px` sur `--surface-sunken` avec un `<StatusDot status="live" />`. Le corps reprend la grille de la source : la courbe de bitrate à gauche sous le label `.sl-label` « Bitrate per peer — last 30 minutes », la table des peers à droite sous « Peers — worst first », alimentée par `HERO_PEERS`. La carte porte `data-anim="rise" data-anim-now data-anim-delay="420"`.

- [ ] **Step 6: Composer la page**

```tsx
import { SiteHeader } from '@/components/chrome/SiteHeader';
import { SiteFooter } from '@/components/chrome/SiteFooter';
import { Hero } from './_sections/Hero';
import { LiveCard } from './_sections/LiveCard';

export default function Home() {
  return (
    <>
      <Hero />
      <LiveCard />
      <SiteFooter />
    </>
  );
}
```

`SiteHeader` est rendu **à l'intérieur** de `Hero`, en `theme="dark"`, pour qu'il partage le fond sombre et les calques décoratifs.

- [ ] **Step 7: Vérifier côte à côte**

```bash
cd apps/web && bun run verify:ds && bun run check-types && bun run build && bun run dev
```

Ouvrir `$HANDOFF/designs/Home.dc.html` dans un onglet et `http://localhost:3002` dans un autre, tous deux à 1280px de large. Vérifier dans l'ordre : le h1 se révèle mot par mot au chargement ; le spotlight suit la souris dans le hero et s'éteint quand elle sort ; la carte live chevauche bien la bande sombre ; le dot `live` respire (2.6s, opacité 1 → .5). Puis forcer `prefers-reduced-motion: reduce` et recharger : tout est visible, rien ne bouge, y compris le dot.

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/_sections apps/web/content/home.ts apps/web/app/page.tsx
git commit -m "feat(web): Home — hero sombre, snippets et carte live"
```

---

### Task 7: Home — sections pains, comparatif, pricing inline et CTA

**Files:**
- Create: `apps/web/app/_sections/Pains.tsx`, `Pains.module.css`
- Create: `apps/web/app/_sections/CompareStrip.tsx`, `CompareStrip.module.css`
- Create: `apps/web/app/_sections/PricingStrip.tsx`
- Create: `apps/web/app/_sections/OpenSource.tsx`
- Create: `apps/web/app/_sections/FinalCta.tsx`, `FinalCta.module.css`
- Create: `apps/web/components/marketing/HairlineGrid.tsx`, `HairlineGrid.module.css`
- Create: `apps/web/content/benchmarks.ts`
- Modify: `apps/web/app/page.tsx`

**Interfaces:**
- Consumes: `COMPARE_ROWS` de `content/home.ts` (Task 6), `PLANS` et `PLAN_COLUMNS` de `content/pricing.ts` (Task 5), `Button` et `Badge` de `@sightline/ui`
- Produces:
  - `<HairlineGrid columns={number}>` — grille en `gap: 1px` sur fond `--border-subtle`, les enfants peignant les filets ; réutilisée par la Task 8
  - `content/benchmarks.ts` : `export const BENCHMARKS: Benchmark[]` avec `interface Benchmark { label: string; value: string; note: string }`

**Source :** `$HANDOFF/designs/Home.dc.html`, template lignes 186–344.

- [ ] **Step 1: Écrire `content/benchmarks.ts`**

```ts
// UNVERIFIED — les trois mesures ci-dessous n'ont pas été prises. Le handoff les affiche
// comme « benchmark pending » sur Home et Pricing. À remplacer par de vraies mesures Rust
// (mémoire au repos, peers par cœur, latence p99) avant toute mise en ligne publique.

export interface Benchmark {
  label: string;
  value: string;
  note: string;
}

export const BENCHMARKS: Benchmark[] = [
  { label: 'Memory at rest', value: 'benchmark pending', note: 'Single process, no rooms.' },
  { label: 'Peers per core', value: 'benchmark pending', note: 'Forwarding only, 720p.' },
  { label: 'Forwarding p99', value: 'benchmark pending', note: 'SFU-internal, excludes network.' },
];
```

- [ ] **Step 2: Écrire `HairlineGrid`**

Le pattern récurrent du système : le conteneur porte le fond `--border-subtle` et un `gap: 1px`, chaque cellule peint son propre fond, et les filets apparaissent dans les interstices.

`HairlineGrid.module.css` :

```css
.grid {
  display: grid;
  gap: 1px;
  background: var(--border-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
```

`HairlineGrid.tsx` :

```tsx
import type { ReactNode } from 'react';
import s from './HairlineGrid.module.css';

export function HairlineGrid({
  columns,
  children,
  className,
}: {
  columns: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[s.grid, className].filter(Boolean).join(' ')}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  );
}
```

Les cellules enfantes doivent porter `background: var(--surface-card)` — sans quoi les filets ne se dessinent pas.

- [ ] **Step 3: Écrire `Pains.tsx`**

Trois blocs en grille `1fr 1fr`, gap 44px, séparés par un `border-bottom: 1px solid var(--border)`. Chaque bloc porte un index numéroté en `.sl-num` 12px `--text-faint`, et **l'ordre visuel des colonnes alterne** d'un bloc à l'autre (la source utilise la propriété CSS `order` ; en React, alterner la valeur d'`order` sur les deux colonnes selon la parité de l'index). Sous 1120px les deux colonnes s'empilent et l'alternance disparaît. Textes exacts depuis la source, lignes 186–214. Chaque bloc porte `data-anim="rise"` avec un délai croissant de 90ms.

- [ ] **Step 4: Écrire `CompareStrip.tsx`**

Grille `1.1fr 1fr 1fr`, en-tête sur `--surface-sunken` avec trois `.sl-label` (« Architectural default », « Sightline » en `--accent-text`, « Typical Go SFU stack »), wrapper en radius 18px `overflow: hidden`. Les lignes viennent de `COMPARE_ROWS`. Un lien « See the full comparison → » vers `/compare/livekit` ferme la section. Sous 768px la grille défile horizontalement dans un conteneur `overflow-x-auto` avec une largeur minimale de 640px.

- [ ] **Step 5: Écrire `PricingStrip.tsx`**

`<HairlineGrid columns={5}>` avec une cellule par plan, `padding: 24px 18px`, gap 14px : le nom en `.sl-label`, le prix, la ligne d'inclusion, et le CTA. Les données viennent de `PLANS.monthly` de `content/pricing.ts`. Une ligne « Overage » en `.sl-label` sous la grille. Sous 1120px la grille passe à 2 colonnes, sous 768px à 1.

- [ ] **Step 6: Écrire `OpenSource.tsx` et `FinalCta.tsx`**

`OpenSource` : grille `180px minmax(0,1fr)`, gap 40px, `padding: 72px 40px`, label latéral « Open source ». C'est la section qui affiche les `BENCHMARKS`.

`FinalCta` : h2 en 52px/600/`-0.035em`/lh 1.05 (34px sous 768px, dans `FinalCta.module.css`), aligné à gauche, `max-width: 820px`, `padding: 88px 40px`, suivi des deux CTA. Texte exact : « Next time video gets bad, you'll know which peer, which metric, and for how long. »

- [ ] **Step 7: Composer la page complète**

```tsx
import { SiteFooter } from '@/components/chrome/SiteFooter';
import { Hero } from './_sections/Hero';
import { LiveCard } from './_sections/LiveCard';
import { Pains } from './_sections/Pains';
import { CompareStrip } from './_sections/CompareStrip';
import { PricingStrip } from './_sections/PricingStrip';
import { OpenSource } from './_sections/OpenSource';
import { FinalCta } from './_sections/FinalCta';

export default function Home() {
  return (
    <>
      <Hero />
      <LiveCard />
      <Pains />
      <CompareStrip />
      <PricingStrip />
      <OpenSource />
      <FinalCta />
      <SiteFooter />
    </>
  );
}
```

- [ ] **Step 8: Vérifier et commit**

```bash
cd apps/web && bun run verify:ds && bun run check-types && bun run build && bun run dev
```

Comparer la page entière à `$HANDOFF/designs/Home.dc.html` à 1280px, puis à 900px et 400px. Vérifier en particulier que les filets de `HairlineGrid` sont bien des traits de 1px continus et non des bordures doublées, et qu'à 400px rien ne provoque de défilement horizontal du `body`.

```bash
git add apps/web/app/_sections apps/web/components/marketing apps/web/content/benchmarks.ts apps/web/app/page.tsx
git commit -m "feat(web): Home — pains, comparatif, pricing inline et CTA final"
```

---

### Task 8: Page Pricing

**Files:**
- Create: `apps/web/app/pricing/page.tsx`
- Create: `apps/web/app/pricing/_sections/PlanCards.tsx`, `PlanCards.module.css`
- Create: `apps/web/app/pricing/_sections/CostEstimator.tsx`, `CostEstimator.module.css`
- Create: `apps/web/app/pricing/_sections/ComparisonTable.tsx`, `ComparisonTable.module.css`
- Create: `apps/web/app/pricing/_sections/PricingFaq.tsx`

**Interfaces:**
- Consumes: `estimate`, `PLANS`, `PLAN_COLUMNS`, `HIGHLIGHT`, `PRICING_GROUPS`, `FAQ` de `content/pricing.ts` (Task 5) ; `SiteHeader`, `SiteFooter`, `Tabs`, `Button`, `Badge`
- Produces: la route `/pricing`

**Source :** `$HANDOFF/designs/Pricing.dc.html`.

- [ ] **Step 1: Écrire `PlanCards.tsx`**

Cinq cartes en grille. La carte `featured` (Scale) porte `boxShadow: 'inset 0 2px 0 var(--accent)'`, les autres `none`. Chaque carte affiche le nom, le prix et son `per`, la `headline`, le `who`, la liste de `features`, et un `Button` dont la `variant` vient de la donnée. Le toggle mensuel/annuel est un `Tabs variant="segmented"` — il pilote l'état, donc les cartes sont rendues par l'îlot client de l'étape suivante, ou bien la page entière prend l'état. Choisir la première option : `PlanCards` reçoit `plans: Plan[]` en prop et reste un Server Component.

- [ ] **Step 2: Écrire `CostEstimator.tsx` (îlot client)**

Un seul curseur, comme la source — le README du handoff en annonce trois à tort. La période
n'est **pas** un état local : elle descend en prop depuis `PlanSwitcher` (Step 5), parce que
les cartes de plans et l'estimateur doivent afficher la même. L'état des minutes, lui, est
propre à l'estimateur.

```tsx
'use client';

import { useState } from 'react';
import { estimate, type Period } from '@/content/pricing';
import s from './CostEstimator.module.css';

export function CostEstimator({ period }: { period: Period }) {
  const [minutes, setMinutes] = useState(120_000);
  const est = estimate(minutes, period);

  return (
    <div className="flex flex-col gap-5">
      <label className="flex flex-col gap-2">
        <span className="sl-label">Participant-minutes per month</span>
        <input
          type="range"
          min={0}
          max={1_500_000}
          step={10_000}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          className={s.range}
        />
        <span className="sl-num" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {minutes.toLocaleString('en-US')} participant-minutes/mo
        </span>
      </label>
      <div className="flex items-baseline gap-3">
        <span className="sl-num" style={{ fontSize: 34, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-strong)' }}>
          {est.cost}
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>on {est.plan}</span>
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-muted)', textWrap: 'pretty' }}>
        {est.note}
      </p>
    </div>
  );
}
```

`CostEstimator.module.css` stylise le `input[type=range]` : piste de 4px en `--border-strong`, pouce de 16px en `--accent`, anneau de focus `--ring-accent`, aucune couleur littérale.

- [ ] **Step 3: Écrire `ComparisonTable.tsx`**

Quatre groupes issus de `PRICING_GROUPS`, chacun avec son titre en `.sl-label` puis ses lignes. Six colonnes : le libellé plus les cinq de `PLAN_COLUMNS`. La colonne d'index `HIGHLIGHT` (Scale, index 3) est mise en avant : texte `--text-strong` et fond `--accent-tint`. Les autres cellules sont en `--text-muted`, ou `--text-faint` quand la valeur est le tiret cadratin `—`.

Six colonnes ne se replient pas : le tableau vit dans un conteneur `overflow-x-auto` avec `min-width: 900px`, et la colonne de libellés est collée à gauche par `position: sticky; left: 0` avec un fond `--surface-card` opaque.

- [ ] **Step 4: Écrire `PricingFaq.tsx`**

Les huit entrées de `FAQ`, en `<details>`/`<summary>` natifs — pas d'état, donc pas de client. Question en 14px/600, réponse en 13px/lh 1.6 `--text-muted`.

- [ ] **Step 5: Écrire `PlanSwitcher.tsx` (îlot client)**

Le toggle mensuel/annuel pilote **à la fois** les cartes de plans et l'estimateur : les deux doivent afficher la même période. L'état vit donc dans un parent client unique, qui rend `PlanCards` (Server Component recevant `plans` en prop) et passe la période à `CostEstimator`. C'est le seul îlot client supplémentaire de cette tâche, et il est déclaré dans `CLIENT_ALLOWED` du vérificateur (Task 2).

```tsx
'use client';

import { useState } from 'react';
import { Tabs } from '@sightline/ui';
import { PLANS, type Period, type Plan } from '@/content/pricing';
import { PlanCards } from './PlanCards';
import { CostEstimator } from './CostEstimator';

const PERIOD_TABS = [
  { id: 'monthly', label: 'Monthly' },
  { id: 'annual', label: 'Yearly −20%' },
];

export function PlanSwitcher() {
  const [period, setPeriod] = useState<Period>('monthly');
  const plans: Plan[] = PLANS[period];

  return (
    <div className="flex flex-col gap-10">
      <Tabs
        tabs={PERIOD_TABS}
        activeId={period}
        onSelect={(id) => setPeriod(id as Period)}
        variant="segmented"
      />
      <PlanCards plans={plans} />
      <CostEstimator period={period} />
    </div>
  );
}
```

- [ ] **Step 6: Composer `/pricing`**

Assembler `SiteHeader`, un en-tête de page (h1 en 44px, sous-titre 17px), `PlanSwitcher`, `ComparisonTable`, `PricingFaq`, `SiteFooter`.

- [ ] **Step 7: Vérifier et commit**

```bash
cd apps/web && bun test && bun run verify:ds && bun run check-types && bun run build && bun run dev
```

Comparer `/pricing` à `$HANDOFF/designs/Pricing.dc.html`. Vérifier que déplacer le curseur recalcule prix, plan et note en direct, que passer en annuel change les bases à 39 et 399, et qu'à 400px le tableau comparatif défile horizontalement **sans** que la page elle-même défile.

```bash
git add apps/web/app/pricing
git commit -m "feat(web): page Pricing avec estimateur de cout"
```

---

### Task 9: Page Compare LiveKit

**Files:**
- Create: `apps/web/app/compare/livekit/page.tsx`
- Create: `apps/web/app/compare/livekit/_sections/Summary.tsx`
- Create: `apps/web/app/compare/livekit/_sections/CompareGroups.tsx`
- Create: `apps/web/app/compare/livekit/_sections/Topology.tsx`, `Topology.module.css`
- Create: `apps/web/app/compare/livekit/_sections/MigrationSteps.tsx`
- Create: `apps/web/app/compare/livekit/_sections/NotForYou.tsx`
- Create: `apps/web/content/compare.ts`

**Interfaces:**
- Consumes: `SiteHeader`, `SiteFooter`, `Badge`, `Pill`, `HairlineGrid` (Task 7)
- Produces:
  - `content/compare.ts` : `SUMMARY`, `GROUPS`, `REPLACES`, `STEPS`, `NOT_FOR_YOU`, avec leurs interfaces

**Source :** `$HANDOFF/designs/Compare LiveKit.dc.html`.

- [ ] **Step 1: Extraire le contenu dans `content/compare.ts`**

Copier mot pour mot les cinq constantes de la classe de logique : `SUMMARY` (3 entrées `{ index, delay, title, body }`), `GROUPS` (4 groupes — Architecture, Observability, Product scope, Licence & maturity), `REPLACES`, `STEPS` (3 étapes `{ n, delay, title, lines, note }`), `NOT_FOR_YOU` (4 entrées `{ title, body }`). Déclarer les interfaces TypeScript correspondantes.

- [ ] **Step 2: Écrire `Summary.tsx` et `CompareGroups.tsx`**

`Summary` : trois blocs numérotés, chacun avec `data-anim="rise"` et le `delay` porté par la donnée. `CompareGroups` : même traitement que le tableau comparatif de Pricing — conteneur `overflow-x-auto`, colonne de libellés collante, colonne Sightline mise en avant en `--accent-tint`.

- [ ] **Step 3: Écrire `Topology.tsx` et son module**

La visualisation de topologie en SVG. Les traits animés utilisent `stroke-dasharray` avec `sl-beam` à l'arrivée puis `sl-dash` en flux continu :

```css
.beam {
  stroke: var(--accent);
  stroke-width: 1.5;
  fill: none;
  stroke-dasharray: 6 6;
  animation:
    sl-beam 900ms cubic-bezier(0.16, 0.84, 0.32, 1) both,
    sl-dash 1200ms linear 900ms infinite;
}
@media (prefers-reduced-motion: reduce) {
  .beam { animation: none; }
}
```

C'est la seule exception autorisée à la règle « `prefers-reduced-motion` n'est testé que dans `MarketingMotion` » : l'animation est déclarée en CSS, pas pilotée par le runtime, donc elle doit se désarmer en CSS. Le noter en commentaire dans le module.

- [ ] **Step 4: Écrire `MigrationSteps.tsx` et `NotForYou.tsx`**

`MigrationSteps` : trois étapes, chacune avec son titre, son bloc de `lines` (des diffs de configuration — lignes commençant par `-` en `--danger`, par `+` en `--ok`, le reste en `--text-muted`) et sa `note`. Rendu en Geist, pas en monospace.

`NotForYou` : la section « Cases where LiveKit is still the better call », quatre entrées. **Cette section reste intégralement et n'est pas adoucie** — c'est une section d'honnêteté assumée par le design.

- [ ] **Step 5: Composer, vérifier et commit**

```bash
cd apps/web && bun run verify:ds && bun run check-types && bun run build && bun run dev
```

Comparer à la maquette. Vérifier que les beams s'animent à l'arrivée puis bouclent, et qu'en `prefers-reduced-motion: reduce` ils sont statiques mais visibles.

```bash
git add apps/web/app/compare apps/web/content/compare.ts
git commit -m "feat(web): page comparative LiveKit"
```

---

### Task 10: Page Docs

**Files:**
- Create: `apps/web/content/metrics.ts`
- Create: `apps/web/app/docs/page.tsx`
- Create: `apps/web/app/docs/_sections/MetricSection.tsx`
- Create: `apps/web/app/docs/_sections/DocsRail.tsx`, `DocsRail.module.css`
- Create: `apps/web/app/docs/_sections/Overrides.tsx`

**Interfaces:**
- Consumes: `DataTable`, `Badge`, `Icon` de `@sightline/ui`
- Produces:
  - `content/metrics.ts` : `export const METRICS: Metric[]` avec
    `interface Metric { name: string; field: string; unit: string; threshold: string; scope: string; body: string; breaks: string; payload: string }`
  - ```ts
    export interface DocNavItem {
      id: string;   // = Metric['field'] pour les six métriques, plus 'overrides'
      label: string;
    }
    export const DOC_NAV: DocNavItem[];
    ```

**Source :** `$HANDOFF/designs/Docs.dc.html`, constantes `METRICS` et `DOC_NAV`.

- [ ] **Step 1: Écrire `content/metrics.ts`**

Ce fichier ne porte **pas** d'avertissement `UNVERIFIED` : c'est la seule donnée vérifiée de tout le handoff, elle vient de la référence des métriques du `README.md` du dépôt. Ajouter en tête :

```ts
// Source de vérité : la référence des métriques du README.md du dépôt. Ces six champs et
// leurs seuils sont réels — contrairement au reste du contenu marketing. Cette constante
// sera partagée avec apps/dashboard (sous-projet B) : la déplacer dans un package commun
// le jour où le dashboard en a besoin, plutôt que de la dupliquer.
```

Les six entrées, avec leurs seuils exacts : `packet_loss_ratio` > 2%, `rtt_ms` > 200ms, `jitter_ms` > 30ms, `nack_ratio` > 5%, `freeze_ratio` > 1%, `bitrate_kbps` < 100kbps. Copier les `body`, `breaks` et `payload` mot pour mot depuis la source.

- [ ] **Step 2: Écrire `MetricSection.tsx`**

Une section par métrique, ancrée par `id={metric.field}`, séparée par un `border-top: 1px solid var(--border)`. Affiche le nom lisible, le champ brut en casse normale (jamais embelli), l'unité, le scope, le corps, le cas qui la fait casser, le payload d'exemple dans un bloc inset, et le seuil dans un `<Badge tone="danger">`.

- [ ] **Step 3: Écrire `DocsRail.tsx` (îlot client)**

Le rail est **à droite** — un `<aside>` avec `border-left`, `overflow: auto`, `padding: 36px 20px 40px`, classe `sl-scroll`. Il surligne la section courante au scroll via son propre `IntersectionObserver`, indépendant de `MarketingMotion` :

```tsx
'use client';

import { useEffect, useState } from 'react';
import { DOC_NAV } from '@/content/metrics';
import s from './DocsRail.module.css';

export function DocsRail() {
  const [active, setActive] = useState(DOC_NAV[0]?.id ?? '');

  useEffect(() => {
    const ids = DOC_NAV.map((n) => n.id);
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length) setActive(visible[0].target.id);
      },
      { rootMargin: '0px 0px -70% 0px', threshold: 0 },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  return (
    <aside className={`sl-scroll ${s.rail}`}>
      {DOC_NAV.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className={s.item}
          data-active={item.id === active ? '1' : undefined}
        >
          {item.label}
        </a>
      ))}
    </aside>
  );
}
```

Le style sélectionné suit la règle du système : tint accent plus un inset de 2px accent — ici sur le bord gauche de l'item.

- [ ] **Step 4: Écrire `Overrides.tsx` et composer la page**

Section « Overriding a threshold » ancrée `id="overrides"`, avec l'exemple `PATCH /v1/projects/live-classroom/thresholds`. La page a son propre chrome : en-tête de 60px sur `--surface-card` avec `border-bottom`, puis une grille `minmax(0,1fr) 260px` où le rail est la seconde colonne. Sous 1120px le rail passe en `display: none` — la page reste lisible sans lui.

- [ ] **Step 5: Vérifier et commit**

```bash
cd apps/web && bun run verify:ds && bun run check-types && bun run build && bun run dev
```

Comparer à la maquette. Vérifier que les six ancres fonctionnent, que le rail suit le scroll, et que les seuils affichés correspondent exactement à ceux du `README.md` du dépôt — c'est la seule page dont les chiffres doivent être justes.

```bash
git add apps/web/app/docs apps/web/content/metrics.ts
git commit -m "feat(web): page Docs — reference des six metriques"
```

---

### Task 11: Page Changelog

**Files:**
- Create: `apps/web/content/releases.ts`
- Create: `apps/web/app/changelog/page.tsx`

**Interfaces:**
- Consumes: `SiteHeader`, `SiteFooter`, `Badge`, `StatusDot`
- Produces: `content/releases.ts` : `export const RELEASES: Release[]` avec
  `interface Release { version: string; date: string; commit: string; latest: boolean; entries: ReleaseEntry[] }`

**Source :** `$HANDOFF/designs/Changelog.dc.html`, constante `RELEASES` (quatre versions : v0.4.1, v0.4.0, v0.3.8, v0.3.0).

- [ ] **Step 1: Écrire `content/releases.ts`**

```ts
// UNVERIFIED — versions, dates et hashes de commit proposés par le handoff de design.
// Aucune release n'est publiée sur le dépôt à ce jour. À remplacer par les vraies releases
// avant toute mise en ligne publique.
```

Copier les quatre entrées mot pour mot, avec leurs listes de changements.

- [ ] **Step 2: Écrire la page**

Entièrement statique, aucun état. Une entrée par release : version en 20px/600, date en 12px `--text-muted`, hash de commit court en casse normale (jamais embelli), `<Badge>` « latest » sur la plus récente uniquement, puis la liste des changements. Chaque entrée porte `data-anim="rise"` avec un délai croissant.

- [ ] **Step 3: Vérifier et commit**

```bash
cd apps/web && bun run verify:ds && bun run check-types && bun run build
git add apps/web/app/changelog apps/web/content/releases.ts
git commit -m "feat(web): page Changelog"
```

---

### Task 12: Page Sign up

**Files:**
- Create: `apps/web/content/signup.ts`
- Create: `apps/web/app/signup/page.tsx`
- Create: `apps/web/app/signup/_sections/SignupWizard.tsx`, `SignupWizard.module.css`
- Create: `apps/web/app/signup/_sections/SellingPoints.tsx`

**Interfaces:**
- Consumes: `Button`, `Input`, `Select`, `Badge`, `AlertBanner` de `@sightline/ui`
- Produces: `content/signup.ts` : `export const REGIONS: Region[]`, `export const SDK: Record<string, string>`, `export const POINTS: SellingPoint[]`

**Source :** `$HANDOFF/designs/Sign up.dc.html`.

- [ ] **Step 1: Extraire le contenu dans `content/signup.ts`**

Copier `REGIONS`, `SDK` et `POINTS` (quatre arguments : « One project, ready in 30 seconds », « Drop-in LiveKit signaling », « Six metrics armed by default », « A spend cap from minute one »).

- [ ] **Step 2: Écrire `SignupWizard.tsx` (îlot client)**

**Deux étapes plus un écran final**, pas trois : l'état est `'account' | 'project' | 'keys'` et le compteur affiche « Step 1 of 2 », « Step 2 of 2 », puis « Done » — c'est ce que fait la source, le README du handoff se trompe.

```tsx
'use client';

import { useState } from 'react';
import { Button, Input, Select } from '@sightline/ui';
import { REGIONS } from '@/content/signup';

type Step = 'account' | 'project' | 'keys';

export function SignupWizard() {
  const [step, setStep] = useState<Step>('account');
  const [region, setRegion] = useState('eu-west-3');
  const [staging, setStaging] = useState(true);

  const index = step === 'account' ? 0 : 1;
  const meta = step === 'keys' ? 'Done' : `Step ${index + 1} of 2`;

  // TODO(sous-projet C) : créer réellement le compte via packages/auth, puis le projet via
  // l'API Cloud. Aujourd'hui le wizard avance sans rien appeler, pour que le parcours soit
  // démontrable de bout en bout. Ne pas brancher ici : le modèle Cloud n'est pas validé.
  const submitAccount = () => setStep('project');
  const submitProject = () => setStep('keys');

  return (
    <div className="flex flex-col gap-6">
      <span className="sl-label">{meta}</span>
      {step === 'account' && <AccountStep onSubmit={submitAccount} />}
      {step === 'project' && (
        <ProjectStep
          region={region}
          onRegion={setRegion}
          staging={staging}
          onStaging={setStaging}
          onSubmit={submitProject}
          onBack={() => setStep('account')}
        />
      )}
      {step === 'keys' && <KeysStep />}
    </div>
  );
}
```

Les trois sous-composants vivent dans le même fichier, sous `SignupWizard` — ils n'ont pas d'état propre et n'ont pas à être exportés. Leur contenu se lit dans le template de `$HANDOFF/designs/Sign up.dc.html` (entre `<x-dc>` et `</x-dc>`), en repérant les trois branches `<sc-if value="{{ isAccount }}">`, `{{ isProject }}` et `{{ isKeys }}` :

- `AccountStep({ onSubmit }: { onSubmit: () => void })` — les `Input` d'email et de mot de passe, plus le `Button variant="primary"` de soumission.
- `ProjectStep({ region, onRegion, staging, onStaging, onSubmit, onBack })` — l'`Input` de nom de projet, le `Select` de région alimenté par `REGIONS`, la bascule staging, le choix de SDK depuis `SDK`, et les boutons retour et suite.
- `KeysStep()` — les clés affichées une seule fois, l'`AlertBanner` qui prévient qu'elles ne seront plus jamais montrées, et la confirmation « live-classroom is live ».

Reprendre les libellés, placeholders et textes d'aide **mot pour mot** depuis le template : ce sont des chaînes éditoriales validées, en sentence case, sans emoji.

- [ ] **Step 3: Écrire `SellingPoints.tsx` et composer la page**

Colonne latérale portant les quatre `POINTS`. Grille `minmax(0,1fr) 380px` à partir de `lg:`, empilée en dessous, la colonne latérale passant sous le wizard.

- [ ] **Step 4: Vérifier et commit**

```bash
cd apps/web && bun run verify:ds && bun run check-types && bun run build && bun run dev
```

Parcourir les deux étapes jusqu'à l'écran final et vérifier que le compteur affiche bien « Step 1 of 2 », « Step 2 of 2 » puis « Done ».

```bash
git add apps/web/app/signup apps/web/content/signup.ts
git commit -m "feat(web): page Sign up (UI seule, non branchee)"
```

---

### Task 13: Passe finale — responsive, accessibilité du mouvement, vérification complète

**Files:**
- Modify: tous les `_sections/*.module.css` qui en ont besoin
- Modify: `apps/web/app/layout.tsx` (métadonnées par route si manquantes)

**Interfaces:**
- Consumes: tout ce qui précède
- Produces: un site vérifié aux trois paliers

- [ ] **Step 1: Passer les six pages aux trois paliers**

Pour chaque route — `/`, `/pricing`, `/compare/livekit`, `/docs`, `/changelog`, `/signup` — ouvrir à **1440px**, **900px** et **375px** et vérifier :

1. Le `body` ne défile jamais horizontalement. Le test rapide, dans la console du navigateur :
   `document.documentElement.scrollWidth <= document.documentElement.clientWidth` doit être `true`.
2. Aucun texte n'est tronqué ni ne déborde de son conteneur.
3. Les titres display suivent bien l'échelle : h1 62 → 40px, h2 40 → 30px, CTA 52 → 34px.
4. Les tableaux larges (Pricing, Compare) défilent dans leur propre conteneur, colonne de libellés collée.

Corriger les modules CSS concernés au fur et à mesure.

- [ ] **Step 2: Vérifier `prefers-reduced-motion` sur les six pages**

DevTools → Rendering → *Emulate CSS media feature prefers-reduced-motion: reduce*, puis recharger chaque route. Pour chacune :

1. **Tout le contenu est visible.** Aucun élément ne reste à `opacity: 0` — c'est le bug le plus grave possible de ce runtime.
2. Aucune animation ne joue : ni reveal, ni mot-par-mot, ni beams, ni barre de progression, ni spotlight.

- [ ] **Step 3: Vérifier l'ensemble de la chaîne**

Depuis la racine du monorepo :

```bash
bun run check-types && bun run lint && bun run verify:ds && bun run test && bun run build
```

Attendu : les cinq au vert sur tout le monorepo, `apps/web` incluse.

- [ ] **Step 4: Commit**

```bash
git add apps/web
git commit -m "fix(web): passe responsive et reduced-motion sur les six pages"
```

---

## Ce que ce plan ne fait pas

- **Aucune authentification, aucune base de données, aucun appel réseau.** Sign up est une UI. Le branchement appartient au sous-projet C.
- **Les chiffres publiés ne sont pas validés.** `content/pricing.ts`, `content/benchmarks.ts` et `content/releases.ts` portent un en-tête `UNVERIFIED`. Le site est démontrable mais **ne doit pas être déployé publiquement** avant confirmation. Seul `content/metrics.ts` est fondé sur une source vérifiée.
- **`content/metrics.ts` sera partagé avec le sous-projet B.** Il vit pour l'instant dans `apps/web` ; le déplacer dans un package commun quand le dashboard en aura besoin, plutôt que de le dupliquer.
- **`apps/sightline-cloud` est un dépôt git imbriqué non déclaré comme sous-module.** Ce plan n'y touche pas, mais il faudra trancher avant le sous-projet C.
