# Site marketing Sightline (`apps/web`) — Design

**Date :** 2026-08-30
**Statut :** approuvé, prêt pour le plan d'implémentation
**Source de design :** `~/Downloads/design_handoff_sightline/` (noté `$HANDOFF` dans ce document)

## 1. Contexte

Le handoff de design contient neuf maquettes hi-fi couvrant trois surfaces : le site
marketing, la console Cloud et le dashboard d'observabilité. Le design system a déjà été
porté dans `packages/ui` (41 exports : 9 fichiers de tokens et 35 composants). Aucune de
ces maquettes n'a encore été implémentée en écran réel.

Le travail a été découpé en trois sous-projets indépendants, chacun avec son propre cycle
spec → plan → implémentation :

| | Sous-projet | Cible | État |
| --- | --- | --- | --- |
| **A** | Site marketing | `apps/web` (à créer) | **ce document** |
| B | Dashboard d'observabilité | `apps/dashboard` | à spécifier |
| C | Console Cloud | `apps/sightline-cloud` | à spécifier |

A passe en premier : c'est la surface demandée en priorité, elle ne dépend d'aucun
backend, et elle valide le design system sur des écrans réels avant qu'on touche au
produit.

## 2. Objectif

Construire `apps/web`, une application Next.js qui reproduit fidèlement les six maquettes
marketing du handoff, en consommant `@lumyx/ui` et ses tokens.

**Critère de succès :** les six pages sont visuellement indiscernables de leur maquette à
1280px, elles tiennent la route de 360px à 1920px, `bun run build` et
`bun run check-types` passent, et aucune couleur n'est écrite en dur hors des fichiers de
tokens.

## 3. Périmètre

**Dans le périmètre — six pages :**

| Route | Maquette | Lignes |
| --- | --- | --- |
| `/` | `$HANDOFF/designs/Home.dc.html` | 759 |
| `/pricing` | `Pricing.dc.html` | 404 |
| `/compare/livekit` | `Compare LiveKit.dc.html` | 361 |
| `/docs` | `Docs.dc.html` | 298 |
| `/changelog` | `Changelog.dc.html` | 255 |
| `/signup` | `Sign up.dc.html` | 312 |

**Hors périmètre :** toute authentification réelle, toute base de données, tout appel
réseau sortant, les écrans Onboarding / Cloud UI / Dashboard UI (sous-projets B et C), et
la création d'un logo (le handoff confirme qu'il n'en existe aucun — la marque est le mot
« Sightline » en Geist 600 précédé d'un carré 20px `--accent` en radius 6px).

## 4. Décisions arrêtées

Quatre décisions ont été prises pendant le brainstorming et ne sont pas rouvertes par
l'implémentation.

**4.1 — Tailwind pour le layout, CSS Modules pour le reste, tokens partout.** C'est la
frontière que `apps/dashboard` applique déjà (68 `className` mêlant utilitaires Tailwind,
classes du design system et `var(--*)`), et pour laquelle `packages/ui/src/styles.css`
fournit un pont `@theme` délibéré — dix-neuf tokens sémantiques exposés en couleurs
Tailwind, avec le conflit de `--font-sans` contre le preflight déjà résolu. Le commentaire
de ce fichier dit explicitement que le pont « sert la mise en page au niveau des apps, pas
les composants ».

| | Outil |
| --- | --- |
| Layout de page, flux, espacement, breakpoints | utilitaires Tailwind (`flex`, `grid`, `gap-6`, `px-10`, `max-w-*`, `md:`, `lg:`) |
| Typo display, grilles à ratios exacts, dégradés, ombres composées, keyframes | CSS Modules (`Nom.module.css`) |
| **Toute couleur, tout rayon, toute durée** | **token `var(--*)`, sans exception** |

La troisième ligne est la seule règle non négociable, et c'est celle que `verify:ds`
vérifie. Le critère pour trancher entre les deux premières : une valeur qui existe dans
l'échelle du système passe en utilitaire, une valeur hors échelle passe en CSS. Écrire
`text-[62px] tracking-[-0.035em] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]` en classes
arbitraires ne gagne rien sur du CSS écrit et se relit mal — c'est exactement le cas des
titres marketing et des grilles à ratios.

**4.2 — Contenu en TypeScript, pas de MDX.** Docs se limite à la page maquettée
(référence des six métriques et « Overriding a threshold ») et Changelog à une liste de
releases. Les deux lisent des constantes typées de `content/`. On ajoutera une couche MDX
le jour où il y aura réellement une arborescence de documentation à écrire ; aujourd'hui
elle imposerait son propre layout qu'il faudrait rehabiller pour retomber sur la maquette.

**4.3 — Sign up en UI seule.** Les étapes sont reproduites avec leur state local ; les
soumissions n'appellent rien et portent un `TODO` explicite pointant vers le sous-projet C.
`packages/auth` et `packages/db` sont des coquilles vides (un `package.json` et un
`README` chacune) et le modèle Cloud n'est pas validé : brancher l'inscription maintenant
préempterait des décisions qui appartiennent à C.

**4.4 — Les chiffres des maquettes, centralisés et marqués.** Le site affiche ce que
montrent les maquettes, mais chaque valeur non vérifiée vit dans `content/pricing.ts` ou
`content/benchmarks.ts`, avec un en-tête `UNVERIFIED` qui dit d'où vient le chiffre et ce
qui le remplacera. Aucun prix, quota ou benchmark n'est écrit en dur dans du JSX.

## 5. Architecture de l'application

### 5.1 Création et configuration

L'app est créée avec le CLI de bun :

```bash
bun create next-app apps/web --ts --app --tailwind --no-src-dir --eslint \
  --use-bun --import-alias "@/*"
```

Si le CLI pose malgré tout une question interactive (Turbopack, par exemple), on répond
par le défaut proposé : tout ce qui compte est réécrit à l'étape suivante.

Puis alignée sur le monorepo :

- `name: "@sightline/web"`, `private: true`
- Next épinglé à **16.3.2**, React **19.2.8**, comme `apps/dashboard` et
  `apps/sightline-cloud` (via le catalogue bun de la racine quand la dépendance y figure)
- `"dev": "next dev --port 3002"` — 3000 est pris par le dashboard, 3001 par le cloud
- `next.config.ts` : `transpilePackages: ['@lumyx/ui']`
- `@lumyx/ui` en `workspace:*`, `tailwindcss` et `@tailwindcss/postcss` en `^4` comme
  les deux autres apps
- `globals.css` importe `@lumyx/ui/styles.css` **avant** `tailwindcss`, dans cet ordre
  exact — c'est l'ordre de `apps/dashboard`, et celui que le pont `@theme` du design system
  suppose
- scripts `build`, `start`, `lint`, `check-types` identiques aux autres apps pour que
  Turborepo les prenne

### 5.2 Arborescence

```
apps/web/
  app/
    layout.tsx                 Geist (next/font), <MarketingMotion/>, <ScrollProgress/>
    globals.css                @lumyx/ui/styles.css + keyframes sl-* + reduced-motion
    page.tsx                   Home
    _sections/                 sections de Home
    pricing/page.tsx  + _sections/
    compare/livekit/page.tsx  + _sections/
    docs/page.tsx     + _sections/
    changelog/page.tsx
    signup/page.tsx   + _sections/
  components/
    chrome/                    SiteHeader · SiteFooter · Wordmark
    motion/                    MarketingMotion · ScrollProgress · Spotlight   (client)
    marketing/                 Section · DisplayHeading · HairlineGrid · CodeCard
  content/
    pricing.ts                 plans, grille comparative, FAQ, logique d'estimation
    benchmarks.ts              mémoire au repos, peers/core, p99
    metrics.ts                 les six métriques et leurs seuils
    releases.ts                changelog
    nav.ts                     navigation d'en-tête et colonnes de pied de page
```

Une section est un `Nom.tsx` qui porte ses utilitaires Tailwind en `className`, plus un
`Nom.module.css` frère dès qu'elle a du display typographique, une grille à ratios ou une
animation. Une section purement structurelle n'a pas de fichier CSS du tout.

Les sections sont colocalisées dans `_sections/` sous leur route : l'App Router ne route
que `page`, `layout` et `route`, donc un dossier préfixé reste hors du graphe d'URL tout
en gardant le code d'une page au même endroit. Ce qui est partagé par au moins deux pages
remonte dans `components/marketing/`.

`HairlineGrid` mérite d'être nommé : c'est le pattern récurrent du système — une grille en
`gap: 1px` posée sur un fond `--border-subtle`, où les cartes blanches peignent
elles-mêmes les filets. Le pricing inline de Home et les grilles de métriques en
dépendent.

### 5.3 Composants réutilisés depuis `packages/ui`

Les six maquettes consomment quinze composants déjà portés — aucun n'est à écrire :
`Button` (24 usages), `Badge` (10), `StatusDot` (6), `MetricCard` (5), `Tabs` (4),
`Input` (4), `IconButton` (2), `Icon` (2), `DataTable` (2), `AlertBanner` (2),
`SeverityBadge`, `Select`, `Pill`, `MetricGrid`, `Breadcrumb`.

Si un écart apparaît entre ce dont une page a besoin et ce que le composant expose, on
corrige le composant dans `packages/ui` plutôt que de le contourner localement — mais
seulement en ajoutant une prop optionnelle, jamais en changeant un défaut existant.

## 6. Le runtime de motion

C'est la seule décision d'architecture non triviale du sous-projet.

La source implémente les animations marketing par un attribut plus un observer global,
pas par un composant par élément. Home porte onze éléments animés. Le port conserve ce
modèle : **les sections restent des Server Components et ne portent que des attributs**,
un unique composant client monté dans le layout fait le travail.

### 6.1 Contrat d'attributs

| Attribut | Effet |
| --- | --- |
| `data-anim="rise \| fade \| slide"` | quel keyframe jouer (défaut `rise`) |
| `data-anim-delay="520"` | délai en millisecondes |
| `data-anim-now` | joue au montage, sans attendre l'intersection |
| `data-words` (+ `data-words-delay`) | découpe le texte en spans, cascade `sl-word` |
| `data-hero` / `data-spotlight` | zone de suivi de souris et calque éclairé |
| `data-progress` | barre de progression de scroll |

### 6.2 `<MarketingMotion />`

Un seul composant client, monté une fois dans `app/layout.tsx` :

1. Si `prefers-reduced-motion: reduce`, **il ne fait rien** et sort immédiatement. Les
   éléments n'ont jamais été masqués, donc tout reste visible et lisible. C'est le seul
   endroit du site où cette préférence est testée.
2. Sinon : les éléments `data-anim-now` jouent tout de suite ; les autres passent en
   `opacity: 0` puis sont observés par un `IntersectionObserver` à
   `{ threshold: 0.1, rootMargin: '0px 0px -6% 0px' }`, qui joue
   `sl-<kind> 560ms cubic-bezier(0.16,0.84,0.32,1) <delay>ms both` et se désabonne.
3. Un filet de sécurité à 6 secondes révèle tout élément resté masqué — un observer qui ne
   se déclenche jamais ne doit pas pouvoir rendre du contenu invisible.
4. Sans support d'`IntersectionObserver`, tout est joué immédiatement.

Les keyframes (`sl-rise`, `sl-fade`, `sl-slide`, `sl-word`, `sl-marquee`, `sl-beam`,
`sl-dash`) vivent dans `globals.css`, copiées telles quelles depuis le handoff.

### 6.3 Îlots client

Trois composants ont un vrai état interactif et sont client de façon explicite et
délimitée : `<Spotlight />` (dégradé radial de 460px suivant le pointeur sur le hero,
opacité 0 → 1 en 300ms), l'estimateur de Pricing, et le wizard de Sign up. Les onglets de
snippet de Home s'appuient sur `Tabs` de `packages/ui`.

### 6.4 Alternatives écartées

Un composant `<Reveal>` React par élément ferait basculer chaque section en client pour
une quarantaine d'observers, et le découpage mot-par-mot resterait une manipulation du DOM
de toute façon. `framer-motion` ou GSAP coûteraient une cinquantaine de kilo-octets pour
réencoder quatre keyframes dont on a déjà les valeurs exactes, et rendraient tout le site
client.

## 7. Les six pages

Les valeurs exactes (px, hex, radius, font-size) se lisent dans le template inline de
chaque `.dc.html` ; ce qui suit est la carte des sections, pas le relevé pixel par pixel.

### 7.1 `/` — Home

1. **En-tête** 64px, `border-bottom: 1px solid var(--border-subtle)` : wordmark, cinq
   liens de nav en 12.5px `--text-muted`, version en `.sl-num` 12px, bouton GitHub ghost
   32px radius 12px, `Button` primary sm.
2. **Hero sombre** (`.theme-dark`), grille `minmax(0,1.05fr) minmax(0,1fr)`, gap 56px,
   `padding: 84px 40px 0`. Deux calques décoratifs en absolu : une trame de points
   (`radial-gradient(var(--n-700) 1px, transparent 1px)` en `background-size: 24px 24px`,
   opacité .5, masquée par un `radial-gradient(130% 78% at 26% 0%)`) et le spotlight. À
   gauche : eyebrow `.sl-label` en `--accent-text`, h1 62px/600/`-0.035em`/lh 1.02
   révélé mot par mot, paragraphe 17px, deux CTA. À droite : `Tabs` et une carte de code.
3. **Carte « live » en chevauchement** : radius 18px, `--shadow-lg`, à cheval sur la fin du
   hero (bande `--n-900` de 120px en absolu derrière), en-tête `padding: 12px 18px` avec
   `StatusDot status="live"` sur fond `--surface-sunken`.
4. **Section « pains »**, trois blocs en grille 1fr/1fr, gap 44px, séparés par un
   `border-bottom`, index numéroté en `.sl-num` 12px `--text-faint`, l'ordre visuel des
   colonnes alternant par la propriété `order`.
5. **Comparatif LiveKit** condensé : grille `1.1fr 1fr 1fr`, en-tête `--surface-sunken` et
   `.sl-label`, wrapper radius 18px en `overflow: hidden`, lien vers `/compare/livekit`.
6. **Pricing inline** : `HairlineGrid` en `repeat(5, minmax(0,1fr))`, cellules en
   `padding: 24px 18px`, gap 14px.
7. **Open source**, puis **CTA final** : h2 52px/600/`-0.035em`, aligné à gauche,
   `padding: 88px 40px`.
8. **Pied de page** quatre colonnes.

État : onglets de snippet et spotlight. Le reste est statique.

### 7.2 `/pricing`

Le toggle mensuel/annuel, les cinq plans en cartes, la grille comparative en quatre
groupes (Usage, Observability, Alerting, Team & support), la FAQ en huit entrées, et
l'estimateur de coût.

**L'estimateur n'a qu'un seul curseur.** Le README du handoff annonce trois curseurs
(minutes, egress, régions) ; la classe de logique de `Pricing.dc.html` n'en implémente
qu'un — les participant-minutes — plus le toggle de période. **C'est le code qui fait foi.**

Le calcul, à porter à l'identique en fonction pure dans `content/pricing.ts` :

```
base Starter = 49 (mensuel) | 39 (annuel)
base Scale   = 499 (mensuel) | 399 (annuel)

minutes <= 10 000        -> Free, 0 €      (hard stop, pas d'overage facturé)
minutes  > 1 200 000     -> Business, Custom
sinon :
  starter = baseStarter + max(0, m -  50 000) * 0.0012
  scale   = baseScale   + max(0, m - 500 000) * 0.0009
  le moins cher des deux gagne, à égalité Starter l'emporte
  le coût est arrondi à l'euro et la note cite le coût de l'autre plan
```

La quatrième colonne (`Scale`, index 3) est mise en avant dans la grille comparative :
texte en `--text-strong` et fond `--accent-tint`, là où les autres colonnes sont en
`--text-muted` — ou `--text-faint` pour un tiret cadratin.

### 7.3 `/compare/livekit`

Cinq sections : le résumé en trois blocs numérotés (« Observability is the product », « One
binary to operate », « Human video, not agents »), la grille comparative en quatre groupes
(Architecture, Observability, Product scope, Licence & maturity), ce que Sightline
remplace, la migration en trois étapes avec ses diffs de code, et **« Cases where LiveKit
is still the better call »** en quatre entrées.

Cette dernière section reste intégralement. C'est une section d'honnêteté assumée par le
design : elle dit de ne pas migrer une charge qui dépend de l'enregistrement serveur ou de
l'egress, que les agents vocaux IA sont le terrain de LiveKit, que Sightline s'appuie sur
les SDK clients LiveKit sans support contractuel dessus, et que l'infrastructure est
jeune. **Ne pas la couper, ne pas l'adoucir.**

La visualisation de topologie utilise des traits SVG en `stroke-dasharray` animés par
`sl-beam` à l'arrivée puis `sl-dash` en flux continu.

### 7.4 `/docs`

Layout propre à la page : en-tête 60px sur `--surface-card`, contenu central, et un rail
de navigation **à droite** en `aside` avec `border-left` (le README du handoff le place à
gauche ; la maquette fait foi).

Le contenu est la référence des six métriques. Chacune est une section ancrée par son nom
de champ, avec le nom lisible, le champ brut, l'unité, le scope, le cas qui la fait
casser, un payload d'exemple et le seuil par défaut :

| Champ | Unité | Scope | Seuil |
| --- | --- | --- | --- |
| `packet_loss_ratio` | ratio, affiché en % | peer, room | > 2% |
| `rtt_ms` | millisecondes | peer | > 200ms |
| `jitter_ms` | millisecondes | peer | > 30ms |
| `nack_ratio` | ratio, affiché en % | peer | > 5% |
| `freeze_ratio` | ratio, affiché en % | peer | > 1% |
| `bitrate_kbps` | kilobits par seconde | peer, track, room | < 100kbps |

**Correction du 2026-08-30, après vérification contre le dépôt.** Ce paragraphe affirmait que
ces six lignes étaient « les seules données non inventées de tout le handoff », venues de la
référence des métriques du README. **C'est faux, et l'erreur était la mienne.**

Il n'existe aucune référence des métriques dans `README.md` : les six noms de champ n'y
apparaissent pas une seule fois. Le README dit l'inverse — `Quality metrics (jitter, loss, RTT,
NACK) — ❌ Planned, the whole point of the project — next milestone` — et
`apps/sfu/src/metrics/mod.rs` ne compte que `peers_connected`, `peers_disconnected` et deux
compteurs que le README lui-même décrit comme définis mais jamais incrémentés.

L'affirmation venait du `github.md` du handoff, que j'ai reprise sans la vérifier. Les six
métriques et leurs seuils sont **inventés par le design, au même titre que les prix**, et la
fonctionnalité qu'ils décrivent n'existe pas encore.

Conséquence : `content/metrics.ts` porte un en-tête `UNVERIFIED` comme `pricing.ts` et
`benchmarks.ts`, et la page Docs documente une API **prévue**, pas une API livrée. Publier
cette page en l'état ferait dire au site l'inverse de ce que dit le README du dépôt. La
décision — publier avec une mention « planned », différer la page, ou implémenter les métriques
d'abord — appartient au propriétaire du dépôt.

Suit la section « Overriding a threshold » et son exemple
`PATCH /v1/projects/live-classroom/thresholds`.

Le rail de navigation surligne la section courante au scroll : un petit composant client
sur `IntersectionObserver`, indépendant de `MarketingMotion`.

### 7.5 `/changelog`

Une entrée par release — version, date, hash de commit court, et le badge « latest » sur
la plus récente — depuis `content/releases.ts`. Entièrement statique, aucun état.

### 7.6 `/signup`

Le wizard fait **deux étapes et un écran final**, pas trois étapes : l'état est
`account | project | keys`, et le stepper affiche « Step 1 of 2 », « Step 2 of 2 », puis
« Done ». Le README du handoff parle de trois étapes ; le code fait foi.

- **account** — création de compte.
- **project** — nom, région (`eu-west-3` par défaut), bascule staging, choix de SDK.
- **keys** — les clés à l'écran, et la confirmation « live-classroom is live ».

Une colonne latérale porte les quatre arguments de vente (projet prêt en 30 secondes,
signaling LiveKit drop-in, six métriques armées par défaut, spend cap dès la première
minute).

Chaque soumission appelle un handler qui ne fait rien et porte un commentaire
`TODO(sous-projet C)` nommant ce qu'il devra appeler. Le wizard avance malgré tout, pour
que le parcours soit démontrable de bout en bout.

## 8. Contenu et constantes

Tout le contenu éditorial vit dans `content/`, en TypeScript typé, jamais dans du JSX.

`pricing.ts` et `benchmarks.ts` portent en tête un bloc de commentaire :

```ts
// UNVERIFIED — chiffres proposés par le handoff de design, non validés produit.
// Origine : $HANDOFF/designs/Pricing.dc.html (const PLANS, PRICING_GROUPS).
// Le modèle Cloud (plans, quotas, unités, prix) doit être confirmé contre
// sightline-cloud avant toute mise en ligne publique.
```

`benchmarks.ts` remplace les mentions « benchmark pending » de Home et Pricing et attend
trois mesures Rust réelles : mémoire au repos, peers par cœur, latence p99.

`metrics.ts` porte le même avertissement que les autres. Il était présenté ici comme la seule
constante vérifiée ; la vérification contre le dépôt a montré le contraire (voir §7.4).

## 9. Responsive

Les maquettes sont desktop-first à 1280px et le handoff dit explicitement que les
breakpoints sont à ajouter au port. Les grilles produit utilisent déjà
`repeat(auto-fit, minmax(…, 1fr))` ; les grilles marketing sont en colonnes fixes et
doivent être traitées une par une.

Les paliers s'écrivent en breakpoints Tailwind, ce qui évite de répéter trois blocs
`@media` dans chaque module CSS. On travaille mobile-first, donc la base est la colonne
unique et les préfixes ajoutent les colonnes :

| Palier | Préfixe | Comportement |
| --- | --- | --- |
| < 768px | (base) | une colonne, h1 62 → 40px, h2 40 → 30px, CTA 52 → 34px, nav repliée, `px-5` |
| 768–1119px | `md:` | grilles deux colonnes rétablies, pricing 5 colonnes en 3 puis 2, `md:px-6` |
| ≥ 1120px | `lg:` | la maquette telle quelle, `max-w-[1280px]`, `lg:px-10` |

Les tailles de titre, elles, restent en CSS Modules : ce sont des valeurs hors échelle et
elles changent à chaque palier, donc leurs trois valeurs se lisent mieux groupées dans un
`@media` du module que dispersées en `text-[40px] md:text-[62px]` sur le JSX.

La grille comparative de Pricing et celle de Compare LiveKit, à six et cinq colonnes, ne
peuvent pas se replier proprement : elles défilent horizontalement dans leur propre
conteneur en `overflow-x: auto`, la colonne de libellés restant collée à gauche. **Le
`body` ne défile jamais horizontalement.**

## 10. Vérification

**En TDD :** l'estimateur de coût de `content/pricing.ts` est la seule vraie logique du
sous-projet, et c'est de l'arithmétique de facturation — donc tests d'abord. Les cas qui
comptent : la borne exacte de 10 000 minutes, le hard stop du Free, le franchissement à
50 000 et 500 000 minutes, le point de bascule où Scale devient moins cher que l'overage
de Starter, la borne Business à 1,2 M, l'égalité qui doit retomber sur Starter, et les
bases annuelles à 39 et 399.

**Automatique :** `verify:ds` étendu à `apps/web` (aucun hex, `rgb(` ou `rgba(` hors
`packages/ui/src/tokens/`), `bun run check-types`, `bun run build`, `bun run lint`.

**Visuel :** chaque page est comparée côte à côte avec sa maquette ouverte dans un
navigateur, à 1280px, puis relue aux trois paliers responsive. Une passe finale vérifie
qu'avec `prefers-reduced-motion: reduce` forcé, les six pages sont intégralement lisibles
et qu'aucune animation ne joue.

## 11. Ordre d'implémentation

1. **Fondations** — scaffold, `package.json`, `next.config.ts`, `globals.css` et ses
   keyframes, `layout.tsx`, `SiteHeader`, `SiteFooter`, `MarketingMotion`,
   `ScrollProgress`, `Spotlight`, extension de `verify:ds`.
2. **Home** — la page la plus lourde, et celle qui exerce le plus de primitives partagées.
3. **Pricing** — l'estimateur en TDD d'abord, la page ensuite.
4. **Compare LiveKit** — dont les beams SVG.
5. **Docs** — dont `content/metrics.ts`, partagé avec le sous-projet B.
6. **Changelog**.
7. **Sign up**.
8. **Passe finale** — responsive aux trois paliers, `prefers-reduced-motion`, build.

## 12. Risques et réserves

**Les chiffres publiés ne sont pas validés.** Prix, quotas, unités de facturation et
benchmarks viennent tous d'une proposition de design faite sans accès au repo cloud. Le
site est constructible et démontrable en l'état, mais **ne doit pas être déployé
publiquement** avant que `content/pricing.ts` et `content/benchmarks.ts` aient été
confirmés. C'est un risque de communication produit, pas un risque technique.

**`apps/sightline-cloud` est un dépôt git imbriqué** dans l'arbre de travail sans être
déclaré comme sous-module — `git status` le voit comme une entrée modifiée opaque. Ce
sous-projet n'y touche pas, mais il faudra trancher avant le sous-projet C.

**Le README du handoff diverge du code sur deux points** relevés ici : le nombre de
curseurs de l'estimateur (un, pas trois) et le nombre d'étapes de Sign up (deux plus un
écran final, pas trois). En cas de nouvel écart, **le `.dc.html` fait foi** — c'est lui
qui a été rendu et validé.

**Lucide est une substitution à confirmer.** Le handoff vendorise 49 SVG Lucide rendus à
16px en stroke-width 1.75, mais note que le repo n'embarque aucun set d'icônes et que ce
choix reste à valider. Le port suit `packages/ui`, qui a déjà tranché.

## 13. Annexe — correspondance maquette / route

| Maquette | Route | Composants `@lumyx/ui` principaux |
| --- | --- | --- |
| `Home.dc.html` | `/` | Button, Badge, Tabs, StatusDot, MetricCard, DataTable |
| `Pricing.dc.html` | `/pricing` | Button, Badge, Tabs, Input |
| `Compare LiveKit.dc.html` | `/compare/livekit` | Button, Badge, Pill |
| `Docs.dc.html` | `/docs` | DataTable, Badge, Breadcrumb, Icon |
| `Changelog.dc.html` | `/changelog` | Badge, StatusDot |
| `Sign up.dc.html` | `/signup` | Button, Input, Select, Badge, AlertBanner |
