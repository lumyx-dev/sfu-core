# Design — `packages/ui` : port du design system Sightline

Date : 2026-08-29
Statut : validé, prêt pour le plan d'implémentation
Sous-projet : 1/4

---

## 1. Contexte

Le handoff `~/Downloads/design_handoff_sightline` livre les maquettes hi-fi de Sightline : 9 écrans
`.dc.html` (site public, console Cloud, dashboard d'observabilité) et le design system qui les
compose — 9 fichiers de tokens CSS et 37 composants React.

Dans le monorepo, `packages/ui` est vide (un `package.json` et un `README.md`). `apps/dashboard` et
`apps/sightline-cloud` sont deux `create-next-app` bruts. Aucune UI produit n'existe. Ce n'est donc
pas un remplacement mais une construction.

Ce document ne couvre que le **sous-projet 1 : `packages/ui`**. Les trois autres (dashboard, cloud,
marketing) auront chacun leur spec, et dépendent tous de celui-ci.

### Sources

| Source | Ce qu'on en tire |
|---|---|
| `designs/_ds/sightline-design-system-…/tokens/*.css` | Les 9 fichiers de tokens. **Copiés verbatim**, ce sont la source de vérité. |
| `designs/_ds/sightline-design-system-…/_ds_bundle.js` | Les 37 composants, en JSX compilé Babel classic (`React.createElement`) — lisible, defaults et styles inline en clair. C'est l'original du port. |
| `designs/_ds/sightline-design-system-…/readme.md` | Le guide du design system : intention, ton, contraintes. |
| `README.md` du handoff | La spec de port : fidélité, animations, états d'interaction, responsive. |
| `designs/*.dc.html` | Les écrans. Servent ici à valider le rendu des composants ; leur port est l'objet des specs 2 à 4. |

---

## 2. Décisions validées

| Décision | Choix retenu |
|---|---|
| Périmètre | **Les 37 composants**, port fidèle 1:1 — même nom, même API (props et valeurs par défaut), mêmes valeurs visuelles. |
| Mécanisme de style | **CSS Modules**, un `.module.css` par composant. |
| Interaction | Les états `hover` / `focus` passent du `useState` de la source à de **vrais sélecteurs CSS** (`:hover`, `:focus-visible`, `:disabled`). |
| Tokens | **Copiés tels quels**, jamais retranscrits (à l'exception de `fonts.css`, cf. §4). |
| Icônes | `lucide-react`, derrière l'API `Icon` existante. |
| Police | Geist via `next/font` côté apps, pas via Google Fonts. |
| Site marketing | Vivra dans une nouvelle app `apps/marketing` (spec 4, hors de ce document). |

### Pourquoi CSS Modules plutôt que les styles inline de la source

Le port littéral aurait recopié le pattern de la source :

```js
const [hover, setHover] = React.useState(false);
const [focus, setFocus] = React.useState(false);
// … style={{ ...v.base, ...(hover ? v.hover : null),
//            boxShadow: focus ? 'var(--ring-accent)' : v.base.boxShadow }}
```

Trois raisons de ne pas le faire, sans perdre en fidélité visuelle :

1. **`'use client'` partout.** `useState` sur le hover force chaque composant en Client Component,
   y compris `Card`, `Badge` ou `MetricCard` qui n'ont aucun besoin d'être interactifs. Les deux
   apps sont en App Router : c'est du JS envoyé au navigateur pour rien.
2. **Le ring de focus apparaît aussi à la souris.** `onFocus` ne distingue pas le clavier du clic.
   Le README du handoff décrit un ring de focus, pas un anneau au clic — `:focus-visible` est le
   sélecteur qui produit le comportement décrit.
3. **`onMouseEnter` ne couvre pas le tactile ni le clavier.** `:hover` est géré par le navigateur.

Les **valeurs** ne changent pas : elles viennent des mêmes `var(--*)`. Ce qui change, c'est le
mécanisme qui les applique. Le port est fidèle au rendu, et plus correct que la source sur les
états.

---

## 3. Architecture

```
packages/ui/
  package.json                exports "." et "./styles.css"
  tsconfig.json
  src/
    tokens/
      fonts.css               ─┐
      palette.css              │
      semantic.css             │
      typography.css           │  copiés verbatim depuis le handoff.
      spacing.css              │  Aucune édition, aucune reformulation.
      radius.css               │
      elevation.css            │
      motion.css               │
      base.css                ─┘
    styles.css                 @import des 9 + @theme Tailwind v4
    lib/
      cn.ts                    concaténation de classes
      icons.ts                 map nom lucide-static → composant lucide-react
    components/
      core/                    Badge Button Card Icon IconButton Input Pill Select StatusDot
      data/                    DataTable EventList MetricCard MetricGrid ProgressBar
                               Sparkline TimeSeriesChart
      feedback/                AlertBanner EmptyState ErrorState LoadingSkeleton
                               SeverityBadge Toast ToastStack
      layout/                  AppShell DashboardGrid GridItem SplitPane StatusStrip
      navigation/              Breadcrumb Sidebar Tabs Toolbar
      webrtc/                  LatencyChip PeerCard QualityIndicator RoomCard VideoTile
    index.ts                   barrel d'export
```

Un composant = un dossier `Nom/` contenant `Nom.tsx`, `Nom.module.css` et `index.ts`. `ToastStack`
vit avec `Toast`, `GridItem` avec `DashboardGrid` — comme dans la source.

### Distribution

Le package exporte du **TSX source**, pas un build. Les deux apps ajoutent `@sightline/ui` à
`transpilePackages` dans leur `next.config.ts`. Pas d'étape de build, pas de watcher, pas de
`dist/` à garder synchronisé.

`package.json` :

```json
{
  "name": "@sightline/ui",
  "exports": {
    ".": "./src/index.ts",
    "./styles.css": "./src/styles.css"
  },
  "dependencies": { "lucide-react": "^0.469.0" },
  "peerDependencies": { "react": "^19", "react-dom": "^19" }
}
```

`lucide-react` est épinglé sur la même version majeure que le `lucide-static@0.469.0` que la source
allait chercher sur unpkg — mêmes glyphes.

---

## 4. Tokens

Les 9 fichiers sont copiés sans modification. Ils définissent :

- **`palette.css`** — 14 neutres froids (`--n-0` → `--n-950`), indigo (accent), corail (axe rooms &
  sessions), 4 familles sémantiques (green / amber / red / blue) en 4 pas chacune, et 5 couleurs de
  série de graphe.
- **`semantic.css`** — les alias (`--surface-*`, `--border*`, `--text-*`, `--accent*`, `--ok`,
  `--warn`, `--danger`, `--info`, `--idle`) et leur redéfinition sous `.theme-dark`.
- **`typography.css`** — `--font-sans`, 9 tailles (11 → 44px), 4 hauteurs de ligne, 5 graisses,
  4 interlettrages. Pas de tier monospace.
- **`spacing.css`** — échelle `--space-0` → `--space-12`, plus `--sidebar-w:248px`,
  `--rail-w:340px`, `--content-max:1360px`.
- **`radius.css`** — 8 / 12 / 14 / 18 / 24px + pill.
- **`elevation.css`** — 4 ombres neutres, `--ring-accent`, `--ring-danger`, redéfinis en dark.
- **`motion.css`** — 3 durées (120 / 180 / 260ms), 2 courbes, et les keyframes `sl-breathe` /
  `sl-shimmer`.
- **`base.css`** — reset, styles de `body`, et les 3 classes utilitaires du système : `.sl-num`
  (chiffres tabulaires), `.sl-label` (micro-label 11px capitales), `.sl-scroll`.
- **`fonts.css`** — l'`@import` Google Fonts. **Seul fichier édité** : l'import est retiré, Geist
  arrive par `next/font` côté apps ; `--font-sans` reste défini et pointe sur la variable CSS que
  `next/font` expose.

`styles.css` importe les 9 puis ajoute un bloc `@theme` Tailwind v4 qui **référence** les variables
sans les redéfinir, pour que les apps disposent des mêmes valeurs en utilitaires quand elles font de
la mise en page hors composants :

```css
@theme {
  --color-accent: var(--accent);
  --color-surface-card: var(--surface-card);
  /* … */
}
```

C'est un pont, pas une seconde source de vérité. Si les deux divergent un jour, `tokens/` gagne.

---

## 5. Convention de port

Pour chaque composant, la même méthode mécanique :

1. Lire la fonction dans `_ds_bundle.js` (les numéros de ligne sont dans l'annexe A).
2. Reprendre **la signature à l'identique** — mêmes noms de props, mêmes valeurs par défaut.
3. Les styles inline statiques deviennent des règles du `.module.css`, valeurs inchangées.
4. Les styles conditionnés par un état d'interaction (`hover`, `focus`) deviennent `:hover`,
   `:focus-visible`, `:disabled`.
5. Les styles conditionnés par une **prop** (`variant`, `tone`, `size`, `severity`, `status`)
   deviennent des classes composées via `cn()`.
6. Les styles calculés à partir d'une **valeur runtime** (largeur d'une `ProgressBar`, géométrie
   d'une `Sparkline`, `ratio` d'une `VideoTile`) restent en style inline — c'est leur nature.
7. La prop `style` d'échappement est conservée partout et s'applique en dernier, comme dans la
   source.
8. `'use client'` **uniquement** sur les composants qui utilisent eux-mêmes un hook, une ref ou une
   API navigateur. Voir ci-dessous : après conversion, il n'en reste **qu'un**.

### Combien de composants restent des Client Components

Relevé exhaustif des hooks dans `_ds_bundle.js` : sur les 37 composants, **12 seulement** utilisent
un hook, et dans 10 cas sur 12 l'unique état est `hover` ou `focus` — celui que les CSS Modules
suppriment.

| Composant | Hooks dans la source | Après conversion |
|---|---|---|
| `Button`, `IconButton`, `DataTable`, `Sidebar`, `Tabs`, `PeerCard`, `RoomCard` | `useState(hover)` | Server Component |
| `Input`, `Select` | `useState(focus)` | Server Component |
| `Icon` | `useState(svg)` + `useEffect` (fetch) | Server Component — l'état disparaît avec `lucide-react` |
| `EventList` | `useRef` + `useEffect` (autoScroll) | **`'use client'`** — seul cas réel |
| Les 25 autres | aucun | Server Components |

Autrement dit : la conversion fait passer 36 composants sur 37 en Server Components. C'est le gain
principal du choix CSS Modules, et c'est un critère vérifiable — un `'use client'` sur autre chose
qu'`EventList` doit être justifié.

Note : un composant qui se contente de **transmettre** `onClick` ou `onChange` (`Button`,
`Breadcrumb`, `Toolbar`…) n'a pas besoin de `'use client'` ; c'est son appelant, dans l'app, qui est
le Client Component.

### Le composant `Icon`

La source résout un nom vers une URL et fait un `fetch` :

```js
const CDN = 'https://unpkg.com/lucide-static@0.469.0/icons/';
const url = root + name + '.svg';
// fetch(url) → dangerouslySetInnerHTML
```

Le port garde **l'API** (`<Icon name="radio-tower" size={16} strokeWidth={1.75} />`) et remplace la
résolution : `lib/icons.ts` mappe le nom kebab-case de lucide-static vers le composant PascalCase de
`lucide-react`. Plus de réseau, plus de flash au montage, plus de `dangerouslySetInnerHTML`, et les
écrans se portent sans réécrire un seul appel. Les props `base` et le global
`window.SIGHTLINE_ICON_BASE` disparaissent — ils n'ont plus d'objet ; c'est le seul écart d'API
assumé des 37.

### Dark mode

Aucun composant n'a de branche dark. Le thème est porté par la classe `.theme-dark`, qui re-pointe
les alias de `semantic.css` et `elevation.css`. Le port conserve ça strictement : si un composant a
besoin de savoir s'il est en dark, c'est un bug de port.

---

## 6. Les 37 composants

Signatures relevées dans le bundle — le port doit les reproduire exactement.

**core** (9)

```
Badge(children, tone='neutral', uppercase=false, solid=false, style)
Button(children, variant='secondary', size='md', disabled=false, block=false, icon=null,
       trailing=null, type='button', onClick, style, ...rest)
Card(title, meta, actions, children, padded=true, footer, style, bodyStyle, headerStyle)
Icon(name, size=16, strokeWidth=1.75, base, style, ...rest)
IconButton(children, label, size=32, active=false, disabled=false, tone='default', onClick,
           style, ...rest)
Input(label, hint, error, prefix, suffix, size='md', style, wrapperStyle, ...rest)
Pill(children, status, count, tone='neutral', style)
Select(label, options=[], value, onChange, size='md', style, wrapperStyle, ...rest)
StatusDot(status='idle', size=8, halo=true, style)
```

`Button` a 5 variants : `primary`, `secondary`, `quiet`, `danger`, `accentQuiet`.

**data** (7)

```
DataTable(columns=[], rows=[], onRowClick, selectedIndex, dense=false, style)
EventList(entries=[], height, autoScroll=false, dense=false, style)
MetricCard(label, value, unit, delta, deltaTone, status, sublabel, chart, align='left',
           compact=false, style)
MetricGrid(children, columns=4, divided=true, style)
ProgressBar(value=0, max=100, label, showValue=false, unit='%', tone='accent', height=6,
            threshold, indeterminate=false, style)
Sparkline(data=[], width=120, height=32, tone='accent', fill=true, threshold, strokeWidth=1.5,
          dot=true, style)
TimeSeriesChart(series=[], labels=[], height=180, threshold, thresholdLabel, yTicks=4, unit='',
                cursor, style)
```

`Sparkline` et `TimeSeriesChart` sont du SVG calculé — ils gardent leurs styles inline. Ce sont les
deux seuls endroits où le système autorise un dégradé : le fade vertical 14–16% → 0 sous la courbe,
dans la couleur de la courbe.

**feedback** (7)

```
AlertBanner(severity='warning', title, message, meta, action, onDismiss, style)
EmptyState(icon='radio-tower', title, hint, action, compact=false, style)
ErrorState(title='Something failed', message, code, detail, action, style)
LoadingSkeleton(variant='rows', rows=4, columns=4, style)
SeverityBadge(severity='info', label, showIcon=true, style)
Toast(severity='info', title, message, time, onDismiss, style)
ToastStack(children, placement='bottom-right', style)
```

`LoadingSkeleton` embarque un sous-composant `Bar` non exporté ; il reste interne.

**layout** (5)

```
AppShell(sidebar, toolbar, footer, children, maxWidth, theme, style)
DashboardGrid(children, columns=12, gap='var(--gap-grid)', minColumn=280, auto=false, style)
GridItem(children, span=12, rowSpan, style)
SplitPane(left, right, railWidth=340, gap='var(--gap-grid)', reverse=false, style)
StatusStrip(left, items=[], style)
```

**navigation** (4)

```
Breadcrumb(items=[], onSelect, style)
Sidebar(items=[], activeId, onSelect, brand='Sightline', brandMeta, footer, width=248, style)
Tabs(tabs=[], activeId, onSelect, variant='underline', style)
Toolbar(left, right, children, sticky=false, style)
```

`Sidebar` et `Tabs` ont chacun un sous-composant interne (`Row`, `Tab`) qui reste non exporté.

**webrtc** (5)

```
LatencyChip(value, unit='ms', metric='rtt', label, plain=false, style)
PeerCard(peerId, status='connected', score, rtt, jitter, loss, codec, tracks=[], region, samples,
         selected=false, onClick, style)
QualityIndicator(level='unknown', score, showLabel=false, size=14, style)
RoomCard(roomId, peers=0, uptime, bitrate, health='ok', samples, region, onClick, style)
VideoTile(label, sublabel, status='live', empty=false, emptyText='No stream', overlay, children,
          ratio='16/10', style)
```

`onSelect` / `onSelect`-likes et `onRowClick` gardent leurs signatures d'origine : les écrans du
handoff les appellent telles quelles.

---

## 7. Intégration côté apps

Pour chaque app (`dashboard`, `sightline-cloud`, et plus tard `marketing`) :

1. `@sightline/ui` en dépendance de workspace.
2. `transpilePackages: ['@sightline/ui']` dans `next.config.ts`.
3. `import '@sightline/ui/styles.css'` dans `app/globals.css` ou le layout racine.
4. Geist par `next/font`, avec sa variable CSS branchée sur `--font-sans`.

`apps/dashboard` déclare déjà Geist via `next/font` — c'est ce qui a décidé la famille du design
system. On reprend cette déclaration.

---

## 8. Vérification

Pas de tests unitaires sur du visuel : ils ne prouveraient rien sur la fidélité. Le critère est un
rendu comparé.

**La galerie.** Une route `/_ds` dans `apps/dashboard` qui rend les 37 composants dans toutes leurs
variantes documentées — les 5 variants et 3 tailles de `Button`, les 7 tons de `Badge`, les 4
sévérités d'`AlertBanner`, etc. — d'abord en thème clair, puis le même bloc enveloppé dans
`.theme-dark`. Cette route est un outil de développement, pas une surface produit ; elle reste dans
le repo et sert de garde-fou aux specs 2 à 4.

**Le protocole.** Ouvrir `designs/Dashboard UI.dc.html` dans un navigateur (tout est relatif, ça
marche en local) et comparer côte à côte avec `/_ds`. Un composant est porté quand son rendu est
indiscernable dans les deux thèmes.

**Definition of done :**

- [ ] Les 37 composants exportés depuis `@sightline/ui`, signatures conformes à la section 6.
- [ ] Les 9 fichiers de tokens présents, `fonts.css` mis à part identiques au handoff au diff près.
- [ ] `/_ds` rend tout, en clair et en dark, sans erreur console.
- [ ] `bun run check-types` vert sur le monorepo.
- [ ] `bun run lint` vert sur le monorepo.
- [ ] `bun run build` vert sur `apps/dashboard`.
- [ ] `EventList` est le seul composant portant `'use client'` (cf. §5).
- [ ] Aucune couleur en dur : tout passe par `var(--*)`.

---

## 9. Risques et hypothèses

**À vérifier en premier — les CSS Modules depuis un package de workspace.** Next.js a
historiquement restreint l'import de CSS depuis `node_modules`. Les CSS Modules via
`transpilePackages` sont supportés, mais ça doit être confirmé sur Next 16.3.2 **avant** d'écrire
37 composants sur cette hypothèse. C'est la première tâche du plan : un composant jetable avec un
`.module.css`, importé dans `apps/dashboard`, et on regarde s'il est stylé. Si ça ne passe pas, le
repli est un fichier CSS global unique dans le package, avec des classes préfixées `sl-` — même
mécanisme de sélecteurs, sans le scoping automatique.

**Hypothèses assumées :**

- **Les icônes.** Le handoff signale lui-même Lucide comme « une substitution à confirmer » : le
  repo n'embarque aucun set. On la garde.
- **Pas de logo.** La marque est le mot « Sightline » en Geist 600 / −0.02em, précédé d'un carré
  20px radius 6px en `--accent`. C'est ce que fait `Sidebar` par défaut. Un vrai mark le remplacera.
- **`packages/auth`, `packages/db`, `packages/env`, `packages/config` sont vides** et le restent :
  le design system n'en dépend d'aucun. Rien n'y est touché.
- **`apps/sightline-cloud/.git`** est un dépôt imbriqué (le repo privé `sightline-cloud`). Rien n'y
  sera commité dans ce sous-projet.
- **Les données des maquettes sont inventées.** Seuls les noms de métriques et les seuils sont
  réels : `packet_loss_ratio` > 2%, `jitter_ms` > 30ms, `rtt_ms` > 200ms, `nack_ratio` > 5%,
  `freeze_ratio` > 1%, `bitrate_kbps` < 100kbps. Ils n'entrent pas dans `packages/ui` — les
  composants reçoivent des valeurs, ils ne connaissent pas de seuil par défaut.

---

## 10. Hors périmètre

Explicitement **pas** dans ce sous-projet :

- Les 9 écrans. Ils font l'objet des specs 2 à 4.
- Le moteur d'animation marketing (`data-anim`, IntersectionObserver, barre de progression de
  scroll, spotlight, titres mot-à-mot). Il appartient à `apps/marketing`, pas au design system —
  aucun des 37 composants ne s'en sert.
- Les breakpoints responsive. Les maquettes sont desktop-first à 1280px ; les grilles produit
  utilisent déjà `repeat(auto-fit, minmax(…, 1fr))` et suivent. Les grilles marketing en colonnes
  fixes devront recevoir des breakpoints — au moment de leur port.
- Toute donnée live. Le branchement sur le `/metrics` du SFU appartient à la spec `apps/dashboard`.

### Ce qui suit

| # | Sous-projet | Dépend de |
|---|---|---|
| 1 | `packages/ui` — ce document | — |
| 2 | `apps/dashboard` — 9 vues, mocks, puis `/metrics` du SFU | 1 |
| 3 | `apps/sightline-cloud` — console, Sign up, Onboarding 5 étapes | 1 |
| 4 | `apps/marketing` — Home, Pricing, Compare, Docs, Changelog + moteur d'animation | 1 |

**Note pour la spec 2.** `_ds_bundle.js` contient aussi des écrans dashboard complets en React
(`OverviewScreen`, `RoomsScreen`, `RoomDetailScreen`, `AlertsScreen`, `ReplayScreen`,
`DashboardApp`, `SessionConsole`, `mock.js`). Comparés à `Dashboard UI.dc.html`, ils sont **en
retard** : 5 vues au lieu de 9, fil d'Ariane « Fleet » au lieu d'« Instance », pas de toggle de
topologie, et un `EmptyState` « No design exists for x yet ». Le `.dc.html` fait foi. Mais les deux
partagent le même modèle de données — le `.dc.html` appelle `series(30, 1, 2400, 340)`, la
signature exacte du `mock.js` du bundle. La spec 2 récupérera donc les mocks du bundle tels quels et
lira ses écrans comme référence d'implémentation, sans les porter.

---

## Annexe A — index des composants dans `_ds_bundle.js`

| Composant | Ligne | Composant | Ligne |
|---|---|---|---|
| Badge | 22 | SeverityBadge | 1595 |
| Button | 76 | Toast | 1655 |
| Card | 187 | ToastStack | 1733 |
| Icon | 271 | AppShell | 1769 |
| IconButton | 322 | DashboardGrid | 1817 |
| Input | 369 | GridItem | 1836 |
| Select | 442 | SplitPane | 1859 |
| StatusDot | 531 | StatusStrip | 1898 |
| Pill | 559 | Breadcrumb | 1947 |
| DataTable | 605 | Sidebar | 2004 |
| EventList | 683 | Tabs | 2130 |
| MetricCard | 734 | Toolbar | 2204 |
| MetricGrid | 817 | LatencyChip | 2255 |
| ProgressBar | 845 | QualityIndicator | 2319 |
| Sparkline | 930 | PeerCard | 2368 |
| TimeSeriesChart | 1013 | RoomCard | 2482 |
| AlertBanner | 1220 | VideoTile | 2587 |
| EmptyState | 1302 | | |
| ErrorState | 1360 | | |
| LoadingSkeleton | 1459 | | |
