# Sightline Design System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Porter les 9 fichiers de tokens et les 37 composants du design system Sightline dans `packages/ui`, consommables par les apps Next du monorepo.

**Architecture:** Le package exporte du TSX source (pas de build) ; les apps l'ajoutent à `transpilePackages`. Les tokens sont copiés verbatim depuis le handoff et restent la seule source de vérité des valeurs. Chaque composant est un dossier `Nom/` avec `Nom.tsx` + `Nom.module.css` : les styles inline de la source deviennent des règles CSS, et les états `hover`/`focus` gérés en `useState` deviennent de vrais `:hover` / `:focus-visible`.

**Tech Stack:** TypeScript 5, React 19.2.8, Next 16.3.2 (App Router), Tailwind CSS v4, `lucide-react` ^0.469.0, bun 1.3.11, Turborepo 2.

**Spec:** `docs/superpowers/specs/2026-08-29-sightline-design-system-design.md`

**Source du port :** `~/Downloads/design_handoff_sightline/designs/_ds/sightline-design-system-ae3b1246-552c-4bc3-a902-433b694a7230/`
Dans ce plan, ce chemin est noté `$DS`. Le bundle `$DS/_ds_bundle.js` est du JSX compilé Babel classic, lisible. L'annexe A de la spec donne le numéro de ligne de chacun des 37 composants.

```bash
# À exporter dans chaque session de travail sur ce plan :
export DS=~/Downloads/design_handoff_sightline/designs/_ds/sightline-design-system-ae3b1246-552c-4bc3-a902-433b694a7230
```

## Global Constraints

Ces règles s'appliquent à **toutes** les tâches. Chacune est vérifiée automatiquement par `bun run verify:ds` (Task 2).

- **Aucune couleur en dur.** Pas de `#rrggbb`, pas de `rgb(`, pas de `rgba(` dans `packages/ui/src/components/**`. Tout passe par `var(--*)`. Les seuls fichiers autorisés à contenir des hex sont `packages/ui/src/tokens/*.css`.
- **Aucune valeur de token retranscrite.** Les tailles, rayons, ombres, durées et graisses passent par leur variable (`var(--fs-13)`, `var(--radius-lg)`, `var(--shadow-sm)`, `var(--dur-1)`, `var(--fw-medium)`). Les valeurs en px qui ne correspondent à aucun token (`padding: '9px 16px'`, `padding: '14px var(--space-7)'`) sont recopiées telles quelles — elles sont dans la source sous cette forme.
- **`'use client'` sur `EventList` uniquement.** Les 36 autres composants sont des Server Components. Un `'use client'` ailleurs doit être justifié en commentaire dans le code.
- **Signatures identiques à la source.** Mêmes noms de props, mêmes valeurs par défaut que le relevé de la §6 de la spec. Seule exception autorisée sur les 37 : `Icon` perd sa prop `base` et le global `window.SIGHTLINE_ICON_BASE`.
- **La prop `style` est conservée sur tous les composants** et s'applique en dernier, après les styles calculés.
- **Aucune branche dark en JS.** Le thème est porté par la classe `.theme-dark` qui re-pointe les alias CSS. Un composant qui teste le thème est un bug de port.
- **Pas de `dangerouslySetInnerHTML`.**
- **Zéro monospace.** Aucune `font-family` monospace nulle part. Les chiffres utilisent la classe `.sl-num` de `base.css`.
- **Nommage des classes CSS Modules :** camelCase, aligné sur la valeur de la prop (`.primary`, `.accentQuiet`, `.md`) pour permettre `s[variant]` et `s[size]`.

---

## File Structure

```
packages/ui/
  package.json                    modifié   exports, deps, lucide-react
  tsconfig.json                   modifié   jsx: react-jsx, paths
  src/
    tokens/*.css              (9) créés     copiés verbatim depuis $DS/tokens/
    styles.css                    créé      @import des 9 + @theme Tailwind v4
    lib/cn.ts                     créé      cn(...classes) => string
    lib/icons.ts                  créé      map nom kebab lucide-static -> composant lucide-react
    components/<cat>/<Nom>/
      <Nom>.tsx                   créés (37)
      <Nom>.module.css            créés (37, sauf Icon)
      index.ts                    créés (37)
    index.ts                      créé      barrel
  scripts/verify-ds.mjs           créé      les garde-fous des Global Constraints

apps/dashboard/
  next.config.ts                  modifié   transpilePackages
  package.json                    modifié   dépendance @lumyx/ui
  app/layout.tsx                  modifié   Geist next/font -> --font-sans
  app/globals.css                 modifié   import de @lumyx/ui/styles.css
  app/_ds/page.tsx                créé      la galerie, enrichie à chaque tâche
  app/_ds/sections/<cat>.tsx      créés (6) une section par catégorie

package.json (racine)             modifié   script verify:ds
turbo.json                        modifié   tâche verify:ds
```

Un composant = un dossier. `ToastStack` vit dans le dossier `Toast/`, `GridItem` dans `DashboardGrid/` — comme dans la source. Les sous-composants non exportés (`Bar` de `LoadingSkeleton`, `Row` de `Sidebar`, `Tab` de `Tabs`) restent internes à leur fichier.

---

## Task 1 : Squelette du package, tokens, et preuve que les CSS Modules passent

C'est le risque identifié en §9 de la spec : Next a historiquement restreint l'import de CSS depuis `node_modules`. On le lève **avant** d'écrire 37 composants.

**Files:**

- Create: `packages/ui/src/tokens/{fonts,palette,semantic,typography,spacing,radius,elevation,motion,base}.css`
- Create: `packages/ui/src/styles.css`
- Create: `packages/ui/src/lib/cn.ts`
- Create: `packages/ui/src/components/_probe/Probe.tsx`, `Probe.module.css`, `index.ts`
- Create: `packages/ui/src/index.ts`
- Create: `apps/dashboard/app/_ds/page.tsx`
- Modify: `packages/ui/package.json`, `packages/ui/tsconfig.json`
- Modify: `apps/dashboard/package.json`, `apps/dashboard/next.config.ts`, `apps/dashboard/app/layout.tsx`, `apps/dashboard/app/globals.css`

**Interfaces:**

- Consumes: rien (première tâche)
- Produces: `cn(...args: (string | false | null | undefined)[]): string` · l'import `@lumyx/ui/styles.css` · le pattern `<Nom>/<Nom>.tsx` + `<Nom>.module.css` + `index.ts` · la route `/_ds`

- [ ] **Step 1 : Copier les 9 fichiers de tokens verbatim**

```bash
export DS=~/Downloads/design_handoff_sightline/designs/_ds/sightline-design-system-ae3b1246-552c-4bc3-a902-433b694a7230
mkdir -p packages/ui/src/tokens packages/ui/src/lib packages/ui/src/components
cp "$DS"/tokens/*.css packages/ui/src/tokens/
ls packages/ui/src/tokens/
# attendu : base.css elevation.css fonts.css motion.css palette.css radius.css semantic.css spacing.css typography.css
```

- [ ] **Step 2 : Éditer `fonts.css` — le seul fichier de tokens modifié**

Geist arrive par `next/font` côté app, pas par Google Fonts. Remplacer tout le contenu de `packages/ui/src/tokens/fonts.css` par :

```css
/* One family, no monospace. Geist is provided by next/font in each app, which exposes it as
   --font-geist; this file only wires that variable into the design system's own token. */
:root{
  --font-sans:var(--font-geist),'Geist','Geist Fallback',system-ui,-apple-system,'Segoe UI',sans-serif;
}
```

- [ ] **Step 3 : Écrire `packages/ui/src/styles.css`**

```css
@import url("./tokens/fonts.css");
@import url("./tokens/palette.css");
@import url("./tokens/semantic.css");
@import url("./tokens/typography.css");
@import url("./tokens/spacing.css");
@import url("./tokens/radius.css");
@import url("./tokens/elevation.css");
@import url("./tokens/motion.css");
@import url("./tokens/base.css");

/* Pont Tailwind v4 : référence les tokens, ne les redéfinit pas. Si les deux divergent,
   tokens/ gagne. Sert la mise en page au niveau des apps, pas les composants. */
@theme {
  --color-surface-page: var(--surface-page);
  --color-surface-card: var(--surface-card);
  --color-surface-sunken: var(--surface-sunken);
  --color-surface-inset: var(--surface-inset);
  --color-border: var(--border);
  --color-border-strong: var(--border-strong);
  --color-border-subtle: var(--border-subtle);
  --color-text-strong: var(--text-strong);
  --color-text-body: var(--text-body);
  --color-text-muted: var(--text-muted);
  --color-text-faint: var(--text-faint);
  --color-accent: var(--accent);
  --color-accent-hover: var(--accent-hover);
  --color-accent-tint: var(--accent-tint);
  --color-accent-text: var(--accent-text);
  --color-ok: var(--ok);
  --color-warn: var(--warn);
  --color-danger: var(--danger);
  --color-info: var(--info);
  --radius-xs: var(--radius-xs);
  --radius-sm: var(--radius-sm);
  --radius-md: var(--radius-md);
  --radius-lg: var(--radius-lg);
  --radius-xl: var(--radius-xl);
  --font-sans: var(--font-sans);
}
```

- [ ] **Step 4 : Écrire `packages/ui/src/lib/cn.ts`**

```ts
export type ClassValue = string | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}
```

- [ ] **Step 5 : Écrire la sonde — le test du risque**

`packages/ui/src/components/_probe/Probe.module.css` :

```css
.probe {
  display: inline-flex;
  align-items: center;
  padding: 9px 16px;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: var(--text-on-accent);
  font-family: var(--font-sans);
  font-size: var(--fs-13);
  font-weight: var(--fw-medium);
  transition: background var(--dur-1) var(--ease-out);
}

.probe:hover {
  background: var(--accent-hover);
}
```

`packages/ui/src/components/_probe/Probe.tsx` :

```tsx
import s from './Probe.module.css';

export function Probe() {
  return <span className={s.probe}>CSS Modules OK</span>;
}
```

`packages/ui/src/components/_probe/index.ts` :

```ts
export { Probe } from './Probe';
```

`packages/ui/src/index.ts` :

```ts
export { cn } from './lib/cn';
export type { ClassValue } from './lib/cn';
export * from './components/_probe';
```

- [ ] **Step 6 : Configurer `packages/ui/package.json`**

```json
{
  "name": "@lumyx/ui",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./styles.css": "./src/styles.css"
  },
  "dependencies": {
    "lucide-react": "^0.469.0"
  },
  "peerDependencies": {
    "react": "^19",
    "react-dom": "^19"
  },
  "devDependencies": {
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "typescript": "^5"
  }
}
```

`packages/ui/tsconfig.json` :

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  },
  "include": ["src"]
}
```

- [ ] **Step 7 : Brancher `apps/dashboard`**

Ajouter la dépendance dans `apps/dashboard/package.json` :

```json
"@lumyx/ui": "workspace:*"
```

`apps/dashboard/next.config.ts` :

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@lumyx/ui'],
};

export default nextConfig;
```

Dans `apps/dashboard/app/globals.css`, en tout premier :

```css
@import '@lumyx/ui/styles.css';
```

Dans `apps/dashboard/app/layout.tsx`, exposer Geist sur `--font-geist` (c'est la variable que `fonts.css` consomme) :

```tsx
import { Geist } from 'next/font/google';

const geist = Geist({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-geist',
});

// puis sur <html> :  className={geist.variable}
```

- [ ] **Step 8 : Écrire la galerie minimale `apps/dashboard/app/_ds/page.tsx`**

```tsx
import { Probe } from '@lumyx/ui';

export default function DesignSystemPage() {
  return (
    <main style={{ padding: 'var(--space-9)', display: 'grid', gap: 'var(--space-9)' }}>
      <h1 style={{ fontSize: 'var(--fs-26)', letterSpacing: 'var(--ls-display)' }}>
        Sightline design system
      </h1>
      <section style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">Probe</span>
        <div><Probe /></div>
      </section>
    </main>
  );
}
```

- [ ] **Step 9 : Installer et lancer**

```bash
bun install
bun run --filter @sightline/dashboard dev
```

Ouvrir `http://localhost:3000/_ds`.

**Attendu :** la sonde s'affiche avec un fond indigo `#4f39f6`, du texte blanc, un rayon de 12px, en Geist ; au survol le fond fonce vers `#3d24d9`. La police du reste de la page est Geist, le fond de page est `#f5f6f8`.

**Si la sonde est non stylée** (texte nu, fond transparent) : les CSS Modules ne traversent pas `transpilePackages`. Appliquer le repli de la spec §9 — supprimer les `.module.css`, écrire un fichier global unique `packages/ui/src/components.css` ajouté aux `@import` de `styles.css`, et préfixer toutes les classes `sl-` (`.sl-btn`, `.sl-btn-primary`). Le reste du plan est inchangé : seule la façon dont `<Nom>.tsx` obtient ses noms de classes change (`'sl-btn'` en littéral au lieu de `s.btn`). **Noter la décision en tête du plan avant de continuer.**

- [ ] **Step 10 : Vérifier les types et le build**

```bash
bun run check-types
bun run --filter @sightline/dashboard build
```

Attendu : les deux passent.

- [ ] **Step 11 : Commit**

```bash
git add packages/ui apps/dashboard package.json bun.lock
git commit -m "feat(ui): squelette du package, tokens du design system, integration dashboard"
```

---

## Task 2 : Les garde-fous automatisés

Les Global Constraints ne servent à rien si rien ne les vérifie. Cette tâche les rend exécutables, avant qu'il y ait 37 composants où chercher les écarts à la main.

**Files:**

- Create: `packages/ui/scripts/verify-ds.mjs`
- Modify: `packages/ui/package.json` (script `verify:ds`), `package.json` racine, `turbo.json`

**Interfaces:**

- Consumes: l'arborescence `packages/ui/src/` de la Task 1
- Produces: `bun run verify:ds` — sort en code 1 avec un rapport lisible dès qu'une contrainte est violée

- [ ] **Step 1 : Écrire le script de vérification**

`packages/ui/scripts/verify-ds.mjs` :

```js
#!/usr/bin/env node
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');
const COMPONENTS = join(SRC, 'components');
const TOKENS = join(SRC, 'tokens');
const DS = process.env.DS;

const failures = [];
const fail = (rule, detail) => failures.push(`[${rule}] ${detail}`);

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = walk(COMPONENTS);
const rel = (p) => p.slice(ROOT.length);

// 1. Aucune couleur en dur hors tokens/
const HEX = /#[0-9a-fA-F]{3,8}\b/;
const RGB = /\brgba?\(/;
for (const f of files) {
  const body = readFileSync(f, 'utf8');
  body.split('\n').forEach((line, i) => {
    if (HEX.test(line) || RGB.test(line)) {
      fail('no-hardcoded-color', `${rel(f)}:${i + 1} — ${line.trim()}`);
    }
  });
}

// 2. 'use client' sur EventList uniquement
for (const f of files.filter((f) => extname(f) === '.tsx')) {
  const body = readFileSync(f, 'utf8');
  const isClient = /^\s*['"]use client['"]/m.test(body);
  const isEventList = basename(f) === 'EventList.tsx';
  if (isClient && !isEventList) {
    fail('use-client', `${rel(f)} porte 'use client' — seul EventList y a droit`);
  }
}

// 3. Zéro monospace
for (const f of files) {
  const body = readFileSync(f, 'utf8');
  if (/monospace|ui-monospace|'SF Mono'|Menlo|Consolas/i.test(body)) {
    fail('no-monospace', `${rel(f)} contient une font monospace`);
  }
}

// 4. Pas de dangerouslySetInnerHTML
for (const f of files) {
  if (readFileSync(f, 'utf8').includes('dangerouslySetInnerHTML')) {
    fail('no-dangerous-html', rel(f));
  }
}

// 5. Les tokens sont identiques au handoff (fonts.css excepté, cf. spec §4)
if (DS) {
  for (const name of readdirSync(TOKENS)) {
    if (name === 'fonts.css') continue;
    const mine = readFileSync(join(TOKENS, name), 'utf8');
    const theirs = readFileSync(join(DS, 'tokens', name), 'utf8');
    if (mine !== theirs) fail('tokens-verbatim', `tokens/${name} diverge du handoff`);
  }
} else {
  console.log('· $DS non defini — verification tokens-verbatim sautee');
}

if (failures.length) {
  console.error(`\n✗ ${failures.length} violation(s) des contraintes du design system\n`);
  failures.forEach((f) => console.error('  ' + f));
  process.exit(1);
}
console.log('✓ contraintes du design system respectees');
```

- [ ] **Step 2 : Câbler le script**

Dans `packages/ui/package.json`, ajouter aux `scripts` :

```json
"verify:ds": "node scripts/verify-ds.mjs"
```

Dans `turbo.json`, ajouter à `tasks` :

```json
"verify:ds": { "dependsOn": [] }
```

Dans le `package.json` racine, ajouter aux `scripts` :

```json
"verify:ds": "turbo run verify:ds"
```

- [ ] **Step 3 : Vérifier que le script détecte bien une violation**

Introduire volontairement une faute dans la sonde :

```bash
# ajouter temporairement une couleur en dur
printf '\n.broken { color: #ff0000; }\n' >> packages/ui/src/components/_probe/Probe.module.css
DS=$DS bun run verify:ds
```

Attendu : **échec**, code de sortie 1, avec la ligne `[no-hardcoded-color] src/components/_probe/Probe.module.css:… — .broken { color: #ff0000; }`.

- [ ] **Step 4 : Retirer la faute et vérifier que ça passe**

```bash
git checkout packages/ui/src/components/_probe/Probe.module.css
DS=$DS bun run verify:ds
```

Attendu : `✓ contraintes du design system respectees`, code de sortie 0.

- [ ] **Step 5 : Commit**

```bash
git add packages/ui/scripts packages/ui/package.json package.json turbo.json
git commit -m "chore(ui): garde-fous automatises des contraintes du design system"
```

---

## Task 3 : `cn`, la résolution d'icônes, et le composant `Icon`

`Icon` est consommé par une grande partie des 34 composants restants. Il passe en premier.

**Files:**

- Create: `packages/ui/src/lib/icons.ts`
- Create: `packages/ui/src/components/core/Icon/{Icon.tsx,index.ts}`
- Modify: `packages/ui/src/index.ts`
- Modify: `apps/dashboard/app/_ds/page.tsx`

**Interfaces:**

- Consumes: `cn` (Task 1)
- Produces:
  - `type IconName` — union des 29 noms kebab-case
  - `Icon({ name, size?, strokeWidth?, style?, ...rest })` — `name: IconName`, `size = 16`, `strokeWidth = 1.75`

**Source :** `$DS/_ds_bundle.js:271-320`. La source résout un nom vers `https://unpkg.com/lucide-static@0.469.0/icons/<name>.svg` et l'injecte via `dangerouslySetInnerHTML`. Le port garde l'API et remplace la résolution par un import statique de `lucide-react`.

- [ ] **Step 1 : Écrire `packages/ui/src/lib/icons.ts`**

Les 29 noms sont ceux réellement employés par les maquettes et les écrans du bundle (relevés par balayage de `designs/*.dc.html` et `_ds_bundle.js`).

```ts
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
```

- [ ] **Step 2 : Écrire `Icon.tsx`**

Pas de `.module.css` : les styles d'`Icon` dépendent de la prop `size`, ils sont calculés.

```tsx
import type { CSSProperties, SVGProps } from 'react';
import { ICONS, type IconName } from '../../../lib/icons';

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name' | 'ref'> {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  style?: CSSProperties;
}

/**
 * Lucide, à stroke-width 1.75 — plus lourd que le défaut de 2 de la librairie ne le rendrait à
 * 14px. La source allait chercher le SVG sur unpkg ; ici lucide-react le fournit à la compilation.
 */
export function Icon({ name, size = 16, strokeWidth = 1.75, style, ...rest }: IconProps) {
  const Glyph = ICONS[name];
  return (
    <Glyph
      aria-label={name}
      role="img"
      width={size}
      height={size}
      strokeWidth={strokeWidth}
      style={{ flex: '0 0 auto', color: 'currentColor', ...style }}
      {...rest}
    />
  );
}
```

`packages/ui/src/components/core/Icon/index.ts` :

```ts
export { Icon } from './Icon';
export type { IconProps } from './Icon';
```

- [ ] **Step 3 : Exporter depuis le barrel**

`packages/ui/src/index.ts` :

```ts
export { cn } from './lib/cn';
export type { ClassValue } from './lib/cn';
export { ICONS } from './lib/icons';
export type { IconName } from './lib/icons';

export * from './components/core/Icon';
export * from './components/_probe';
```

- [ ] **Step 4 : Ajouter la section Icônes à la galerie**

Dans `apps/dashboard/app/_ds/page.tsx`, ajouter :

```tsx
import { Icon, ICONS, type IconName } from '@lumyx/ui';

// dans le <main> :
<section style={{ display: 'grid', gap: 'var(--space-5)' }}>
  <span className="sl-label">Icons — 16px, stroke 1.75</span>
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-6)', color: 'var(--text-body)' }}>
    {(Object.keys(ICONS) as IconName[]).map((name) => (
      <span key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: 'var(--fs-12)', color: 'var(--text-muted)' }}>
        <Icon name={name} />
        {name}
      </span>
    ))}
  </div>
</section>
```

- [ ] **Step 5 : Vérifier**

```bash
bun run check-types && DS=$DS bun run verify:ds
bun run --filter @sightline/dashboard dev
```

Sur `/_ds` : les 29 glyphes s'affichent à 16px, alignés avec leur nom, sans flash au chargement (plus de fetch réseau — vérifier dans l'onglet Réseau des devtools qu'aucune requête ne part vers `unpkg.com`).

- [ ] **Step 6 : Commit**

```bash
git add packages/ui/src apps/dashboard/app/_ds
git commit -m "feat(ui): composant Icon adosse a lucide-react"
```

---

## Task 4 : `core` — les 8 composants restants

**Files:**

- Create: `packages/ui/src/components/core/{Badge,Button,Card,IconButton,Input,Pill,Select,StatusDot}/` (`.tsx`, `.module.css`, `index.ts`)
- Modify: `packages/ui/src/index.ts`
- Create: `apps/dashboard/app/_ds/sections/core.tsx`
- Modify: `apps/dashboard/app/_ds/page.tsx`

**Interfaces:**

- Consumes: `cn` (Task 1), `Icon` / `IconName` (Task 3)
- Produces (signatures exactes, cf. spec §6) :
  - `Badge({ children, tone = 'neutral', uppercase = false, solid = false, style })` — `tone: 'neutral' | 'accent' | 'secondary' | 'ok' | 'warn' | 'danger' | 'info'`
  - `Button({ children, variant = 'secondary', size = 'md', disabled = false, block = false, icon = null, trailing = null, type = 'button', onClick, style, ...rest })` — `variant: 'primary' | 'secondary' | 'quiet' | 'danger' | 'accentQuiet'`, `size: 'sm' | 'md' | 'lg'`
  - `Card({ title, meta, actions, children, padded = true, footer, style, bodyStyle, headerStyle })`
  - `IconButton({ children, label, size = 32, active = false, disabled = false, tone = 'default', onClick, style, ...rest })`
  - `Input({ label, hint, error, prefix, suffix, size = 'md', style, wrapperStyle, ...rest })`
  - `Pill({ children, status, count, tone = 'neutral', style })`
  - `Select({ label, options = [], value, onChange, size = 'md', style, wrapperStyle, ...rest })`
  - `StatusDot({ status = 'idle', size = 8, halo = true, style })`

**Sources :** Badge `:22`, Button `:76` (+ `SIZES` `:56`), Card `:187`, IconButton `:322`, Input `:369`, Select `:442`, StatusDot `:531`, Pill `:559`.

- [ ] **Step 1 : Porter `Button` — l'exemple canonique**

C'est le composant qui exerce toute la convention : variants, tailles, hover, focus, disabled. Les sept autres suivent le même moule.

`packages/ui/src/components/core/Button/Button.module.css` :

```css
.btn {
  font-family: var(--font-sans);
  font-weight: var(--fw-medium);
  letter-spacing: var(--ls-normal);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  cursor: pointer;
  outline: none;
  transition:
    background var(--dur-1) var(--ease-out),
    border-color var(--dur-1) var(--ease-out),
    box-shadow var(--dur-1) var(--ease-out);
}

.btn:disabled { cursor: not-allowed; opacity: .45; }
.block { width: 100%; }

/* Tailles — source :56 */
.sm { font-size: var(--fs-12); padding: 6px 12px;  border-radius: var(--radius-sm); gap: var(--space-3); }
.md { font-size: var(--fs-13); padding: 9px 16px;  border-radius: var(--radius-sm); gap: var(--space-4); }
.lg { font-size: var(--fs-14); padding: 12px 20px; border-radius: var(--radius-md); gap: var(--space-4); }

/* Variants — source :91 */
.primary {
  background: var(--accent);
  border: 1px solid var(--accent);
  color: var(--text-on-accent);
  font-weight: var(--fw-medium);
  box-shadow: var(--shadow-xs);
}
.primary:hover:not(:disabled) { background: var(--accent-hover); border-color: var(--accent-hover); }

.secondary {
  background: var(--surface-card);
  border: 1px solid var(--border);
  color: var(--text-strong);
  box-shadow: var(--shadow-xs);
}
.secondary:hover:not(:disabled) { background: var(--surface-hover); border-color: var(--border-strong); }

.quiet {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-muted);
}
.quiet:hover:not(:disabled) { background: var(--surface-hover); color: var(--text-strong); }

.danger {
  background: var(--surface-card);
  border: 1px solid var(--border);
  color: var(--danger);
  box-shadow: var(--shadow-xs);
}
.danger:hover:not(:disabled) { background: var(--danger-tint); border-color: var(--danger); }

.accentQuiet {
  background: var(--accent-tint);
  border: 1px solid var(--accent-border);
  color: var(--accent-text);
}
.accentQuiet:hover:not(:disabled) { background: var(--accent-border); }

/* Focus — :focus-visible, pas :focus : le ring est un affordance clavier (spec §2). */
.btn:focus-visible { box-shadow: var(--ring-accent); }
.danger:focus-visible { box-shadow: var(--ring-danger); }
```

`packages/ui/src/components/core/Button/Button.tsx` :

```tsx
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { cn } from '../../../lib/cn';
import s from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger' | 'accentQuiet';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  block?: boolean;
  icon?: ReactNode;
  trailing?: ReactNode;
  type?: 'button' | 'submit' | 'reset';
  style?: CSSProperties;
}

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  disabled = false,
  block = false,
  icon = null,
  trailing = null,
  type = 'button',
  onClick,
  style,
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(s.btn, s[size], s[variant], block && s.block, className)}
      style={style}
      {...rest}
    >
      {icon}
      {children}
      {trailing}
    </button>
  );
}
```

`packages/ui/src/components/core/Button/index.ts` :

```ts
export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';
```

Noter ce qui a disparu par rapport à la source : les deux `useState`, les quatre handlers `onMouseEnter`/`onMouseLeave`/`onFocus`/`onBlur`, l'objet `variants` reconstruit à chaque rendu, et le `'use client'` qu'ils auraient imposé.

- [ ] **Step 2 : Porter `Card`**

`Card` n'a aucun état — port direct. Source `:187`.

`packages/ui/src/components/core/Card/Card.module.css` :

```css
.card {
  background: var(--surface-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-5);
  padding: 14px var(--space-7);
  flex: 0 0 auto;
}

.titleGroup { display: inline-flex; align-items: baseline; gap: var(--space-4); min-width: 0; }
.title { font-size: var(--fs-14); font-weight: var(--fw-semibold); color: var(--text-strong); }
.meta  { font-size: var(--fs-12); color: var(--text-muted); }
.actions { display: inline-flex; align-items: center; gap: var(--space-4); }

.body { flex: 1; min-height: 0; }
.bodyPadded { padding: 0 var(--space-7) var(--space-7); }

.footer {
  border-top: 1px solid var(--border-subtle);
  padding: 12px var(--space-7);
  font-size: var(--fs-12);
  color: var(--text-muted);
}
```

```tsx
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../../lib/cn';
import s from './Card.module.css';

export interface CardProps {
  title?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  padded?: boolean;
  footer?: ReactNode;
  style?: CSSProperties;
  bodyStyle?: CSSProperties;
  headerStyle?: CSSProperties;
}

export function Card({
  title, meta, actions, children, padded = true, footer, style, bodyStyle, headerStyle,
}: CardProps) {
  return (
    <section className={s.card} style={style}>
      {(title || actions) && (
        <header className={s.header} style={headerStyle}>
          <span className={s.titleGroup}>
            <h3 className={s.title}>{title}</h3>
            {meta && <span className={s.meta}>{meta}</span>}
          </span>
          {actions && <span className={s.actions}>{actions}</span>}
        </header>
      )}
      <div className={cn(s.body, padded && s.bodyPadded)} style={bodyStyle}>
        {children}
      </div>
      {footer && <div className={s.footer}>{footer}</div>}
    </section>
  );
}
```

- [ ] **Step 3 : Porter `Badge`, `Pill`, `StatusDot`**

Aucun n'a d'état. Appliquer le moule de `Card` pour la structure et celui de `Button` pour la table de tons.

`Badge` (source `:12` pour la table `TONES`, `:22` pour le composant) — les 7 tons sont des triplets `[fond, bordure, texte]` :

| tone | background | border-color | color |
| --- | --- | --- | --- |
| `neutral` | `var(--surface-inset)` | `var(--border)` | `var(--text-body)` |
| `accent` | `var(--accent-tint)` | `var(--accent-border)` | `var(--accent-text)` |
| `secondary` | `var(--accent-2-tint)` | `transparent` | `var(--accent-2)` |
| `ok` | `var(--ok-tint)` | `transparent` | `var(--ok)` |
| `warn` | `var(--warn-tint)` | `transparent` | `var(--warn)` |
| `danger` | `var(--danger-tint)` | `transparent` | `var(--danger)` |
| `info` | `var(--info-tint)` | `transparent` | `var(--info)` |

Les props `uppercase` et `solid` sont deux classes modificatrices supplémentaires — relire `:22-54` pour leurs effets exacts.

`StatusDot` (source `:531`) : `size` est une prop numérique, donc `width`/`height`/`borderRadius` restent en style inline ; `status` et `halo` deviennent des classes.

`Pill` (source `:559`) : même traitement que `Badge` pour `tone`, plus les slots `status` et `count`.

- [ ] **Step 4 : Porter `IconButton`, `Input`, `Select`**

Les trois ont un `useState` dans la source, uniquement pour `hover` (`IconButton` `:334`) ou `focus` (`Input` `:369`, `Select` `:442`). Les trois deviennent des Server Components.

- `IconButton` (`:322`) : `size` est numérique → `width`/`height` inline ; `tone` et `active` → classes ; `:hover:not(:disabled)` et `:focus-visible`.
- `Input` (`:369`) : le `useState(focus)` pilotait la bordure et le ring → `.field:focus-visible`. La prop `error` est une classe qui écrase la couleur de bordure. Les slots `prefix`/`suffix` sont des enfants positionnés.
- `Select` (`:442`) : même schéma, avec le chevron. Vérifier dans la source si le chevron est un `Icon name="chevron-down"` ou un SVG inline, et reproduire.

**Important :** `Input` et `Select` transmettent `onChange` sans le consommer — ils n'ont donc pas besoin de `'use client'`. C'est l'appelant, côté app, qui sera le Client Component.

- [ ] **Step 5 : Exporter les 8 depuis le barrel**

```ts
export * from './components/core/Badge';
export * from './components/core/Button';
export * from './components/core/Card';
export * from './components/core/Icon';
export * from './components/core/IconButton';
export * from './components/core/Input';
export * from './components/core/Pill';
export * from './components/core/Select';
export * from './components/core/StatusDot';
```

- [ ] **Step 6 : Écrire la section `core` de la galerie**

`apps/dashboard/app/_ds/sections/core.tsx` — rendre **toutes** les variantes, pas un échantillon :

```tsx
import { Badge, Button, Card, IconButton, Input, Pill, Select, StatusDot, Icon } from '@lumyx/ui';

const VARIANTS = ['primary', 'secondary', 'quiet', 'danger', 'accentQuiet'] as const;
const SIZES = ['sm', 'md', 'lg'] as const;
const TONES = ['neutral', 'accent', 'secondary', 'ok', 'warn', 'danger', 'info'] as const;
const STATUSES = ['live', 'degraded', 'idle', 'error'] as const;

export function CoreSection() {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-8)' }}>
      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">Button — 5 variants x 3 tailles, + disabled et block</span>
        {SIZES.map((size) => (
          <div key={size} style={{ display: 'flex', gap: 'var(--space-5)', alignItems: 'center', flexWrap: 'wrap' }}>
            {VARIANTS.map((variant) => (
              <Button key={variant} variant={variant} size={size}>{variant}</Button>
            ))}
            <Button variant="primary" size={size} disabled>disabled</Button>
            <Button variant="secondary" size={size} icon={<Icon name="download" />}>with icon</Button>
          </div>
        ))}
        <div style={{ maxWidth: 320 }}><Button variant="primary" block>block</Button></div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">Badge — 7 tons, + uppercase et solid</span>
        <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          {TONES.map((tone) => <Badge key={tone} tone={tone}>{tone}</Badge>)}
          {TONES.map((tone) => <Badge key={`u-${tone}`} tone={tone} uppercase>{tone}</Badge>)}
          {TONES.map((tone) => <Badge key={`s-${tone}`} tone={tone} solid>{tone}</Badge>)}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">StatusDot — 4 statuts, halo on/off</span>
        <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'center' }}>
          {STATUSES.map((status) => <StatusDot key={status} status={status} />)}
          {STATUSES.map((status) => <StatusDot key={`n-${status}`} status={status} halo={false} />)}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">Pill — 7 tons, avec count et status</span>
        <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          {TONES.map((tone) => <Pill key={tone} tone={tone} count={4}>{tone}</Pill>)}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <span className="sl-label">IconButton — 3 tons, actif, desactive</span>
        <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
          <IconButton label="Refresh"><Icon name="refresh-cw" /></IconButton>
          <IconButton label="Settings" active><Icon name="settings" /></IconButton>
          <IconButton label="Close" disabled><Icon name="x" /></IconButton>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)', maxWidth: 420 }}>
        <span className="sl-label">Input & Select — 3 tailles, hint, erreur</span>
        <Input label="Room id" placeholder="test-room" hint="Lowercase, no spaces." />
        <Input label="Threshold" defaultValue="2" suffix="%" size="sm" />
        <Input label="Region" defaultValue="eu-west-3" error="Unknown region." />
        <Select label="Retention" defaultValue="7d" options={[
          { value: '24h', label: '24 hours' },
          { value: '7d', label: '7 days' },
          { value: '30d', label: '30 days' },
        ]} />
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)', maxWidth: 520 }}>
        <span className="sl-label">Card — avec meta, actions, footer, et non padded</span>
        <Card title="Room detail" meta="test-room" actions={<Button size="sm" variant="quiet">Open</Button>} footer="Updated 12s ago">
          <p style={{ margin: 0, color: 'var(--text-body)', fontSize: 'var(--fs-13)' }}>
            Card body content.
          </p>
        </Card>
      </div>
    </div>
  );
}
```

Monter `<CoreSection />` dans `apps/dashboard/app/_ds/page.tsx`.

- [ ] **Step 7 : Vérifier**

```bash
bun run check-types && DS=$DS bun run verify:ds && bun run --filter @sightline/dashboard build
bun run --filter @sightline/dashboard dev
```

Sur `/_ds`, contrôler point par point contre la maquette (ouvrir `$DS/../Dashboard UI.dc.html` dans un navigateur à côté) :

- Le `Button` `primary` est indigo plein, ombre `xs` ; au survol il fonce, la bordure suit.
- **Au clic à la souris, aucun ring n'apparaît. Au `Tab` clavier, le ring 3px apparaît.** C'est la correction volontaire de la source — le vérifier explicitement.
- Le `Button` `danger` a un ring rouge au focus clavier, pas indigo.
- `disabled` : opacité .45, curseur `not-allowed`, **aucun effet au survol**.
- Les 7 tons de `Badge` : `secondary` est corail, `accent` indigo, les 4 sémantiques ont une bordure transparente.

- [ ] **Step 8 : Commit**

```bash
git add packages/ui/src apps/dashboard/app/_ds
git commit -m "feat(ui): 9 composants core (Badge Button Card Icon IconButton Input Pill Select StatusDot)"
```

---

## Task 5 : `layout` — 5 composants

**Files:**

- Create: `packages/ui/src/components/layout/{AppShell,DashboardGrid,SplitPane,StatusStrip}/` (`GridItem` vit dans `DashboardGrid/`)
- Modify: `packages/ui/src/index.ts`
- Create: `apps/dashboard/app/_ds/sections/layout.tsx`

**Interfaces:**

- Consumes: `cn` (Task 1)
- Produces:
  - `AppShell({ sidebar, toolbar, footer, children, maxWidth, theme, style })`
  - `DashboardGrid({ children, columns = 12, gap = 'var(--gap-grid)', minColumn = 280, auto = false, style })`
  - `GridItem({ children, span = 12, rowSpan, style })`
  - `SplitPane({ left, right, railWidth = 340, gap = 'var(--gap-grid)', reverse = false, style })`
  - `StatusStrip({ left, items = [], style })`

**Sources :** AppShell `:1769`, DashboardGrid `:1817`, GridItem `:1836`, SplitPane `:1859`, StatusStrip `:1898`.

- [ ] **Step 1 : Porter les 5**

Aucun des cinq n'a de hook dans la source — port direct, même moule que `Card` (Task 4, Step 2).

Trois d'entre eux calculent leur géométrie à partir de props numériques : **ces valeurs restent en style inline**, c'est leur nature (règle 6 de la convention de port, spec §5).

- `DashboardGrid` : `gridTemplateColumns` dépend de `columns`, `minColumn` et `auto` → inline. Le mode `auto` produit `repeat(auto-fit, minmax(<minColumn>px, 1fr))`, le mode fixe `repeat(<columns>, 1fr)`. Relire `:1817-1835` pour la forme exacte.
- `GridItem` : `gridColumn: span <span>` et `gridRow` → inline.
- `SplitPane` : `gridTemplateColumns: 1fr <railWidth>px` (inversé si `reverse`) → inline. La valeur par défaut `340` correspond au token `--rail-w`.

`AppShell` porte la prop `theme` : quand elle vaut `'dark'`, elle **ajoute la classe `theme-dark`** sur son conteneur. C'est le seul endroit du système où le thème est décidé — et c'est une classe, pas une branche JS. `maxWidth` par défaut suit `--content-max` (1360px) ; vérifier `:1769-1816`.

`StatusStrip` prend `items: { label, value, tone? }[]` — les tons réutilisent les mêmes alias que `Badge`.

- [ ] **Step 2 : Écrire la section `layout` de la galerie**

`apps/dashboard/app/_ds/sections/layout.tsx` doit rendre :

- une `DashboardGrid` en mode fixe 12 colonnes avec des `GridItem` de spans variés (12, 6+6, 4+4+4, 8+4), chacun contenant une `Card` pour matérialiser la cellule ;
- la même en mode `auto` avec `minColumn={280}`, pour vérifier le `auto-fit` ;
- un `SplitPane` avec une `Card` à gauche et une `Card` à droite, `railWidth` par défaut puis `reverse` ;
- un `StatusStrip` avec les items de la maquette : `Rooms 4`, `Peers 65`, `Alerts 4` en ton `danger`, `Retention 7d`.

`AppShell` n'est pas rendu ici : il enveloppe une page entière. Il sera exercé par la page `/_ds` elle-même à la Task 11.

- [ ] **Step 3 : Vérifier**

```bash
bun run check-types && DS=$DS bun run verify:ds
```

Sur `/_ds` : les spans de `GridItem` tombent juste (un `span={6}` occupe exactement la moitié), le `SplitPane` a un rail de 340px, le `reverse` le passe à gauche.

- [ ] **Step 4 : Commit**

```bash
git add packages/ui/src apps/dashboard/app/_ds
git commit -m "feat(ui): 5 composants layout (AppShell DashboardGrid GridItem SplitPane StatusStrip)"
```

---

## Task 6 : `navigation` — 4 composants

**Files:**

- Create: `packages/ui/src/components/navigation/{Breadcrumb,Sidebar,Tabs,Toolbar}/`
- Modify: `packages/ui/src/index.ts`
- Create: `apps/dashboard/app/_ds/sections/navigation.tsx`

**Interfaces:**

- Consumes: `cn` (Task 1), `Icon` / `IconName` (Task 3), `Pill` et `StatusDot` (Task 4)
- Produces:
  - `Breadcrumb({ items = [], onSelect, style })` — `items: { id?: string; label: string }[]`
  - `Sidebar({ items = [], activeId, onSelect, brand = 'Sightline', brandMeta, footer, width = 248, style })` — `items: { id: string; label: string; icon?: IconName; count?: number; status?: 'live' | 'error' }[]`
  - `Tabs({ tabs = [], activeId, onSelect, variant = 'underline', style })` — `tabs: { id: string; label: string; count?: number }[]`
  - `Toolbar({ left, right, children, sticky = false, style })`

**Sources :** Breadcrumb `:1947`, Sidebar `:2004` (+ `Row` `:2071`), Tabs `:2130` (+ `Tab` `:2160`), Toolbar `:2204`.

- [ ] **Step 1 : Porter les 4**

`Sidebar` et `Tabs` ont chacun un `useState(hover)` dans la source, porté par leur sous-composant interne (`Row` `:2071`, `Tab` `:2160`). **Les deux disparaissent** : le hover devient `:hover` sur la règle de `Row` / `Tab`. Les sous-composants restent internes au fichier, non exportés.

L'état **sélectionné** est une prop (`activeId`), pas un état interne : il devient une classe. Le README du handoff le décrit précisément — « tint accent + inset 2px accent à gauche » — soit, pour la ligne active de `Sidebar` :

```css
.row[data-active='true'] {
  background: var(--accent-tint);
  color: var(--accent-text);
  box-shadow: inset 2px 0 0 var(--accent);
}
```

Les quatre transmettent `onSelect` sans le consommer → aucun `'use client'`.

`Sidebar` rend par défaut la marque : le mot « Sightline » en `--fw-semibold` / `--ls-display`, précédé d'un carré 20px `--radius-xs` en `--accent`. Reproduire tel quel — c'est la seule identité visuelle du produit tant qu'il n'y a pas de logo (spec §9).

`Tabs` a deux variants : `underline` (défaut) et le second à relever dans `:2130-2159`.

- [ ] **Step 2 : Écrire la section `navigation` de la galerie**

Reprendre les données réelles de la maquette (`Dashboard UI.dc.html:395-405`) pour que la comparaison visuelle soit directe :

```tsx
const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: 'layout-dashboard' },
  { id: 'rooms', label: 'Rooms', icon: 'radio-tower', count: 4 },
  { id: 'peers', label: 'Peers', icon: 'users', count: 65 },
  { id: 'alerts', label: 'Alerts', icon: 'bell', status: 'error' },
  { id: 'metrics', label: 'Metrics', icon: 'gauge' },
  { id: 'replay', label: 'Session replay', icon: 'circle-play' },
  { id: 'signaling', label: 'Signaling', icon: 'terminal' },
  { id: 'server', label: 'Server', icon: 'server', status: 'live' },
  { id: 'settings', label: 'Settings', icon: 'sliders-horizontal' },
] as const;
```

Rendre : la `Sidebar` avec `activeId="rooms"`, `brandMeta="sfu-eu-3 · eu-west-3"`, `footer="v0.4.1 · MIT licensed"` ; un `Breadcrumb` `[{ id: 'rooms', label: 'Rooms' }, { label: 'test-room' }]` ; les `Tabs` dans leurs deux variants avec `[{ id: 'peers', label: 'Peers', count: 6 }, { id: 'media', label: 'Media' }, { id: 'signaling', label: 'Signaling' }]` ; un `Toolbar` avec un `left` et un `right`.

- [ ] **Step 3 : Vérifier**

```bash
bun run check-types && DS=$DS bun run verify:ds
```

Sur `/_ds` : la `Sidebar` fait 248px, la ligne `Rooms` est teintée accent avec le liseré 2px à gauche, `Alerts` porte un point rouge et `Server` un point vert, les compteurs sont alignés à droite. **Aucun `'use client'` n'a été ajouté** — `verify:ds` le confirme.

- [ ] **Step 4 : Commit**

```bash
git add packages/ui/src apps/dashboard/app/_ds
git commit -m "feat(ui): 4 composants navigation (Breadcrumb Sidebar Tabs Toolbar)"
```

---

## Task 7 : `feedback` — 7 composants

**Files:**

- Create: `packages/ui/src/components/feedback/{AlertBanner,EmptyState,ErrorState,LoadingSkeleton,SeverityBadge,Toast}/` (`ToastStack` vit dans `Toast/`)
- Modify: `packages/ui/src/index.ts`
- Create: `apps/dashboard/app/_ds/sections/feedback.tsx`

**Interfaces:**

- Consumes: `cn` (Task 1), `Icon` (Task 3), `Button` et `Badge` (Task 4)
- Produces:
  - `AlertBanner({ severity = 'warning', title, message, meta, action, onDismiss, style })`
  - `EmptyState({ icon = 'radio-tower', title, hint, action, compact = false, style })`
  - `ErrorState({ title = 'Something failed', message, code, detail, action, style })`
  - `LoadingSkeleton({ variant = 'rows', rows = 4, columns = 4, style })`
  - `SeverityBadge({ severity = 'info', label, showIcon = true, style })`
  - `Toast({ severity = 'info', title, message, time, onDismiss, style })`
  - `ToastStack({ children, placement = 'bottom-right', style })`

**Sources :** AlertBanner `:1220`, EmptyState `:1302`, ErrorState `:1360`, `Bar` `:1433`, LoadingSkeleton `:1459`, SeverityBadge `:1595`, Toast `:1655`, ToastStack `:1733`.

- [ ] **Step 1 : Porter les 7**

Aucun hook dans la source pour les sept — port direct.

`LoadingSkeleton` s'appuie sur un sous-composant `Bar` (`:1433`) qui reste **interne au fichier, non exporté**. L'animation est `sl-shimmer`, déjà définie dans `motion.css` — ne pas la redéclarer. `variant` prend au moins `'rows'` ; relever les autres valeurs dans `:1459-1594`.

`ToastStack` positionne ses enfants selon `placement` (4 valeurs, à relever dans `:1733`). C'est du `position: fixed` : une classe par placement.

`onDismiss` est transmis, pas consommé → pas de `'use client'`.

- [ ] **Step 2 : Écrire la section `feedback` de la galerie**

Le contenu doit respecter le ton documenté par le handoff — c'est vérifiable à l'œil et ça évite de laisser du lorem ipsum s'installer :

```tsx
<AlertBanner
  severity="danger"
  title="Packet loss above threshold"
  message="Packet loss has been above 2% for 3m 12s. Force audio-only or renegotiate the session."
  meta="webinar-us · ap-south-1 · 14:06:41 · loss 7.90% vs 2%"
/>

<EmptyState
  icon="radio-tower"
  title="No active rooms"
  hint="Rooms appear here as soon as a peer joins."
/>

<ErrorState
  title="Metrics endpoint unreachable"
  code="ECONNREFUSED"
  detail="GET http://127.0.0.1:8080/metrics — connect ECONNREFUSED 127.0.0.1:8080"
/>
```

Rendre aussi : les 4 sévérités d'`AlertBanner` et de `SeverityBadge`, `EmptyState` en `compact`, les variants de `LoadingSkeleton`, et un `ToastStack` avec deux `Toast` de sévérités différentes.

**Règles de contenu à ne pas enfreindre** (handoff, section « Contenu des états vides / erreurs ») : pas de « Oops », pas de point d'exclamation, **aucun emoji**, les erreurs affichent le code et le message brut sans les paraphraser, les events sont en sentence case.

- [ ] **Step 3 : Vérifier**

```bash
bun run check-types && DS=$DS bun run verify:ds
```

Sur `/_ds` : les 4 sévérités se distinguent par leur tint et leur ink (le 600 en clair), le `ErrorState` montre bien `ECONNREFUSED` dans un bloc inset, le skeleton anime `sl-shimmer` sans scintiller.

- [ ] **Step 4 : Commit**

```bash
git add packages/ui/src apps/dashboard/app/_ds
git commit -m "feat(ui): 7 composants feedback (AlertBanner EmptyState ErrorState LoadingSkeleton SeverityBadge Toast ToastStack)"
```

---

## Task 8 : `data` — les 5 composants non-SVG

**Files:**

- Create: `packages/ui/src/components/data/{DataTable,EventList,MetricCard,MetricGrid,ProgressBar}/`
- Modify: `packages/ui/src/index.ts`
- Create: `apps/dashboard/app/_ds/sections/data.tsx`

**Interfaces:**

- Consumes: `cn` (Task 1), `Icon` (Task 3), `Badge` / `StatusDot` (Task 4)
- Produces:
  - `DataTable({ columns = [], rows = [], onRowClick, selectedIndex, dense = false, style })`
  - `EventList({ entries = [], height, autoScroll = false, dense = false, style })`
  - `MetricCard({ label, value, unit, delta, deltaTone, status, sublabel, chart, align = 'left', compact = false, style })`
  - `MetricGrid({ children, columns = 4, divided = true, style })`
  - `ProgressBar({ value = 0, max = 100, label, showValue = false, unit = '%', tone = 'accent', height = 6, threshold, indeterminate = false, style })`

**Sources :** DataTable `:605`, EventList `:683`, MetricCard `:734`, MetricGrid `:817`, ProgressBar `:845`.

- [ ] **Step 1 : Porter `DataTable`, `MetricCard`, `MetricGrid`, `ProgressBar`**

`DataTable` a un `useState(hover)` dans la source (`:605`) → devient `tr:hover`. `selectedIndex` est une prop → classe sur la ligne, avec le même traitement que la `Sidebar` (tint accent + inset 2px à gauche). `onRowClick` est transmis → pas de `'use client'`.

`ProgressBar` : la largeur de la barre est `(value / max) * 100%` → **style inline**, c'est une valeur runtime. `height` idem. `threshold` dessine un repère à sa position. `indeterminate` est une classe qui joue `sl-shimmer`.

`MetricCard` : `chart` est un slot `ReactNode` — c'est là que la `Sparkline` de la Task 9 viendra se loger. `deltaTone` et `status` sont des classes. Le nombre principal doit porter la classe `sl-num` — **c'est la règle du système : tout nombre live est en chiffres tabulaires.**

`MetricGrid` : `columns` numérique → `gridTemplateColumns` inline ; `divided` → classe qui ajoute les séparateurs.

- [ ] **Step 2 : Porter `EventList` — le seul Client Component du système**

Source `:683`. Il utilise `useRef` + `useEffect` pour l'auto-scroll quand `autoScroll` est vrai. C'est le seul des 37 qui a besoin de `'use client'`.

```tsx
'use client';
// Seul composant client du design system : autoScroll a besoin d'une ref et d'un effet.
// Cf. docs/superpowers/specs/2026-08-29-sightline-design-system-design.md §5.

import { useEffect, useRef } from 'react';
```

`entries` a la forme `{ label, detail?, time?, type? }[]`. Le handoff fixe le rendu : « fait accompli, sentence case, identifiant en détail terminal » — `Peer joined · c27ad930`, `ICE failed · ff104b2c`.

`height` est numérique → inline, avec `overflow-y: auto` et la classe `sl-scroll` de `base.css` pour la barre de défilement.

- [ ] **Step 3 : Écrire la section `data` de la galerie**

Utiliser les données de la maquette (`Dashboard UI.dc.html:277-282`), qui sont aussi celles du `mock.js` du bundle :

```tsx
const PEERS = [
  { peer_id: 'a3f91c02', room: 'test-room', score: 96, rtt: 38,  jitter: 11, loss: 0.2,  nack: 0.9, codec: 'vp8', status: 'live' },
  { peer_id: '0b8e2f61', room: 'test-room', score: 88, rtt: 44,  jitter: 14, loss: 0.04, nack: 1.1, codec: 'h264', status: 'live' },
  { peer_id: '5e7b21f4', room: 'test-room', score: 74, rtt: 96,  jitter: 22, loss: 0.81, nack: 2.4, codec: 'vp8', status: 'live' },
  { peer_id: 'd41f9ab7', room: 'test-room', score: 41, rtt: 212, jitter: 38, loss: 3.41, nack: 6.2, codec: 'vp8', status: 'degraded' },
];
```

Rendre : `DataTable` en normal et en `dense`, avec `selectedIndex={2}` ; `MetricGrid` de 4 `MetricCard` reprenant les champs réels du `/metrics` du SFU (`rooms`, `peers`, `avg_packet_loss`, `avg_rtt_ms`) ; `ProgressBar` à plusieurs valeurs dont une au-dessus de son `threshold`, plus le mode `indeterminate` ; `EventList` avec `autoScroll` et une hauteur fixe.

- [ ] **Step 4 : Vérifier**

```bash
bun run check-types && DS=$DS bun run verify:ds
```

`verify:ds` doit passer **avec** le `'use client'` d'`EventList` — c'est le seul autorisé. Si le script échoue là-dessus, c'est le script qui a un bug, pas le composant.

Sur `/_ds` : les colonnes de chiffres sont alignées verticalement (preuve que `sl-num` est bien appliqué), la ligne sélectionnée a son liseré accent, la `ProgressBar` au-dessus du seuil change de couleur.

- [ ] **Step 5 : Commit**

```bash
git add packages/ui/src apps/dashboard/app/_ds
git commit -m "feat(ui): 5 composants data (DataTable EventList MetricCard MetricGrid ProgressBar)"
```

---

## Task 9 : `data` — les 2 composants SVG

Séparés de la Task 8 : ce sont les deux seuls composants à géométrie calculée, et les deux seuls endroits où le système autorise un dégradé. Ils méritent leur propre cycle de revue.

**Files:**

- Create: `packages/ui/src/components/data/{Sparkline,TimeSeriesChart}/`
- Modify: `packages/ui/src/index.ts`, `apps/dashboard/app/_ds/sections/data.tsx`

**Interfaces:**

- Consumes: `cn` (Task 1)
- Produces:
  - `Sparkline({ data = [], width = 120, height = 32, tone = 'accent', fill = true, threshold, strokeWidth = 1.5, dot = true, style })`
  - `TimeSeriesChart({ series = [], labels = [], height = 180, threshold, thresholdLabel, yTicks = 4, unit = '', cursor, style })`

**Sources :** Sparkline `:930`, TimeSeriesChart `:1013`.

- [ ] **Step 1 : Porter `Sparkline`**

Tout le calcul de chemin (`min`/`max` de `data`, projection vers `width`/`height`, construction du `d`) se recopie **à l'identique** depuis `:930-1012`. C'est de l'arithmétique : ne pas la réécrire « en mieux », la transcrire.

Le `.module.css` ne porte que ce qui est statique (`display`, `overflow`). Les attributs SVG calculés (`d`, `stroke`, `fill`, `cx`, `cy`) restent des attributs.

Le `fill` est le seul dégradé autorisé du système : un fade vertical **14–16% → 0** sous la courbe, dans la couleur de la courbe. Relever l'opacité exacte dans la source et la reproduire — ne pas l'arrondir.

`tone` mappe vers `--accent`, `--ok`, `--warn`, `--danger`, ou une des 5 `--series-*`. Relever la table exacte.

- [ ] **Step 2 : Porter `TimeSeriesChart`**

Source `:1013-1219`, le plus gros composant du système (~200 lignes). Il gère plusieurs séries, une grille, des graduations Y, une ligne de seuil, et un curseur.

La prop `cursor` est **une valeur passée par l'appelant**, pas un état interne — vérifier ce point dans la source : si `TimeSeriesChart` ne fait que la lire, il n'a pas besoin de `'use client'`. Le relevé de hooks de la spec §5 confirme qu'il n'en a aucun.

Les couleurs de séries suivent `--series-1` à `--series-5` dans l'ordre.

- [ ] **Step 3 : Ajouter les deux à la section `data` de la galerie**

Rendre : une `Sparkline` par ton, avec et sans `fill`, avec et sans `dot`, une au-dessus de son `threshold` ; une `Sparkline` **dans le slot `chart` d'une `MetricCard`** (c'est son usage réel dans les maquettes) ; un `TimeSeriesChart` à 1 série puis à 3 séries, avec `threshold` + `thresholdLabel` et `unit="ms"`.

Pour les données, réutiliser le générateur du bundle (`_ds_bundle.js:4116`), que les maquettes appellent elles-mêmes :

```ts
// mêmes appels que Dashboard UI.dc.html:268-282
const series = (n: number, seed: number, base: number, amp: number): number[] => /* cf. :4116 */;
const rtt = series(30, 1, 38, 9);
```

- [ ] **Step 4 : Vérifier**

```bash
bun run check-types && DS=$DS bun run verify:ds
```

Comparaison visuelle obligatoire ici : ouvrir `Dashboard UI.dc.html` à côté et superposer une `Sparkline` de mêmes données. La courbe doit avoir la même amplitude, le même arrondi de jointure, et le fade sous la courbe la même intensité. C'est le composant où une transcription approximative se voit le plus.

- [ ] **Step 5 : Commit**

```bash
git add packages/ui/src apps/dashboard/app/_ds
git commit -m "feat(ui): Sparkline et TimeSeriesChart"
```

---

## Task 10 : `webrtc` — 5 composants

**Files:**

- Create: `packages/ui/src/components/webrtc/{LatencyChip,PeerCard,QualityIndicator,RoomCard,VideoTile}/`
- Modify: `packages/ui/src/index.ts`
- Create: `apps/dashboard/app/_ds/sections/webrtc.tsx`

**Interfaces:**

- Consumes: `cn` (Task 1), `Icon` (Task 3), `Badge` / `StatusDot` (Task 4), `Sparkline` (Task 9)
- Produces:
  - `LatencyChip({ value, unit = 'ms', metric = 'rtt', label, plain = false, style })`
  - `PeerCard({ peerId, status = 'connected', score, rtt, jitter, loss, codec, tracks = [], region, samples, selected = false, onClick, style })`
  - `QualityIndicator({ level = 'unknown', score, showLabel = false, size = 14, style })`
  - `RoomCard({ roomId, peers = 0, uptime, bitrate, health = 'ok', samples, region, onClick, style })`
  - `VideoTile({ label, sublabel, status = 'live', empty = false, emptyText = 'No stream', overlay, children, ratio = '16/10', style })`

**Sources :** LatencyChip `:2255`, QualityIndicator `:2319`, PeerCard `:2368`, RoomCard `:2482`, VideoTile `:2587`.

- [ ] **Step 1 : Porter les 5**

`PeerCard` (`:2368`) et `RoomCard` (`:2482`) ont un `useState(hover)` → `:hover`. `selected` est une prop → classe. `onClick` est transmis → pas de `'use client'`. Tous deux prennent `samples` et le passent à une `Sparkline`.

`LatencyChip` : `metric` détermine le seuil implicite qui décide de la couleur. **Rappel de la règle du système : un chiffre coloré signifie toujours qu'un seuil a été franchi, jamais de la décoration.** Les seuils réels du repo : `rtt_ms` > 200ms, `jitter_ms` > 30ms, `packet_loss_ratio` > 2%, `nack_ratio` > 5%, `freeze_ratio` > 1%, `bitrate_kbps` < 100kbps. Vérifier dans `:2255-2318` lesquels sont câblés en dur et **les reproduire tels quels** — ne pas en inventer.

`QualityIndicator` : `level` prend `'unknown'` plus les niveaux à relever dans `:2319-2367` ; `size` numérique → inline.

`VideoTile` (`:2587`) : `ratio` (défaut `'16/10'`) → `aspect-ratio` inline. Rayon 18px (`--radius-lg`), `object-fit: cover` sur le média. Le handoff décrit précisément les surcouches : « capsule flottante en bas à gauche (status dot + peer id + latence) et capsule qualité en haut à droite ». État vide : glyphe `video-off` en `--text-muted` + le texte `emptyText`.

- [ ] **Step 2 : Écrire la section `webrtc` de la galerie**

Rendre, avec les données réelles de la maquette (`Dashboard UI.dc.html:268-282`) :

- les 4 `PeerCard` de `PEERS` (Task 8), dont `d41f9ab7` qui est `degraded` avec `rtt: 212` — **au-dessus du seuil de 200ms, donc son chiffre doit être coloré** ;
- les 6 `RoomCard` de la maquette, dont `standup-eu` en `health: 'degraded'` et `load-test-9` en `idle` ;
- `LatencyChip` pour chacune des 6 métriques, une valeur sous le seuil et une au-dessus, plus le mode `plain` ;
- `QualityIndicator` à tous ses niveaux, avec et sans `showLabel` ;
- `VideoTile` : un plein (avec un `<div>` de fond en guise de flux), un `empty`, un avec `overlay`, et un en `ratio="1/1"`.

- [ ] **Step 3 : Vérifier**

```bash
bun run check-types && DS=$DS bun run verify:ds && bun run --filter @sightline/dashboard build
```

Sur `/_ds` : la `PeerCard` de `d41f9ab7` montre son RTT en rouge et les trois autres en neutre. Si tous les chiffres sont colorés, ou aucun, le seuil n'est pas câblé — relire la source.

- [ ] **Step 4 : Commit**

```bash
git add packages/ui/src apps/dashboard/app/_ds
git commit -m "feat(ui): 5 composants webrtc (LatencyChip PeerCard QualityIndicator RoomCard VideoTile)"
```

---

## Task 11 : La galerie complète, le dark mode, et la recette

Les 37 composants existent. Cette tâche assemble la galerie en outil de comparaison utilisable et passe la DoD de la spec §8.

**Files:**

- Modify: `apps/dashboard/app/_ds/page.tsx`
- Create: `apps/dashboard/app/_ds/ThemeSection.tsx`
- Modify: `packages/ui/src/index.ts` (retirer `_probe`)
- Delete: `packages/ui/src/components/_probe/`
- Create: `packages/ui/README.md`

**Interfaces:**

- Consumes: les 37 composants (Tasks 3 à 10)
- Produces: la route `/_ds`, en clair et en dark

- [ ] **Step 1 : Supprimer la sonde**

Elle a servi à lever le risque de la Task 1 ; elle n'a plus d'objet.

```bash
rm -rf packages/ui/src/components/_probe
# puis retirer la ligne `export * from './components/_probe';` de packages/ui/src/index.ts
grep -rn "_probe\|Probe" packages/ui apps/dashboard --include=*.ts --include=*.tsx
# attendu : aucun résultat
```

- [ ] **Step 2 : Assembler la page en deux thèmes**

`apps/dashboard/app/_ds/page.tsx` rend **deux fois** le même arbre de sections : une fois nu, une fois enveloppé dans `.theme-dark`. C'est ce qui rend le contrôle du dark mode possible d'un seul coup d'œil.

```tsx
import { CoreSection } from './sections/core';
import { LayoutSection } from './sections/layout';
import { NavigationSection } from './sections/navigation';
import { FeedbackSection } from './sections/feedback';
import { DataSection } from './sections/data';
import { WebrtcSection } from './sections/webrtc';

const SECTIONS = [
  ['Core', CoreSection],
  ['Layout', LayoutSection],
  ['Navigation', NavigationSection],
  ['Feedback', FeedbackSection],
  ['Data', DataSection],
  ['WebRTC', WebrtcSection],
] as const;

function Gallery() {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-11)', padding: 'var(--space-9)' }}>
      {SECTIONS.map(([name, Section]) => (
        <section key={name} style={{ display: 'grid', gap: 'var(--space-7)' }}>
          <h2 style={{ fontSize: 'var(--fs-20)', letterSpacing: 'var(--ls-tight)' }}>{name}</h2>
          <Section />
        </section>
      ))}
    </div>
  );
}

export default function DesignSystemPage() {
  return (
    <main>
      <div style={{ background: 'var(--surface-page)' }}>
        <Gallery />
      </div>
      <div className="theme-dark" style={{ background: 'var(--surface-page)', color: 'var(--text-body)' }}>
        <Gallery />
      </div>
    </main>
  );
}
```

- [ ] **Step 3 : Écrire `packages/ui/README.md`**

Le package a un README de scaffold qui ne dit rien. Le remplacer par : ce que contient le package, comment le consommer depuis une app (les 4 étapes de la spec §7), le lien vers la spec, et l'avertissement que `src/tokens/*.css` est copié du handoff et ne se modifie pas à la main.

- [ ] **Step 4 : Passer la DoD de la spec §8, point par point**

```bash
# les 37 composants sont exportés
# (node ne peut pas importer le package : il exporte du TSX source, pas un build.
#  On compte donc les ré-exports du barrel.)
grep -c "^export \* from './components/" packages/ui/src/index.ts
# attendu : 35 lignes — ToastStack est ré-exporté par le dossier Toast/,
#           GridItem par le dossier DashboardGrid/, d'où 35 dossiers pour 37 composants.

# Contrôle nominatif des 37 :
grep -rhoE "^export function ([A-Z][A-Za-z]*)" packages/ui/src/components --include=*.tsx \
  | sed 's/export function //' | sort -u | tee /dev/stderr | wc -l
# attendu : 37, et la liste doit correspondre exactement à la §6 de la spec.

DS=$DS bun run verify:ds     # contraintes
bun run check-types          # types
bun run lint                 # lint
bun run --filter @sightline/dashboard build   # build
```

Puis la recette visuelle, la seule qui prouve la fidélité :

```bash
open "$DS/../Dashboard UI.dc.html"
bun run --filter @sightline/dashboard dev   # puis /_ds
```

Cocher la DoD de la spec §8 :

- [ ] Les 37 composants exportés, signatures conformes à la §6 de la spec.
- [ ] Les 9 fichiers de tokens présents, identiques au handoff (`fonts.css` excepté) — vérifié par `verify:ds`.
- [ ] `/_ds` rend tout, en clair et en dark, **sans erreur ni avertissement dans la console**.
- [ ] `bun run check-types` vert.
- [ ] `bun run lint` vert.
- [ ] `bun run build` vert sur `apps/dashboard`.
- [ ] `EventList` est le seul composant portant `'use client'` — vérifié par `verify:ds`.
- [ ] Aucune couleur en dur — vérifié par `verify:ds`.
- [ ] **Au clavier**, `Tab` fait apparaître le ring de focus sur `Button`, `Input`, `Select`, `IconButton` ; **à la souris**, le clic ne le fait pas apparaître.
- [ ] En `.theme-dark`, aucun composant ne garde une surface claire ni un texte illisible — c'est ce que la seconde galerie rend visible.

- [ ] **Step 5 : Commit**

```bash
git add packages/ui apps/dashboard
git commit -m "feat(ui): galerie /_ds complete en clair et en dark, recette du design system"
```

---

## Notes d'exécution

**Ordre.** Les tâches 1 à 3 sont strictement séquentielles. Les tâches 4 à 10 dépendent toutes de 1–3 mais, entre elles, seules ces dépendances existent : 6 et 7 consomment des composants de 4 ; 10 consomme la `Sparkline` de 9. Une exécution parallèle est possible sur 5 / 7 / 8 une fois la 4 finie.

**À chaque tâche, la même clôture :** `bun run check-types`, `DS=$DS bun run verify:ds`, la section de galerie correspondante rendue et comparée à la maquette, puis un commit.

**Le protocole de comparaison** est le même partout : ouvrir le `.dc.html` concerné dans un navigateur (tout y est relatif, ça marche en local sans serveur), ouvrir `/_ds` à côté, comparer. Un composant est porté quand son rendu est indiscernable dans les deux thèmes.

**Si la source et ce plan divergent, la source gagne.** Ce plan donne la méthode et les points de vigilance ; `_ds_bundle.js` porte les valeurs. Chaque tâche référence ses numéros de ligne pour que la source soit à un `sed -n` de distance.
