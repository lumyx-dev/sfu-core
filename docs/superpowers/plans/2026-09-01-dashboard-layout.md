# Layout dashboard partagé — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Doter `apps/dashboard` et `apps/cloud` d'un layout commun — sidebar shadcn customisée aux tokens Lumyx, header de page, drawer mobile — assemblé localement par chaque app à partir de primitives partagées dans `packages/ui`.

**Architecture:** `packages/ui` expose des primitives (`Sidebar*` shadcn, `SidebarNav`, `Wordmark`, `AppHeader`, `PageBody`, `StatusStrip`) ; chaque app compose son propre chrome. `SidebarInset` devient une grille `grid-rows-[auto_1fr_auto]` dont la ligne 1 est le header rendu par la page, la ligne 2 le `PageBody` (seule zone qui scrolle) et la ligne 3 le `StatusStrip` rendu par le chrome. `AppShell` disparaît.

**Tech Stack:** Next 16.3.2 (App Router), React 19.2.8, Tailwind CSS v4 (`@theme inline`), shadcn/ui style `new-york`, `lucide-react`, bun 1.3.11, Turborepo.

**Spec:** `docs/superpowers/specs/2026-09-01-dashboard-layout-design.md`

## Global Constraints

- **Aucune couleur littérale** (hex `#…`, `rgb()`, `rgba()`) hors `packages/ui/src/styles.css`. Vaut aussi pour `app/`, `components/`, `lib/` des deux apps. Contrôlé par `verify:ds`.
- **Aucune font monospace** (`font-mono`, `ui-monospace`, `'SF Mono'`, `Menlo`, `Consolas`), **aucun `dangerouslySetInnerHTML`**, **aucun `*.module.css`** dans `packages/ui/src`. Contrôlé par `verify:ds`.
- **Imports relatifs uniquement dans `packages/ui/src`.** L'alias `@/` y est interdit : les apps transpilent `@lumyx/ui` depuis les sources et mappent `@/*` vers leur propre racine, donc un `@/components/ui/button` dans `packages/ui` casse le build des deux apps. Une règle `verify:ds` est ajoutée en Task 1 pour l'imposer.
- **Seuil responsive : 1024px**, soit le breakpoint `lg` de Tailwind. Toute classe responsive de ce chantier utilise `lg:`.
- **Largeur de sidebar : `var(--sidebar-w)`**, déjà défini à `248px` dans `styles.css`. Ne jamais réécrire `248px` en dur.
- **Échelle typographique numérique** : `text-11` `text-12` `text-13` `text-14` `text-16` `text-20` `text-26` `text-34` `text-44`. Ne jamais utiliser `text-sm` / `text-base` / `text-lg`.
- **Langue des libellés** : `apps/dashboard` est en anglais, `apps/cloud` est mixte. Reprendre **verbatim** les chaînes déjà présentes dans chaque page, ne rien retraduire.
- **Pas de harnais de test de composants.** Le repo n'en a pas (`apps/dashboard` n'a même pas de script `test`) et la spec l'exclut du périmètre. La boucle de vérification de chaque task est donc : `verify:ds` → `check-types` → `build` → passe visuelle. Les tasks 1 et 8 ont en plus un vrai cycle rouge/vert sur `verify-ds.mjs`. **Ne pas introduire Vitest, Jest ou Testing Library dans ce chantier.**
- **Commandes** : bun. Préfixer `rtk` (cf. `CLAUDE.md`), ex. `rtk git commit`.

---

## Structure des fichiers

### `packages/ui`

| Fichier | Sort | Responsabilité |
| --- | --- | --- |
| `src/components/ui/sidebar.tsx` | **créé** (CLI shadcn) | Coquille shadcn. Trois éditions volontaires seulement (§Task 1). |
| `src/components/ui/sheet.tsx` | **créé** (CLI shadcn) | Drawer mobile. Non modifié. |
| `src/hooks/use-mobile.ts` | **créé** (CLI shadcn) | Détection mobile. Une édition : le seuil. |
| `src/components/lumyx/wordmark.tsx` | **créé** | `Wordmark`, extrait de `app-shell.tsx`. |
| `src/components/lumyx/sidebar-nav.tsx` | **créé** | `NavSection`, `SidebarNav`. Porte toute l'identité visuelle Lumyx de la nav. |
| `src/components/lumyx/app-header.tsx` | **créé** | `Crumb`, `AppHeader`. Remplace `Toolbar`. |
| `src/components/lumyx/page-body.tsx` | **créé** | `PageBody`, déplacé depuis `app-shell.tsx`. |
| `src/components/lumyx/status-strip.tsx` | **créé** | `StatusStrip`, déplacé depuis `app-shell.tsx`. |
| `src/components/lumyx/app-shell.tsx` | **supprimé** (Task 8) | — |
| `src/components/lumyx/index.ts` | modifié | Barrel. |
| `src/index.ts` | modifié | Ajoute `./components/ui/sidebar`. |
| `src/styles.css` | modifié | Ajoute les 8 mappages `--color-sidebar*` dans `@theme inline`. |
| `scripts/verify-ds.mjs` | modifié | Ajoute la règle `no-alias-imports`. |
| `package.json` | modifié | `next` en `peerDependencies`. |

### `apps/dashboard`

| Fichier | Sort |
| --- | --- |
| `components/dashboard-chrome.tsx` | réécrit |
| `app/page.tsx`, `app/rooms/page.tsx` | migrés (Task 4) |
| `app/rooms/room/page.tsx`, `app/peers/`, `alerts/`, `metrics/`, `replay/`, `signaling/`, `server/`, `settings/`, `%5Fds/` | migrés (Task 5) |

### `apps/cloud`

| Fichier | Sort |
| --- | --- |
| `components/cloud-chrome.tsx` | réécrit |
| `components/project-switcher.tsx` | **créé** (présentationnel) |
| `components/account-menu.tsx` | **créé** (présentationnel) |
| `app/(console)/overview/page.tsx` | migré (Task 6) |
| `app/(console)/page.tsx`, `rooms/`, `alerts/`, `metrics/`, `keys/`, `usage/`, `team/`, `billing/`, `audit/` | migrés (Task 7) |
| `app/onboarding/page.tsx` | **intouché** — hors du groupe `(console)`, donc hors `SidebarProvider` : y appeler `AppHeader` ferait planter `useSidebar()`. |

---

## Task 1 : installer la sidebar shadcn et la rendre compatible monorepo

**Files:**
- Create: `packages/ui/src/components/ui/sidebar.tsx`, `packages/ui/src/components/ui/sheet.tsx`, `packages/ui/src/hooks/use-mobile.ts` (générés par le CLI)
- Modify: `packages/ui/src/styles.css`, `packages/ui/src/index.ts`, `packages/ui/scripts/verify-ds.mjs`

**Interfaces:**
- Consumes: rien.
- Produits pour les tasks suivantes : `SidebarProvider`, `Sidebar`, `SidebarInset`, `SidebarTrigger`, `SidebarHeader`, `SidebarContent`, `SidebarFooter`, `SidebarGroup`, `SidebarGroupLabel`, `SidebarGroupContent`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`, `useSidebar`, exportés depuis `@lumyx/ui`. `SidebarMenuButton` accepte `asChild?: boolean`, `isActive?: boolean`, `className?: string`. Utilitaires Tailwind `bg-sidebar`, `text-sidebar-foreground`, `border-sidebar-border`, `bg-sidebar-accent`, `text-sidebar-accent-foreground`, `bg-sidebar-primary`, `text-sidebar-primary-foreground`, `ring-sidebar-ring` disponibles dans tout le monorepo.

- [ ] **Step 1 : ajouter la règle `no-alias-imports` à `verify-ds.mjs`**

Contexte : aucun fichier de `packages/ui/src` n'utilise l'alias `@/` aujourd'hui — tout est en imports relatifs. Les apps mappent `@/*` vers leur propre racine (`apps/*/tsconfig.json`) et transpilent `@lumyx/ui` depuis les sources (`transpilePackages: ['@lumyx/ui']`). Un `@/` dans le package se résoudrait donc côté app et casserait le build. Le CLI shadcn génère ses imports en `@/` : cette règle est le filet qui l'attrape, maintenant et à chaque futur `shadcn add`.

Insérer dans `packages/ui/scripts/verify-ds.mjs`, après la règle 4 (`no-css-modules`) et avant la règle 5 :

```js
// 5. Aucun import par alias @/ — les apps mappent `@/*` vers leur propre racine et
// transpilent @lumyx/ui depuis les sources, donc un alias ici se resoudrait cote app.
// Le CLI shadcn genere ses imports en @/ : c'est la regle qui les attrape.
const ALIAS_IMPORT = /\bfrom\s+['"]@\/|\brequire\(\s*['"]@\/|\bimport\(\s*['"]@\//;
for (const f of files) {
  if (!['.ts', '.tsx'].includes(extname(f))) continue;
  readFileSync(f, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      if (ALIAS_IMPORT.test(line)) {
        fail('no-alias-imports', `${rel(f)}:${i + 1} — ${line.trim()}`);
      }
    });
}
```

Renuméroter en commentaire l'ancienne règle 5 (`cn()` / échelle typographique) en règle 6. Les numéros ne sont que des commentaires, aucune logique n'en dépend.

- [ ] **Step 2 : vérifier que la règle passe sur l'état actuel**

```bash
cd packages/ui && bun run verify:ds
```

Attendu : **PASS**. Si ça échoue, un fichier utilisait déjà `@/` — le corriger en import relatif avant de continuer.

- [ ] **Step 3 : installer le composant sidebar**

```bash
cd packages/ui && bunx --bun shadcn@latest add sidebar
```

Le CLI lit `packages/ui/components.json` (style `new-york`, `rsc: true`, alias `@/*` → `./src/*`) et écrit `src/components/ui/sidebar.tsx`, `src/components/ui/sheet.tsx` et `src/hooks/use-mobile.ts`. `separator`, `tooltip`, `skeleton`, `input`, `button` et `@radix-ui/react-dialog` sont déjà présents ; il ne doit rien réinstaller d'autre.

- [ ] **Step 4 : inspecter le diff et annuler ce que le CLI a touché en trop**

```bash
rtk git status && rtk git diff packages/ui/src/styles.css packages/ui/package.json
```

Le CLI peut appender un bloc de tokens `--sidebar-*` en fin de `styles.css` et/ou réordonner `package.json`. **Les huit tokens `--sidebar-*` existent déjà** dans le `:root` de `styles.css` (lignes ~98-105) : annuler tout ajout en double.

```bash
rtk git checkout -- packages/ui/src/styles.css   # uniquement si le CLI l'a modifie
```

- [ ] **Step 5 : lancer verify:ds pour voir la règle échouer**

```bash
cd packages/ui && bun run verify:ds
```

Attendu : **FAIL**, une dizaine de lignes `[no-alias-imports] src/components/ui/sidebar.tsx:N — import … from "@/components/ui/button"` (idem `sheet.tsx`, et `@/hooks/use-mobile`, `@/lib/utils`).

- [ ] **Step 6 : réécrire les imports alias en imports relatifs**

Les trois fichiers générés vivent dans `src/components/ui/` et `src/hooks/`. Depuis `src/components/ui/`, `@/lib/utils` devient `../../lib/utils`, `@/components/ui/x` devient `./x`, `@/hooks/use-mobile` devient `../../hooks/use-mobile`. Depuis `src/hooks/`, il n'y a normalement aucun import alias.

```bash
cd packages/ui/src/components/ui
sed -i '' \
  -e 's#from "@/lib/utils"#from "../../lib/utils"#g' \
  -e 's#from "@/hooks/use-mobile"#from "../../hooks/use-mobile"#g' \
  -e 's#from "@/components/ui/#from "./#g' \
  sidebar.tsx sheet.tsx
```

Puis vérifier qu'il n'en reste aucun, y compris avec des quotes simples :

```bash
cd /Users/mathieuchambaud/Documents/Perso-Projects/lumyx && grep -rn "@/" packages/ui/src/components/ui/sidebar.tsx packages/ui/src/components/ui/sheet.tsx packages/ui/src/hooks/use-mobile.ts
```

Attendu : aucune sortie. S'il en reste, les corriger à la main selon la même table de correspondance.

- [ ] **Step 7 : relancer verify:ds pour voir la règle passer**

```bash
cd packages/ui && bun run verify:ds
```

Attendu : **PASS**.

- [ ] **Step 8 : les trois éditions volontaires des fichiers générés**

Hors réécriture d'imports, on ne touche à `sidebar.tsx` que pour la largeur, et à `use-mobile.ts` que pour le seuil. Le reste reste au plus proche de l'upstream pour pouvoir être remis à jour.

Dans `packages/ui/src/components/ui/sidebar.tsx`, remplacer la constante de largeur :

```ts
const SIDEBAR_WIDTH = "var(--sidebar-w)"
```

(`--sidebar-w: 248px` est défini dans le `:root` de `styles.css`. La constante est injectée en style inline sur le conteneur de `SidebarProvider`, la `var()` s'y résout.)

Dans `packages/ui/src/hooks/use-mobile.ts`, remplacer le seuil :

```ts
const MOBILE_BREAKPOINT = 1024
```

Laisser `SIDEBAR_WIDTH_MOBILE` et `SIDEBAR_WIDTH_ICON` inchangés.

- [ ] **Step 9 : mapper les tokens sidebar dans `@theme inline`**

Sans ça, les utilitaires `bg-sidebar`, `border-sidebar-border`… n'existent pas et la sidebar rend transparente : les tokens `--sidebar-*` sont bien dans `:root` mais le bloc `@theme inline` de `styles.css` ne les expose pas.

Dans `packages/ui/src/styles.css`, à la fin du bloc `/* shadcn aliases */` de `@theme inline` (juste après `--color-ring: var(--ring);`), ajouter :

```css
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
```

- [ ] **Step 10 : exporter la sidebar depuis le barrel**

Dans `packages/ui/src/index.ts`, ajouter la ligne dans le bloc `components/ui`, en respectant l'ordre alphabétique (entre `./components/ui/separator` et `./components/ui/skeleton`) :

```ts
export * from './components/ui/sidebar';
```

Ne **pas** exporter `sheet` ni `use-mobile` : ce sont des dépendances internes de la sidebar, aucune app ne les consomme directement.

- [ ] **Step 11 : vérifier**

```bash
cd packages/ui && bun run verify:ds && bun run check-types
```

Attendu : les deux **PASS**. Les deux apps ne consomment pas encore la sidebar, elles ne peuvent pas régresser.

- [ ] **Step 12 : commit**

```bash
cd /Users/mathieuchambaud/Documents/Perso-Projects/lumyx
rtk git add packages/ui/src/components/ui/sidebar.tsx packages/ui/src/components/ui/sheet.tsx packages/ui/src/hooks/use-mobile.ts packages/ui/src/styles.css packages/ui/src/index.ts packages/ui/scripts/verify-ds.mjs
rtk git commit -m "feat(ui): installer la sidebar shadcn, seuil 1024px et tokens mappes"
```

---

## Task 2 : `Wordmark` et `SidebarNav`

**Files:**
- Create: `packages/ui/src/components/lumyx/wordmark.tsx`, `packages/ui/src/components/lumyx/sidebar-nav.tsx`
- Modify: `packages/ui/src/components/lumyx/app-shell.tsx`, `packages/ui/src/components/lumyx/index.ts`, `packages/ui/package.json`

**Interfaces:**
- Consumes (Task 1) : `SidebarGroup`, `SidebarGroupLabel`, `SidebarGroupContent`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`.
- Produits : `Wordmark({ className?: string })` ; `type NavSection = { label: string; items: { href: string; label: string; icon: React.ElementType }[] }` ; `SidebarNav({ sections: NavSection[] })`.

- [ ] **Step 1 : déclarer `next` en peerDependency**

`packages/ui` importe `next/link` et `next/navigation` (déjà dans `app-shell.tsx`, et `sidebar-nav.tsx` va le faire aussi) sans le déclarer — ça ne fonctionne aujourd'hui que par hoisting du monorepo. Dans `packages/ui/package.json`, bloc `peerDependencies` :

```json
  "peerDependencies": {
    "next": "^16",
    "react": "^19",
    "react-dom": "^19"
  },
```

- [ ] **Step 2 : créer `wordmark.tsx`**

Contenu déplacé tel quel depuis `app-shell.tsx`, aucun changement visuel.

```tsx
import * as React from "react";
import { cn } from "../../lib/utils";
import { LumyxMark } from "./mark";

export function Wordmark({ className }: { className?: string }) {
  // The mark takes the accent from `currentColor`; the word is Geist 600 at −0.02em.
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LumyxMark size={20} className="text-accent" />
      <span className="text-16 font-semibold tracking-[-0.02em] text-strong">Lumyx</span>
    </span>
  );
}
```

- [ ] **Step 3 : créer `sidebar-nav.tsx`**

Trois points de vigilance, tous traités par le `className` passé à `SidebarMenuButton` :

1. Par défaut shadcn survole en `hover:bg-sidebar-accent`, qui vaut `--accent-tint` (indigo). Lumyx survole en **neutre** (`bg-hover`) et réserve l'indigo à l'item **actif**. `cn()` utilise tailwind-merge : `hover:bg-hover` et `hover:bg-sidebar-accent` sont dans le même groupe `bg-color`, l'override gagne.
2. `SidebarMenuButton` a `text-sm` par défaut ; `text-13` appartient au même groupe `font-size` (l'échelle numérique est enregistrée dans `cn()` via `FONT_SIZES`), il gagne donc aussi.
3. La barre d'accent inset de 2px de l'item actif est un `shadow-[inset_2px_0_0_var(--accent)]` — c'est une `var()`, pas une couleur littérale, `verify:ds` l'accepte.
4. `SidebarGroupLabel` porte `text-xs` en amont shadcn. `sl-label` fixe bien `font-size: 11px`,
   mais ce n'est pas un utilitaire `text-*` : tailwind-merge ne le met pas en conflit avec
   `text-xs`, les deux survivent, et c'est l'ordre de la feuille générée qui départage — fragile.
   D'où le `text-11` explicite à côté de `sl-label` : lui **est** dans le groupe `font-size`, donc
   il évince `text-xs` de façon déterministe. Ne pas le retirer en trouvant qu'il fait doublon.

```tsx
"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../../lib/utils";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../ui/sidebar";

export type NavSection = {
  label: string;
  items: { href: string; label: string; icon: React.ElementType }[];
};

/** La nav de la sidebar : groupes, item actif, identite visuelle Lumyx. */
export function SidebarNav({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();
  return (
    <>
      {sections.map((section) => (
        <SidebarGroup key={section.label} className="gap-1 py-0">
          <SidebarGroupLabel className="sl-label h-auto px-2 pb-1 text-11">
            {section.label}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {section.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      className={cn(
                        "h-auto gap-2.5 rounded-sm px-2 py-1.5 text-13 transition-colors duration-[120ms]",
                        active
                          ? "bg-accent-tint font-medium text-accent-text shadow-[inset_2px_0_0_var(--accent)] hover:bg-accent-tint hover:text-accent-text"
                          : "text-body hover:bg-hover hover:text-strong",
                      )}
                    >
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className="no-underline hover:no-underline"
                      >
                        <item.icon className="size-4 shrink-0 stroke-[1.75]" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}
```

- [ ] **Step 4 : retirer `Wordmark` et `NavSection` d'`app-shell.tsx`**

`app-shell.tsx` est supprimé en Task 8, mais il doit rester compilable d'ici là. Dans `packages/ui/src/components/lumyx/app-shell.tsx` :

- supprimer la déclaration de `export type NavSection = …` et celle de `export function Wordmark(…)` ;
- ajouter en tête `import { Wordmark } from "./wordmark";` et `import type { NavSection } from "./sidebar-nav";` ;
- supprimer les imports devenus inutilisés (`LumyxMark`).

`AppShell`, `Toolbar`, `StatusStrip` et `PageBody` restent en place et fonctionnels.

- [ ] **Step 5 : mettre à jour le barrel**

Dans `packages/ui/src/components/lumyx/index.ts`, ajouter **avant** la ligne `export * from "./app-shell";` :

```ts
export * from "./wordmark";
export * from "./sidebar-nav";
```

L'ordre importe : `app-shell` réexporte désormais depuis ces deux modules.

- [ ] **Step 6 : vérifier**

```bash
cd packages/ui && bun run verify:ds && bun run check-types
```

Attendu : les deux **PASS**. Aucun doublon d'export de `Wordmark` ou `NavSection` ne doit apparaître — si `check-types` signale un conflit, c'est que la déclaration n'a pas été retirée d'`app-shell.tsx`.

- [ ] **Step 7 : commit**

```bash
cd /Users/mathieuchambaud/Documents/Perso-Projects/lumyx
rtk git add packages/ui/src/components/lumyx/wordmark.tsx packages/ui/src/components/lumyx/sidebar-nav.tsx packages/ui/src/components/lumyx/app-shell.tsx packages/ui/src/components/lumyx/index.ts packages/ui/package.json
rtk git commit -m "feat(ui): extraire Wordmark et ajouter SidebarNav"
```

---

## Task 3 : `AppHeader`, `PageBody`, `StatusStrip`

**Files:**
- Create: `packages/ui/src/components/lumyx/app-header.tsx`, `packages/ui/src/components/lumyx/page-body.tsx`, `packages/ui/src/components/lumyx/status-strip.tsx`
- Modify: `packages/ui/src/components/lumyx/app-shell.tsx`, `packages/ui/src/components/lumyx/index.ts`

**Interfaces:**
- Consumes (Task 1) : `SidebarTrigger`.
- Produits :
  - `type Crumb = { href?: string; label: string }`
  - `AppHeader(props: { breadcrumb?: Crumb[]; title: React.ReactNode; meta?: React.ReactNode; actions?: React.ReactNode; className?: string })`
  - `PageBody(props: { className?: string; children: React.ReactNode })`
  - `StatusStrip(props: { items: { label: string; value: string; live?: boolean }[] })`

- [ ] **Step 1 : créer `app-header.tsx`**

`row-start-1` est en dur : une page qui oublie son header ou qui inverse l'ordre de ses enfants ne décale pas la grille du `SidebarInset`.

`SidebarTrigger` appelle `useSidebar()`, qui lève une erreur hors `SidebarProvider`. `AppHeader` n'est donc utilisable que dans un écran enveloppé par un chrome — jamais dans `apps/cloud/app/onboarding/page.tsx`.

```tsx
"use client";
import * as React from "react";
import Link from "next/link";
import { cn } from "../../lib/utils";
import { SidebarTrigger } from "../ui/sidebar";

export type Crumb = { href?: string; label: string };

/**
 * Ligne 1 de la grille du SidebarInset. Rendu par la page, pas par le chrome :
 * le titre vit avec les donnees qui le remplissent.
 */
export function AppHeader({
  breadcrumb,
  title,
  meta,
  actions,
  className,
}: {
  breadcrumb?: Crumb[];
  title: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "row-start-1 flex items-center justify-between gap-6 border-b border-hairline bg-card px-4 py-4 lg:px-8",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <SidebarTrigger className="lg:hidden" />
        <div className="flex min-w-0 flex-col gap-0.5">
          {breadcrumb?.length ? (
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-12 text-muted">
              {breadcrumb.map((crumb, i) => (
                <React.Fragment key={`${crumb.label}-${i}`}>
                  {i > 0 ? <span aria-hidden="true" className="text-faint">/</span> : null}
                  {crumb.href ? (
                    <Link href={crumb.href} className="text-muted no-underline hover:text-strong">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span aria-current="page">{crumb.label}</span>
                  )}
                </React.Fragment>
              ))}
            </nav>
          ) : null}
          <h1 className="truncate text-20 font-semibold text-strong">{title}</h1>
          {meta ? <div className="truncate text-12 text-muted">{meta}</div> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
```

- [ ] **Step 2 : créer `page-body.tsx`**

Deux différences avec la version d'`app-shell.tsx` : c'est désormais **la seule zone qui scrolle** (`overflow-y-auto`), et la contrainte de largeur passe sur un enfant pour que la scrollbar reste collée au bord de la fenêtre plutôt qu'à 1360px.

```tsx
import * as React from "react";
import { cn } from "../../lib/utils";

/** Ligne 2 de la grille du SidebarInset — la seule zone qui scrolle. */
export function PageBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <main className="sl-scroll row-start-2 min-w-0 overflow-y-auto">
      <div className={cn("mx-auto w-full max-w-[1360px] px-4 py-6 lg:px-8", className)}>{children}</div>
    </main>
  );
}
```

- [ ] **Step 3 : créer `status-strip.tsx`**

Deux différences avec la version d'`app-shell.tsx` : `row-start-3` au lieu de `sticky bottom-0 z-20`, et un scroll horizontal sous 1024px au lieu d'une compression des items.

```tsx
import * as React from "react";
import { StatusDot } from "./status-dot";

/** Ligne 3 de la grille du SidebarInset — l'etat du systeme, pas celui de l'ecran. */
export function StatusStrip({ items }: { items: { label: string; value: string; live?: boolean }[] }) {
  return (
    <footer className="sl-scroll row-start-3 flex items-center gap-6 overflow-x-auto border-t border-hairline bg-card px-4 py-2.5 lg:px-8">
      {items.map((it) => (
        <span key={it.label} className="flex shrink-0 items-center gap-2">
          {it.live ? <StatusDot status="live" /> : null}
          <span className="sl-label">{it.label}</span>
          <span className="sl-num text-12 font-medium text-strong">{it.value}</span>
        </span>
      ))}
    </footer>
  );
}
```

- [ ] **Step 4 : retirer `PageBody` et `StatusStrip` d'`app-shell.tsx`**

Dans `packages/ui/src/components/lumyx/app-shell.tsx` : supprimer les déclarations `export function PageBody(…)` et `export function StatusStrip(…)`, ainsi que l'import désormais inutilisé de `StatusDot`. **Supprimer aussi `Toolbar`**, que `AppHeader` remplace et que personne ne consomme. Il ne reste dans le fichier que `AppShell`.

- [ ] **Step 5 : mettre à jour le barrel**

Dans `packages/ui/src/components/lumyx/index.ts`, ajouter avant la ligne `export * from "./app-shell";` :

```ts
export * from "./app-header";
export * from "./page-body";
export * from "./status-strip";
```

- [ ] **Step 6 : vérifier**

```bash
cd packages/ui && bun run verify:ds && bun run check-types
cd /Users/mathieuchambaud/Documents/Perso-Projects/lumyx && bun run check-types
```

Attendu : **PASS** partout. Les deux apps consomment encore `AppShell` et `StatusStrip` (dont l'API est inchangée) ; rien ne doit casser.

- [ ] **Step 7 : commit**

```bash
cd /Users/mathieuchambaud/Documents/Perso-Projects/lumyx
rtk git add packages/ui/src/components/lumyx/
rtk git commit -m "feat(ui): AppHeader, PageBody et StatusStrip en primitives de grille"
```

---

## Task 4 : chrome du dashboard self-hosted + les deux écrans designés

**Files:**
- Modify: `apps/dashboard/components/dashboard-chrome.tsx`, `apps/dashboard/app/page.tsx`, `apps/dashboard/app/rooms/page.tsx`

**Interfaces:**
- Consumes (Tasks 1-3) : `SidebarProvider`, `Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarFooter`, `SidebarInset`, `SidebarNav`, `Wordmark`, `AppHeader`, `PageBody`, `StatusStrip`.
- Produits : `DashboardChrome({ children })`, inchangé côté signature — `apps/dashboard/app/layout.tsx` n'a pas à bouger.

- [ ] **Step 1 : réécrire `dashboard-chrome.tsx`**

`SidebarInset` a `flex` par défaut ; `grid` le remplace (même groupe `display` pour tailwind-merge). `collapsible="offcanvas"` et non `"none"` : dans le source shadcn, `"none"` court-circuite la branche mobile avant le rendu du `Sheet`. Le `SidebarTrigger` étant en `lg:hidden` dans `AppHeader`, la sidebar ne peut pas se replier en desktop.

`SECTIONS` est repris **verbatim** de la version actuelle.

```tsx
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
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarNav,
  SidebarProvider,
  StatusStrip,
  Wordmark,
  type NavSection,
} from '@lumyx/ui';
import Link from 'next/link';

const SECTIONS: NavSection[] = [
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
    <SidebarProvider>
      <Sidebar collapsible="offcanvas" className="border-hairline">
        <SidebarHeader className="px-3 py-4">
          <Link href="/" className="px-2 no-underline hover:no-underline">
            <Wordmark />
          </Link>
        </SidebarHeader>
        <SidebarContent className="sl-scroll gap-5 px-3">
          <SidebarNav sections={SECTIONS} />
        </SidebarContent>
        <SidebarFooter className="px-5 py-4">
          <span className="sl-num text-11 text-faint">v0.4.1 · MIT licensed · sfu-eu-3</span>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="grid h-svh grid-rows-[auto_1fr_auto] overflow-hidden">
        {children}
        <StatusStrip
          items={[
            { label: 'Signaling', value: 'wss://127.0.0.1:3000/ws', live: true },
            { label: 'Rooms', value: '4' },
            { label: 'Peers', value: '65' },
            { label: 'Alerts', value: '4' },
            { label: 'Retention', value: '7d' },
          ]}
        />
      </SidebarInset>
    </SidebarProvider>
  );
}
```

- [ ] **Step 2 : migrer `app/page.tsx` (Overview)**

Le fichier commence aujourd'hui par `return (<div className="flex max-w-340 flex-col gap-6">`. Remplacer ce wrapper par un fragment contenant le header puis le `PageBody` — `max-w-340` faisait doublon avec la contrainte de largeur désormais portée par `PageBody`.

Ajouter `AppHeader` et `PageBody` à l'import depuis `@lumyx/ui`, puis :

```tsx
  return (
    <>
      <AppHeader title="Overview" meta="sfu-eu-3 · 4 rooms · 65 peers" />
      <PageBody>
        <div className="flex flex-col gap-6">
          {/* … tout le contenu existant, inchange … */}
        </div>
      </PageBody>
    </>
  );
```

- [ ] **Step 3 : migrer `app/rooms/page.tsx`**

Cette page a un titre dynamique (`filter === "ended" ? "Ended rooms" : …`) dans un `CardTitle` et un compteur en `CardDescription`. Le titre de l'écran est stable — c'est « Rooms » — tandis que le titre de la carte décrit le filtre courant : **garder les deux**, ils ne disent pas la même chose.

```tsx
  return (
    <>
      <AppHeader title="Rooms" meta={`${rows.length} of ${ROOMS.length}`} />
      <PageBody>
        {/* … contenu existant, y compris la Card et son CardTitle filtre … */}
      </PageBody>
    </>
  );
```

Retirer `max-w-[1360px]` du `className` de la `Card` si elle en porte un.

- [ ] **Step 4 : vérifier**

`apps/dashboard` **ne peut pas** sortir vert : `app/%5Fds/page.tsx` est cassé sur `main` avant ce
chantier (il importe six modules `./sections/*` qui n'existent pas, et `Icon` / `ICONS` /
`IconName` que `@lumyx/ui` n'a jamais exportés). Le gate est donc **différentiel** : aucune erreur
en dehors de ce fichier.

```bash
cd apps/dashboard && bun run verify:ds
bun run check-types 2>&1 | grep "error TS" | grep -v "app/%5Fds/page.tsx"   # doit être VIDE
bun run build 2>&1 | grep -iE "error|failed" | grep -vE "%5Fds|\./sections/|Turbopack build failed|Build error occurred|script \"build\" exited"   # VIDE
```

Attendu : `verify:ds` **PASS**, et les deux `grep` ne renvoient **rien**. Si une ligne apparaît,
c'est une régression introduite par cette task — la corriger. Ne pas tenter de réparer `%5Fds`,
c'est hors périmètre.

- [ ] **Step 5 : passe visuelle**

```bash
cd apps/dashboard && bun run dev
```

Ouvrir `http://localhost:3001/` puis `/rooms`, et vérifier :
- la sidebar fait 248px, le wordmark est en haut, le footer de version en bas ;
- l'item de nav actif porte la barre indigo de 2px à gauche et un fond indigo très clair ; un item **non actif** survolé passe en gris neutre, **pas** en indigo (si c'est indigo, l'override `hover:bg-hover` de `SidebarNav` n'a pas pris) ;
- le header ne scrolle pas, le `StatusStrip` reste collé en bas, seul le contenu défile ;
- en réduisant la fenêtre sous 1024px : la sidebar disparaît, un bouton hamburger apparaît à gauche du titre, et l'ouvrir affiche la nav en drawer.

- [ ] **Step 6 : commit**

```bash
cd /Users/mathieuchambaud/Documents/Perso-Projects/lumyx
rtk git add apps/dashboard/components/dashboard-chrome.tsx apps/dashboard/app/page.tsx apps/dashboard/app/rooms/page.tsx
rtk git commit -m "feat(dashboard): chrome sur la sidebar shadcn et header sur Overview et Rooms"
```

---

## Task 5 : les 8 écrans restants du dashboard

**Files:**
- Modify: `apps/dashboard/app/rooms/room/page.tsx`, `app/peers/page.tsx`, `app/alerts/page.tsx`, `app/metrics/page.tsx`, `app/replay/page.tsx`, `app/signaling/page.tsx`, `app/server/page.tsx`, `app/settings/page.tsx`, `app/%5Fds/page.tsx`

**Interfaces:**
- Consumes (Tasks 3-4) : `AppHeader`, `PageBody`, `type Crumb`.
- Produits : rien pour les tasks suivantes.

- [ ] **Step 1 : migrer les sept écrans « stub »**

`peers`, `alerts`, `metrics`, `replay`, `signaling`, `server` et `settings` suivent tous exactement la même forme : une `Card` avec un `CardHeader`/`CardTitle` et un `EmptyState`. Le titre remonte dans le header et le `CardHeader` disparaît.

Modèle, pour `app/peers/page.tsx` (titre `Peers`, icône `Users`) :

```tsx
import { AppHeader, Card, EmptyState, PageBody } from '@lumyx/ui';
import { Users } from "lucide-react";

export default function Page() {
  return (
    <>
      <AppHeader title="Peers" />
      <PageBody>
        <Card className="overflow-hidden">
          <EmptyState
            icon={Users}
            title="No design exists for this screen yet"
            body="Overview, Rooms and Room detail are designed. Ask for this screen and it gets built from the same components."
          />
        </Card>
      </PageBody>
    </>
  );
}
```

Appliquer la même transformation aux six autres, en reprenant **verbatim** le titre, l'icône et les textes de l'`EmptyState` déjà présents dans chaque fichier :

| Fichier | Titre `AppHeader` |
| --- | --- |
| `app/alerts/page.tsx` | `Alerts` |
| `app/metrics/page.tsx` | `Metrics` |
| `app/replay/page.tsx` | `Session replay` |
| `app/signaling/page.tsx` | `Signaling` |
| `app/server/page.tsx` | `Server` |
| `app/settings/page.tsx` | `Settings` |

Dans chacun : retirer `CardHeader` et `CardTitle` de l'import s'ils ne servent plus, retirer `max-w-[1360px]` du `className` de la `Card`, ajouter `AppHeader` et `PageBody` à l'import.

- [ ] **Step 2 : migrer `app/rooms/room/page.tsx` — le seul écran à breadcrumb**

C'est l'unique écran imbriqué. Son en-tête actuel est une ligne composite dans le corps de la page : `StatusDot` + `<h2>{roomId}</h2>` + `Badge` + méta + deux boutons (`Session replay`, `Close room`). Toute cette ligne remonte dans `AppHeader` et disparaît du corps.

Dans le composant `RoomDetail`, remplacer le wrapper `<div className="flex max-w-[1360px] flex-col gap-5">` et la ligne d'en-tête par :

```tsx
  return (
    <>
      <AppHeader
        breadcrumb={[{ href: "/rooms", label: "Rooms" }, { label: roomId }]}
        title={
          <span className="flex items-center gap-2.5">
            <StatusDot status="live" />
            {roomId}
            <Badge tone="room">eu-west-3</Badge>
          </span>
        }
        meta={<span className="sl-num">Up 2h 14m · 6 peers · 2.4 Mbps</span>}
        actions={
          <>
            <Button size="sm">Session replay</Button>
            <Button size="sm" variant="danger">Close room</Button>
          </>
        }
      />
      <PageBody>
        <div className="flex flex-col gap-5">
          {/* … Tabs et tout le reste du contenu existant, inchange … */}
        </div>
      </PageBody>
    </>
  );
```

`title` accepte un `ReactNode`, d'où le `<span>` composite ; `truncate` s'applique au `h1` parent, ne pas le dupliquer à l'intérieur.

Le header **doit rester à l'intérieur de `RoomDetail`** : il affiche `roomId`, qui vient de
`useSearchParams()`, lequel exige la frontière `Suspense`. Conséquence : pendant le prérendu
statique, `fallback={null}` laisserait les lignes 1 et 2 de la grille vides. Remplacer donc le
fallback du composant exporté par défaut, en bas du fichier :

```tsx
export default function RoomDetailPage() {
  return (
    <React.Suspense
      fallback={
        <>
          <AppHeader breadcrumb={[{ href: "/rooms", label: "Rooms" }]} title="Room" />
          <PageBody>{null}</PageBody>
        </>
      }
    >
      <RoomDetail />
    </React.Suspense>
  );
}
```

- [ ] **Step 3 : ne pas toucher `app/%5Fds/page.tsx`**

Cette page est **exclue du chantier**. Elle est cassée sur `main` avant lui : le dossier
`app/%5Fds/` ne contient que `page.tsx`, les six modules `./sections/*` qu'elle importe n'existent
pas, et `Icon` / `ICONS` / `IconName` n'ont jamais été exportés par `@lumyx/ui`. Elle ne compile ni
ne builde. Lui ajouter un `AppHeader` n'aurait aucun effet observable, et la réparer (recréer six
modules de sections plus un composant `Icon`) est un chantier distinct que personne n'a demandé.

Ne pas l'ouvrir, ne pas la modifier, ne pas la supprimer.

- [ ] **Step 4 : vérifier**

`apps/dashboard` **ne peut pas** sortir vert : `app/%5Fds/page.tsx` est cassé sur `main` avant ce
chantier (il importe six modules `./sections/*` qui n'existent pas, et `Icon` / `ICONS` /
`IconName` que `@lumyx/ui` n'a jamais exportés). Le gate est donc **différentiel** : aucune erreur
en dehors de ce fichier.

```bash
cd apps/dashboard && bun run verify:ds
bun run check-types 2>&1 | grep "error TS" | grep -v "app/%5Fds/page.tsx"   # doit être VIDE
bun run build 2>&1 | grep -iE "error|failed" | grep -vE "%5Fds|\./sections/|Turbopack build failed|Build error occurred|script \"build\" exited"   # VIDE
```

Attendu : `verify:ds` **PASS**, et les deux `grep` ne renvoient **rien**. Si une ligne apparaît,
c'est une régression introduite par cette task — la corriger. Ne pas tenter de réparer `%5Fds`,
c'est hors périmètre.

- [ ] **Step 5 : passe visuelle**

`bun run dev` puis parcourir les dix routes migrées du dashboard (`/_ds` est exclue et reste cassée). Vérifier sur chacune que le titre du header est présent et correct, qu'aucun titre n'apparaît en double (header **et** `CardHeader`), et que sur `/rooms/room?id=test-room` le breadcrumb `Rooms / test-room` s'affiche avec `Rooms` cliquable et le dernier segment non cliquable.

- [ ] **Step 6 : commit**

```bash
cd /Users/mathieuchambaud/Documents/Perso-Projects/lumyx
rtk git add apps/dashboard/app
rtk git commit -m "feat(dashboard): AppHeader sur les huit ecrans restants"
```

---

## Task 6 : chrome du cloud + `ProjectSwitcher` + `AccountMenu` + Overview

**Files:**
- Create: `apps/cloud/components/project-switcher.tsx`, `apps/cloud/components/account-menu.tsx`
- Modify: `apps/cloud/components/cloud-chrome.tsx`, `apps/cloud/app/(console)/overview/page.tsx`

**Interfaces:**
- Consumes (Tasks 1-3) : les mêmes primitives que la Task 4, plus `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator` (déjà dans `@lumyx/ui`).
- Produits : `ProjectSwitcher()` et `AccountMenu()`, sans props, présentationnels.

- [ ] **Step 1 : créer `project-switcher.tsx`**

Présentationnel : pas de logique de changement de projet, elle est hors périmètre. Les valeurs sont en dur, comme le reste des données de démo de l'app (`lib/cloud-data.ts`).

```tsx
'use client';

import { Check, ChevronsUpDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@lumyx/ui';

const PROJECTS = ['live-classroom', 'webinar-us', 'support-desk', 'sandbox'];
const CURRENT = 'live-classroom';
const ENVIRONMENT = 'production';

/** Contexte org/projet — stable d'un ecran a l'autre, donc dans la sidebar et non le header. */
export function ProjectSwitcher() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-13 text-body transition-colors duration-[120ms] hover:bg-hover hover:text-strong">
        <span className="flex min-w-0 flex-col items-start">
          <span className="truncate font-medium text-strong">{CURRENT}</span>
          <span className="sl-label">{ENVIRONMENT}</span>
        </span>
        <ChevronsUpDown className="ml-auto size-4 shrink-0 text-faint stroke-[1.75]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {PROJECTS.map((p) => (
          <DropdownMenuItem key={p} className="justify-between">
            {p}
            {p === CURRENT ? <Check className="size-4 text-accent stroke-[1.75]" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 2 : créer `account-menu.tsx`**

Placé dans le `SidebarFooter`, sous le compteur de quota — décision de la spec §2 : le header change à chaque navigation, l'identité de l'utilisateur non, et le footer évite toute collision avec le slot `actions` d'une page.

Présentationnel à ce stade : pas d'appel à `better-auth`, la session est hors périmètre.

```tsx
'use client';

import { LogOut, Settings, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@lumyx/ui';

const NAME = 'Mathieu Chambaud';
const ORG = 'Lumyx';

export function AccountMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-13 text-body transition-colors duration-[120ms] hover:bg-hover hover:text-strong">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-pill bg-accent-tint text-11 font-medium text-accent-text">
          MC
        </span>
        <span className="flex min-w-0 flex-col items-start">
          <span className="truncate font-medium text-strong">{NAME}</span>
          <span className="sl-label">{ORG}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuItem><User className="size-4 stroke-[1.75]" />Profil</DropdownMenuItem>
        <DropdownMenuItem><Settings className="size-4 stroke-[1.75]" />Paramètres</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem><LogOut className="size-4 stroke-[1.75]" />Se déconnecter</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 3 : réécrire `cloud-chrome.tsx`**

Même structure que le chrome du dashboard, avec deux ajouts locaux : `ProjectSwitcher` sous le wordmark dans le `SidebarHeader`, et `AccountMenu` sous le compteur de quota dans le `SidebarFooter`. `SECTIONS` et le bloc de quota deux-tons sont repris **verbatim** de la version actuelle.

```tsx
'use client';

import {
  LayoutDashboard, RadioTower, Bell, Gauge, Terminal,
  GitBranch, Activity, Users, Database, List,
} from 'lucide-react';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset,
  SidebarNav, SidebarProvider, StatusStrip, Wordmark, type NavSection,
} from '@lumyx/ui';
import Link from 'next/link';
import { AccountMenu } from '@/components/account-menu';
import { ProjectSwitcher } from '@/components/project-switcher';

const SECTIONS: NavSection[] = [
  {
    label: 'Project',
    items: [
      { href: '/overview', label: 'Overview', icon: LayoutDashboard },
      { href: '/rooms', label: 'Rooms', icon: RadioTower },
      { href: '/alerts', label: 'Alerts', icon: Bell },
      { href: '/metrics', label: 'Metrics', icon: Gauge },
      { href: '/keys', label: 'API keys', icon: Terminal },
    ],
  },
  {
    label: 'Organisation',
    items: [
      { href: '/', label: 'Projects', icon: GitBranch },
      { href: '/usage', label: 'Usage', icon: Activity },
      { href: '/team', label: 'Team', icon: Users },
      { href: '/billing', label: 'Billing', icon: Database },
      { href: '/audit', label: 'Audit log', icon: List },
    ],
  },
];

export function CloudChrome({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <Sidebar collapsible="offcanvas" className="border-hairline">
        <SidebarHeader className="gap-3 px-3 py-4">
          <Link href="/" className="px-2 no-underline hover:no-underline">
            <Wordmark />
          </Link>
          <ProjectSwitcher />
        </SidebarHeader>
        <SidebarContent className="sl-scroll gap-5 px-3">
          <SidebarNav sections={SECTIONS} />
        </SidebarContent>
        <SidebarFooter className="gap-3 px-5 py-4">
          <div className="flex flex-col gap-2 border-t border-subtle pt-3.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12.5px] text-body">Scale plan</span>
              <a href="/billing" className="sl-label text-accent-text">Upgrade</a>
            </div>
            {/* Two-tone meter: consumed, then projected. */}
            <div className="flex h-1.5 overflow-hidden rounded-pill bg-[var(--n-100)]">
              <span className="bg-accent" style={{ width: '62%' }} />
              <span className="bg-accent-tint" style={{ width: '20%' }} />
            </div>
            <span className="sl-num text-11 text-muted">310,240 / 500,000 min · 62%</span>
          </div>
          <AccountMenu />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="grid h-svh grid-rows-[auto_1fr_auto] overflow-hidden">
        {children}
        <StatusStrip
          items={[
            { label: 'Projets', value: '4' },
            { label: 'Rooms', value: '11', live: true },
            { label: 'Peers', value: '143' },
            { label: 'Alertes', value: '3' },
            { label: 'Minutes', value: '310,240' },
          ]}
        />
      </SidebarInset>
    </SidebarProvider>
  );
}
```

- [ ] **Step 4 : migrer `app/(console)/overview/page.tsx`**

```tsx
import { AppHeader, Button, Card, EmptyState, PageBody } from '@lumyx/ui';
import { LayoutDashboard } from "lucide-react";
import { DASHBOARD_URL } from '@/lib/links';

export default function Page() {
  return (
    <>
      <AppHeader title="Overview" meta="live-classroom · production" />
      <PageBody>
        <Card className="overflow-hidden">
          <EmptyState
            icon={LayoutDashboard}
            title="Cet écran est identique au dashboard self-hosted"
            body="L’observabilité ne change pas en cloud : Overview, Rooms et Room detail sont conçus dans le dashboard. Seul le chrome autour diffère — sidebar org, switcher d’environnement, quotas."
            action={<Button size="sm" variant="primary" asChild><a href={DASHBOARD_URL} className="no-underline hover:no-underline">Ouvrir le dashboard</a></Button>}
          />
        </Card>
      </PageBody>
    </>
  );
}
```

- [ ] **Step 5 : vérifier**

```bash
cd apps/cloud && bun run verify:ds && bun run check-types && bun run test && bun run build
```

Attendu : les quatre **PASS**. `bun run test` couvre les tests existants de `lib/auth` et `lib/db`, sans rapport avec ce chantier — ils doivent rester verts.

- [ ] **Step 6 : passe visuelle**

`bun run dev` puis `http://localhost:3002/overview`. Vérifier le switcher de projet sous le wordmark, le compteur de quota puis le menu compte en bas de la sidebar, le menu compte qui s'ouvre **vers le haut** (`side="top"`), et le comportement drawer sous 1024px. Vérifier aussi que `http://localhost:3002/onboarding` s'affiche toujours sans sidebar et sans erreur.

- [ ] **Step 7 : commit**

`apps/cloud` est un **dépôt git distinct** (`git@github.com:FrekiManagarm/lumyx-cloud.git`),
gitignoré par le repo parent (`.gitignore:20`). Ses commits vont donc dans son propre repo, sur sa
propre branche `feat/dashboard-layout` — jamais via un `git add` depuis la racine du monorepo.

```bash
cd /Users/mathieuchambaud/Documents/Perso-Projects/lumyx/apps/cloud
rtk git add components app
rtk git commit -m "feat(cloud): chrome sur la sidebar shadcn, project switcher et menu compte"
```

---

## Task 7 : les 9 écrans restants du cloud

**Files:**
- Modify: `apps/cloud/app/(console)/page.tsx`, `rooms/page.tsx`, `alerts/page.tsx`, `metrics/page.tsx`, `keys/page.tsx`, `usage/page.tsx`, `team/page.tsx`, `billing/page.tsx`, `audit/page.tsx`

**Interfaces:**
- Consumes (Tasks 3, 6) : `AppHeader`, `PageBody`.
- Produits : rien.

- [ ] **Step 1 : migrer les cinq écrans « stub »**

`rooms`, `alerts`, `metrics`, `team` et `audit` ont la même forme que les stubs du dashboard : une `Card` avec `CardHeader`/`CardTitle` (+ parfois `CardDescription`) et un `EmptyState`. Le titre remonte dans `AppHeader`, la description devient `meta`.

| Fichier | `title` | `meta` |
| --- | --- | --- |
| `rooms/page.tsx` | `Rooms` | `live-classroom · production` |
| `alerts/page.tsx` | `Alerts` | `live-classroom · production` |
| `metrics/page.tsx` | `Metrics` | `live-classroom · production` |
| `team/page.tsx` | `Team` | *(aucune)* |
| `audit/page.tsx` | `Audit log` | *(aucune)* |

Ils se répartissent en deux familles.

**Famille A — `rooms`, `alerts`, `metrics`** (mêmes textes, même icône, même action). Fichier
complet pour `rooms/page.tsx` ; pour `alerts` et `metrics`, seul le `title` de l'`AppHeader`
change (`Alerts`, `Metrics`) :

```tsx
import { AppHeader, Button, Card, EmptyState, PageBody } from '@lumyx/ui';
import { LayoutDashboard } from "lucide-react";
import { DASHBOARD_URL } from '@/lib/links';

export default function Page() {
  return (
    <>
      <AppHeader title="Rooms" meta="live-classroom · production" />
      <PageBody>
        <Card className="overflow-hidden">
          <EmptyState
            icon={LayoutDashboard}
            title="Cet écran est identique au dashboard self-hosted"
            body="L’observabilité ne change pas en cloud : Overview, Rooms et Room detail sont conçus dans le dashboard. Seul le chrome autour diffère — sidebar org, switcher d’environnement, quotas."
            action={<Button size="sm" variant="primary" asChild><a href={DASHBOARD_URL} className="no-underline hover:no-underline">Ouvrir le dashboard</a></Button>}
          />
        </Card>
      </PageBody>
    </>
  );
}
```

**Famille B — `team`, `audit`** (pas de `CardDescription`, donc pas de `meta` ; pas d'action).
Fichier complet pour `team/page.tsx` ; pour `audit`, le titre devient `Audit log` et l'icône
`List` (importée depuis `lucide-react`) :

```tsx
import { AppHeader, Card, EmptyState, PageBody } from '@lumyx/ui';
import { Users } from "lucide-react";

export default function Page() {
  return (
    <>
      <AppHeader title="Team" />
      <PageBody>
        <Card className="overflow-hidden">
          <EmptyState
            icon={Users}
            title="Pas encore conçu"
            body="Projects, Usage, API keys et Billing sont conçus. Demande cet écran et il se construit avec les mêmes composants."
          />
        </Card>
      </PageBody>
    </>
  );
}
```

- [ ] **Step 2 : migrer les quatre écrans à contenu**

`page.tsx` (Projects), `keys`, `usage` et `billing` ont plusieurs cartes. Ici le header ne remplace **aucun** `CardTitle` : chaque carte garde le sien, le header ajoute le titre de l'écran au-dessus. Envelopper le contenu existant dans `<PageBody>` et retirer les `max-w-[1360px]` devenus redondants.

| Fichier | `title` | `meta` | `actions` |
| --- | --- | --- | --- |
| `page.tsx` | `Projects` | `4 projets · août 2026` | *(aucune)* |
| `keys/page.tsx` | `API keys` | `live-classroom · production · eu-west-3` | *(aucune)* |
| `usage/page.tsx` | `Usage` | `août 2026 · à date` | *(aucune)* |
| `billing/page.tsx` | `Billing` | `août 2026 · émise le 1 sept.` | *(aucune)* |

Pour `keys/page.tsx`, les constantes `PROJECT` et `REGION` existent déjà en haut du fichier : composer la méta avec, plutôt que de réécrire les valeurs en dur — `meta={`${PROJECT} · production · ${REGION}`}`.

- [ ] **Step 3 : vérifier**

```bash
cd apps/cloud && bun run verify:ds && bun run check-types && bun run test && bun run build
```

Attendu : les quatre **PASS**.

- [ ] **Step 4 : passe visuelle**

`bun run dev` puis parcourir les dix routes de la console. Vérifier qu'aucun titre n'apparaît en double et que les métas ne contredisent pas le contenu des cartes.

- [ ] **Step 5 : commit**

Toujours dans le dépôt `apps/cloud`, pas dans le monorepo :

```bash
cd /Users/mathieuchambaud/Documents/Perso-Projects/lumyx/apps/cloud
rtk git add app
rtk git commit -m "feat(cloud): AppHeader sur les neuf ecrans restants de la console"
```

---

## Task 8 : supprimer `AppShell` et vérifier l'ensemble

**Files:**
- Delete: `packages/ui/src/components/lumyx/app-shell.tsx`
- Modify: `packages/ui/src/components/lumyx/index.ts`

**Interfaces:**
- Consumes : rien.
- Produits : `AppShell` n'existe plus. Aucun fichier du monorepo ne doit y faire référence.

- [ ] **Step 1 : vérifier qu'il ne reste aucun consommateur**

```bash
cd /Users/mathieuchambaud/Documents/Perso-Projects/lumyx
grep -rn "AppShell\|Toolbar" apps packages --include='*.tsx' --include='*.ts' -l 2>/dev/null | grep -v node_modules
```

Attendu : **aucune sortie**. S'il en reste, la task 4, 5, 6 ou 7 est incomplète — la finir avant de supprimer le fichier.

- [ ] **Step 2 : supprimer le fichier et son export**

```bash
rtk git rm packages/ui/src/components/lumyx/app-shell.tsx
```

Puis retirer la ligne `export * from "./app-shell";` de `packages/ui/src/components/lumyx/index.ts`.

- [ ] **Step 3 : vérifier tout le monorepo**

Gate **différentiel** : `apps/dashboard` reste rouge sur `app/%5Fds/page.tsx`, cassé sur `main`
avant ce chantier et explicitement exclu (Task 5 step 3). Toute autre erreur est une régression.

```bash
cd /Users/mathieuchambaud/Documents/Perso-Projects/lumyx
bun run verify:ds
bun run test
bun run check-types 2>&1 | grep "error TS" | grep -v "app/%5Fds/page.tsx"   # doit être VIDE
bun run build     2>&1 | grep -iE "error|failed" | grep -vE "%5Fds|\./sections/|Turbopack build failed|Build error occurred|script \"build\" exited"   # VIDE
```

`apps/cloud` est un dépôt distinct mais reste un workspace bun du monorepo : `turbo` le couvre.

Attendu : `verify:ds` et `test` **PASS**, les deux `grep` **vides**. `apps/web` ne consomme pas
`AppShell` mais dépend de `@lumyx/ui` : son build est la vérification que le barrel reste
cohérent.

- [ ] **Step 4 : passe responsive finale sur les deux apps**

Lancer les deux apps (`bun run dev` à la racine lance les trois via Turborepo : dashboard sur 3001, cloud sur 3002) et vérifier, sur un écran de chaque app :

| Vérification | Attendu |
| --- | --- |
| ≥ 1024px | Sidebar visible et figée à 248px, pas de bouton hamburger |
| < 1024px | Sidebar masquée, hamburger visible dans le header, drawer fonctionnel |
| Drawer ouvert | Fermeture par la croix, par un clic sur l'overlay et par `Échap` |
| Scroll | Seul le contenu défile ; header et `StatusStrip` restent en place |
| `StatusStrip` < 1024px | Défile horizontalement, les items ne se compressent pas |
| Thème sombre | Forcer `prefers-color-scheme: dark` dans les devtools : la sidebar prend le fond sombre via `--surface-card` |

- [ ] **Step 5 : commit**

```bash
cd /Users/mathieuchambaud/Documents/Perso-Projects/lumyx
rtk git add packages/ui/src/components/lumyx/index.ts
rtk git commit -m "refactor(ui): supprimer AppShell, remplace par les primitives de layout"
```

---

## Couverture de la spec

| Section de la spec | Task |
| --- | --- |
| §2 sidebar shadcn customisée | 1, 2 |
| §2 primitives partagées, assemblage local | 2, 3, 4, 6 |
| §2 `StatusStrip` conservé | 3, 4, 6 |
| §2 `AppShell` supprimé | 3 (Toolbar), 8 (AppShell) |
| §3 `SidebarNav`, `Wordmark` | 2 |
| §3 API d'`AppHeader` | 3 |
| §3 `sidebar.tsx` proche de l'upstream | 1 (trois éditions volontaires, listées) |
| §4 grille `auto 1fr auto`, `row-start-*` | 3, 4, 6 |
| §4 seuil 1024px, drawer mobile | 1 (`use-mobile`), 3 (`lg:hidden`, `lg:px-8`), 8 (vérification) |
| §4 `collapsible="offcanvas"` | 4, 6 |
| §4 thème sombre sans travail | 1 (mappage `@theme`), 8 (vérification) |
| §5 chrome dashboard | 4 |
| §5 chrome cloud, `ProjectSwitcher`, `AccountMenu` | 6 |
| §5 `onboarding` hors chrome | 6 (vérification explicite) |
| §6 migration des 20 écrans | 4 (2), 5 (8), 6 (1), 7 (9) |
| §6 breadcrumb sur `/rooms/room` | 5 |
| §6 `/_ds` présente les nouvelles primitives | **abandonné** — page cassée sur `main` avant le chantier (Task 5 step 3) |
| §7 vérification | chaque task, et 8 pour l'ensemble |

**Au-delà de la spec, assumé :** la règle `no-alias-imports` dans `verify-ds.mjs` (Task 1 step 1) et le mappage `--color-sidebar*` dans `@theme inline` (Task 1 step 9). Le premier est le filet qui empêche un futur `shadcn add` de recasser le build des apps ; le second est indispensable au rendu de la sidebar et ne figurait pas dans la spec parce que le trou dans `@theme inline` n'avait pas encore été constaté. `next` en `peerDependencies` (Task 2 step 1) corrige une dépendance non déclarée que ce chantier aggrave.
