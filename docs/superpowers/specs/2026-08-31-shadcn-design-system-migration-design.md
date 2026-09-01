# Migration du design system vers shadcn/ui (Tailwind v4) — Design

**Date :** 2026-08-31
**Statut :** approuvé, prêt pour le plan d'implémentation
**Périmètre :** `packages/ui` (fondation), consommé par `apps/web`, `apps/dashboard`, `apps/cloud`

## 1. Contexte

`@lumyx/ui` est le design system du monorepo : 9 fichiers de tokens (`src/tokens/*.css`) et
32 composants répartis en cinq catégories (`core`, `data`, `feedback`, `layout`,
`navigation`, `webrtc`). Il est consommé par trois apps :

| App | État | Usage de `@lumyx/ui` |
| --- | --- | --- |
| `apps/web` | 6 pages marketing livrées (PR #3) | ~20 fichiers, styling en utilitaires Tailwind + CSS Modules |
| `apps/dashboard` | pas d'écran produit, deux pages « spécimen » (`app/design-system/page.tsx`, `app/_ds/`) qui exercent la quasi-totalité des 32 composants | idem |
| `apps/cloud` | scaffold vide (`packages/auth`/`packages/db` sont des coquilles) | aucun |

Chaque composant a son propre `Nom.module.css` (32 dans `packages/ui`, 37 dans `apps/web`),
sans exception — y compris les composants `core` les plus simples (`Button`, `Badge`).

## 2. Objectif

Rebâtir `@lumyx/ui` sur shadcn/ui (Radix + `class-variance-authority` + Tailwind v4),
éliminer les CSS Modules du monorepo au profit d'un unique fichier CSS par package/app, en
préservant l'identité visuelle et l'API publique actuelles.

**Critère de succès :**
- Aucune couleur littérale (hex/`rgb(`) n'apparaît hors des fichiers de tokens — la règle
  `verify:ds` existante continue de le garantir après la migration.
- Les deux pages spécimen de `apps/dashboard` et les six pages d'`apps/web` sont
  visuellement indiscernables de leur état avant migration, à 360/768/1280px.
- Zéro fichier `*.module.css` dans `packages/ui` et `apps/web` ; `verify:ds` le fait
  respecter.
- `bun run build`, `bun run check-types`, `bun test` et `verify:ds` passent dans les deux
  packages.
- Aucun appel à `@lumyx/ui` dans `apps/web` ou `apps/dashboard` ne change de props (sauf
  les cas listés en 4.3).

## 3. Périmètre

**Dans le périmètre :**
- `packages/ui` : tooling shadcn, pont de tokens, les 32 composants, `lib/cn.ts`.
- `apps/web` : suppression de ses 37 `.module.css`, vérification visuelle des 6 routes.
- `apps/dashboard` : vérification visuelle des deux pages spécimen (aucune migration de
  code propre à cette app — elle n'a pas de `.module.css` à elle et ne fait que consommer
  `@lumyx/ui`).

**Hors périmètre :**
- `apps/cloud` : rien à y migrer, aucun consommateur actuel.
- Nouveaux composants shadcn sans usage existant (Dialog, DropdownMenu, Popover, Command,
  Sheet, Tooltip...). Ils s'ajouteront via `shadcn add` le jour où un écran en a besoin.
- Refonte visuelle : aucune couleur, rayon, espacement ou typographie ne change de valeur.

## 4. Décisions arrêtées

Ces décisions viennent du brainstorming et ne sont pas rouvertes par l'implémentation.

**4.1 — Tooling : CLI officielle shadcn en mode monorepo.** `bunx shadcn init` configure
`packages/ui` comme le workspace shadcn (`components.json`), qui écrit dans
`src/components/ui/`. Tailwind v4 n'a pas besoin de `tailwind.config.js` — la config shadcn
pointe vers `src/styles.css` pour le `@theme`. `shadcn add <composant>` régénère chaque
primitive ; les fichiers générés sont ensuite édités à la main (voir 4.4).

**4.2 — Le pont de tokens s'étend, il ne se remplace pas.** Les 9 fichiers de
`src/tokens/*.css` restent la source de vérité (aucune valeur de couleur/rayon/durée n'est
dupliquée ni réinventée). `styles.css` gagne un second bloc `@theme` qui mappe le
vocabulaire attendu par les composants shadcn générés vers ces tokens existants :

| Variable shadcn | Pont vers |
| --- | --- |
| `--background` / `--foreground` | `var(--surface-page)` / `var(--text-body)` |
| `--card` / `--card-foreground` | `var(--surface-card)` / `var(--text-strong)` |
| `--primary` / `--primary-foreground` | `var(--accent)` / `var(--text-on-accent)` |
| `--secondary` / `--secondary-foreground` | `var(--accent-2)` / `var(--text-on-accent)` |
| `--muted` / `--muted-foreground` | `var(--surface-sunken)` / `var(--text-muted)` |
| `--destructive` / `--destructive-foreground` | `var(--danger)` / `var(--text-on-accent)` |
| `--border` / `--input` / `--ring` | `var(--border)` / `var(--border)` / `var(--accent)` |
| `--radius` | la valeur déjà utilisée par `rounded-control` dans `tokens/radius.css` |

Ce pont est un ajout dans `@theme`, pas une réécriture — les 19 tokens sémantiques déjà
exposés (`--color-surface-page`, `--color-accent`, etc., cf. `styles.css` actuel) restent
tels quels et continuent d'être ceux que les composants métier (4.5) utilisent directement.

**4.3 — Dark mode : `.theme-dark` reste le sélecteur, pas `.dark`.** Le monorepo n'a pas de
bascule globale clair/sombre — `.theme-dark` assombrit des sections marketing ponctuelles
(hero, en-tête). On ne migre pas vers la convention `next-themes`/`.dark` : le nouveau bloc
de pont (4.2) se duplique sous `.theme-dark`, exactement comme `semantic.css` le fait déjà
pour les 19 tokens actuels.

**4.4 — API publique préservée, vocabulaire shadcn en interne seulement.** Les primitives
génériques régénérées gardent leurs props actuelles (`Button variant="primary"|"secondary"
|"quiet"|"danger"|"accentQuiet"`, `Badge tone="neutral"|"accent"|"secondary"|"ok"|"warn"
|"danger"|"info"`, `Select label/options/size`, etc.) — c'est le `cva()` interne qui prend
le vocabulaire shadcn (`default`/`destructive`/`outline`/...) en mapping vers ces valeurs,
jamais l'inverse. Aucun call site dans `apps/web` ou les pages spécimen d'`apps/dashboard`
ne devrait changer de props. Exception explicite : les composants qui passent sur Radix
(4.6) peuvent gagner des props optionnelles pour exposer des capacités que Radix apporte
(ex. `Select` ouvert par clavier, `Toast` avec durée d'auto-dismiss) — jamais en cassant
une prop existante.

**4.5 — `lib/cn.ts` passe sur `clsx` + `tailwind-merge`.** C'est le `cn` standard shadcn,
plus robuste que la concaténation naïve actuelle quand une classe consommateur doit
l'emporter sur une classe de variante (ex. `className="bg-danger"` passé à un `Button`
`primary` doit gagner sur `bg-accent`, ce qui n'est pas garanti aujourd'hui par un simple
`join`).

**4.6 — Qui passe vraiment sur Radix.** Seuls les composants où Radix apporte un vrai gain
d'accessibilité/comportement :

| Composant | Aujourd'hui | Radix apporte |
| --- | --- | --- |
| `Select` | `<select>` natif stylé | listbox accessible, positionnement, recherche clavier |
| `Tabs` | `role=tablist` fait main, pas de navigation clavier | roving tabindex, flèches, `Tabs.Root`/`Tabs.Trigger` |
| `Toast` | composant présentation pure, empilé par `ToastStack` côté consommateur | région live accessible ; le composant garde sa signature déclarative actuelle (`<Toast severity title message onDismiss>`), Radix fournit le moteur d'accessibilité sous le capot sans forcer le pattern impératif `toast()` de shadcn |

Tous les autres composants `core` (`Button`, `Badge`, `Card`, `IconButton`, `Icon`, `Pill`,
`StatusDot`, `Input`) sont régénérés via `shadcn add` pour leur styling `cva` mais restent
des éléments HTML simples sans état — pas de Radix requis, pas de gain à en tirer.

**4.7 — Composants métier : rebase, pas réécriture Radix.** Les 18 composants restants
(`data/*`, `feedback/*` hors `Toast`, `layout/*`, `navigation/*` hors `Tabs`, `webrtc/*`)
gardent leur implémentation logique et leurs props. Ils changent uniquement en interne :
ils composent désormais les primitives du point 4.6 (ex. `AlertBanner` utilise le nouvel
`IconButton`) plutôt que de dupliquer leur propre style, et leur styling migre au format
utilitaire Tailwind du point 4.8.

**4.8 — Fin des CSS Modules, un seul fichier CSS par package/app.** Les 32 `.module.css`
de `packages/ui` et les 37 d'`apps/web` disparaissent. `packages/ui/src/styles.css` et
`apps/web/app/globals.css` restent chacun le seul fichier CSS de leur package. Ce qui
vivait dans les modules (typographie display, grilles à ratios exacts, keyframes par
composant) part en utilitaires Tailwind directement dans le JSX, avec la syntaxe de valeur
arbitraire (`text-[62px]`, `grid-cols-[264px_minmax(0,1fr)_224px]`) pour toute valeur hors
échelle. Le fichier CSS unique de chaque package/app ne garde que :
- l'import Tailwind et le pont `@theme` (4.2) ;
- les blocs `:root` / `.theme-dark` (4.3) ;
- un `@layer base` façon shadcn (reset des bordures, fond/texte du `body`) ;
- les classes globales déjà partagées aujourd'hui (`.sl-num`, `.sl-label`, `.sl-scroll`) et
  les keyframes `sl-*` — rien de nouveau nommé par composant.

`verify-ds.mjs` (dans `packages/ui` et `apps/web`) gagne une règle : zéro fichier
`*.module.css` dans l'arbre scanné.

## 5. Vérification

Deux surfaces de non-régression existent déjà et couvrent la quasi-totalité de la
matrice :

- `apps/dashboard/app/design-system/page.tsx` et `apps/dashboard/app/_ds/` exercent les 32
  composants avec des props réalistes (c'est la meilleure couverture pour les composants
  `data`/`webrtc`/`layout`/`navigation`, absents d'`apps/web`).
- `apps/web`, ses 6 routes, à 360/768/1280px (méthode déjà utilisée sur la PR #3 :
  Playwright headless, capture `scrollWidth` vs largeur de viewport + screenshot).

La vérification finale lance les deux : build + `verify:ds` + `check-types` + `bun test`
sur `packages/ui` et `apps/web`, puis une passe visuelle sur les deux pages spécimen et les
six routes marketing.

## 6. Risques

- **`Toast` est le composant le plus délicat** (4.6) : préserver la signature déclarative
  actuelle tout en s'appuyant sur le moteur Radix (pensé pour un pattern
  provider/`toast()`) demande d'utiliser les primitives Radix bas niveau plutôt que le
  bloc shadcn `add toast` tel quel. À traiter en dernier, avec le plus de marge.
- **Volume mécanique élevé** : 69 fichiers `.module.css` à éliminer. Le risque n'est pas
  la difficulté par fichier mais la régression silencieuse (une valeur qui glisse d'un
  pixel, une classe oubliée) — d'où la vérification systématique en deux surfaces (§5)
  plutôt qu'une relecture de diff seule.
- **Collisions de classes globales** : en supprimant le scoping automatique des CSS
  Modules, toute nouvelle classe nommée ajoutée par erreur au fichier CSS unique (plutôt
  qu'en utilitaire Tailwind inline) redevient globale. La règle 4.8 (zéro classe nommée par
  composant) est ce qui neutralise ce risque — le vérificateur ne peut pas la faire
  respecter automatiquement, la relecture doit y être attentive.
