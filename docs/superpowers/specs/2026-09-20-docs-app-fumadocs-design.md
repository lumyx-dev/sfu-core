# Design — app de documentation dédiée : `apps/docs` sur Fumadocs, skinnée Lumyx

Date : 2026-09-20
Statut : validé, prêt pour le plan d'implémentation

---

## 1. Contexte

La documentation Lumyx vit aujourd'hui dans `apps/landing/app/docs/` : cinq pages `.tsx`
écrites à la main (`page.tsx`, `quickstart/`, `self-hosting/`, `cloud/`, `metrics-reference/`)
posées sur un shell maison, `apps/landing/components/site/docs-layout.tsx`, qui rend une nav
de section à gauche, une colonne de contenu et un rail de TOC à droite.

Quatre limites constatées à l'exploration :

1. **La nav promet plus que le contenu.** `apps/landing/lib/docs-data.ts` déclare `DOC_NAV`
   avec seize entrées réparties en quatre sections. Onze n'ont pas de `href` et sont rendues
   en texte grisé non cliquable — des entrées mortes visibles par le visiteur.
2. **Quatre choses à synchroniser à la main par page.** Chaque page passe à `DocsLayout` un
   `crumb`, un `activeId`, un tableau `toc` saisi à la main et un `title`/`description`. Rien
   n'est dérivé du contenu ; tout dérive du soin de l'auteur.
3. **Pas de recherche.** Aucune primitive de recherche, ni index, ni raccourci clavier.
4. **La doc est couplée au cycle de vie du site marketing.** Corriger une phrase dans la
   référence des métriques redéploie la home.

Ce document définit une app Next dédiée, `apps/docs`, bâtie sur Fumadocs v16 et habillée avec
le design system Lumyx, ainsi que la migration du contenu existant vers elle.

### Périmètre

| Dans le périmètre | Hors périmètre |
| --- | --- |
| `apps/docs` : app Next 16 + Fumadocs v16 | Rédaction du corps des 11 pages manquantes |
| Pont de tokens Fumadocs → Lumyx | Éjection de composants `fumadocs-ui` |
| Palier monospace dans `packages/ui` | Bascule de la landing en monospace |
| Amendement de `verify:ds` (règle 2) | `.git` imbriqué et `bun.lock` local d'`apps/landing` |
| Migration des 5 pages existantes en MDX | Consolidation du snippet `docker run` dupliqué |
| Squelettes des 11 pages restantes | Versionnement de la doc (v0.4 / v0.5) |
| Recherche statique intégrée | Recherche hébergée (Orama Cloud) |
| Suppression d'`apps/landing/app/docs/` | Refonte du contenu rédactionnel des 5 pages |
| Redirections et continuité SEO | i18n |
| | Montage de vendoring de la landing |
| | Resynchronisation de la copie vendorée de `packages/ui` |

### Décisions préalables validées

| Question | Décision |
| --- | --- |
| Doc existante | Migrer les 5 pages en MDX, puis supprimer `apps/landing/app/docs/` |
| Routage | Sous-domaine `docs.lumyx.dev`, projet Vercel séparé |
| Blocs de code | Palier monospace ajouté à `packages/ui`, Shiki en mode variables CSS |
| Périmètre contenu | Infra + 5 pages migrées + squelettes des 11 restantes |
| Approche Fumadocs | `fumadocs-ui` re-tokenisé, sans éjection de composants |
| Cohérence code landing/docs | Écart assumé : sans en marketing, mono en référence |

---

## 2. Compatibilité et contraintes vérifiées

**Fumadocs v16 est compatible.** Le repo est sur Next 16.3.2, React 19.2.8, Tailwind v4.
Fumadocs v16 exige Next ≥ 16 avec `fumadocs-ui` (Next utilise son propre canal canary de
React), React ≥ 19.2.0, et Tailwind v4 exclusivement. Les trois sont satisfaits sans montée
de version.

**Le design system est verrouillé par un script, et il en existe deux familles.** La tâche
`verify:ds` de Turbo exécute un `verify-ds.mjs` différent selon le paquet :

| | version *app* (`apps/landing`, `apps/dashboard`) | version *package* (`packages/ui`) |
| --- | --- | --- |
| Scanne | `app/`, `components/`, `lib/` | `src/` |
| Exempte | `app/globals.css` | `src/styles.css` |
| Règles | 4 | 6 |

Les quatre règles communes :

1. aucune couleur littérale (hex ou `rgb()`) hors du fichier exempté ;
2. zéro monospace — toute mention de `font-mono`, `ui-monospace`, `'SF Mono'`, `Menlo`,
   `Consolas` ;
3. pas de `dangerouslySetInnerHTML` ;
4. aucun fichier `.css` autre que celui exempté.

La version *package* en ajoute deux : la 5 interdit les imports par alias `@/` dans
`packages/ui`, et la 6 (`cn-font-scale`, `cn-keeps-size-and-color`) vérifie que chaque palier
`--text-<nombre>` de `styles.css` figure dans `FONT_SIZES` de `src/lib/utils.ts`, puis prouve
via `tailwind-merge` qu'une classe de taille n'avale jamais une couleur de texte.

Cette règle 6 a une conséquence directe sur la §5 : le palier `--text-code` n'a pas de suffixe
numérique, donc il échappe à sa regex et doit être déclaré à la main dans `FONT_SIZES`, sans
quoi `cn("text-muted text-code")` perd une des deux classes.

Fumadocs viole par défaut les règles 1 et 2 via la coloration Shiki : elle émet du style inline
portant des valeurs hexadécimales, en police monospace. La §5 résout les deux sans contourner
le script.

La règle 3 est frôlée sur un point précis : l'option `icon` de `rehypeCodeOptions`, active par
défaut, pose sur le `<pre>` un attribut contenant une chaîne HTML de logo de langage, destinée
à `dangerouslySetInnerHTML`. Le rendu se fait dans `fumadocs-ui`, hors des répertoires scannés,
donc le script ne la verrait pas — mais `icon: false` est retenu de toute façon (§5.1). La
règle 4 n'est pas menacée : les feuilles `fumadocs-ui/css/*.css` vivent dans `node_modules`.

**Correction : le monorepo n'est pas un seul dépôt git.** Une première rédaction de ce
document qualifiait le workspace imbriqué d'`apps/landing` de « piège actif » et proposait
de le supprimer. C'était faux, et dangereux.

`.gitignore` à la racine, lignes 19-21 :

```
# Private — jamais pushé
apps/cloud/
apps/landing/
```

Trois dépôts indépendants coexistent donc dans l'arborescence :

| Chemin | Dépôt | Suivi par la racine |
| --- | --- | --- |
| racine, `packages/*`, `apps/dashboard`, `apps/sfu`, `apps/docs` | `FrekiManagarm/lumyx` (public) | oui |
| `apps/landing` | `FrekiManagarm/lumyx_landing` | non |
| `apps/cloud` | `FrekiManagarm/lumyx-cloud` | non |

`git ls-files apps/landing` depuis la racine renvoie zéro fichier.

Le commit `095c714` de `lumyx_landing`, « fix(deploy): vendorer @lumyx/ui pour que Vercel
puisse installer », établit que le montage de la landing est **délibéré et nécessaire** :
`apps/landing/packages/ui` est un vendoring assumé (44 fichiers suivis dans ce dépôt, qui ne
contient ni racine de workspace ni paquet frère), `workspaces: ["packages/*"]` existe pour
que `workspace:*` résolve, et `@source '../packages/ui/src'` vise la copie vendorée exprès —
« sinon Tailwind n'émet pas les classes du design system et les composants sortent sans
style ».

**Conséquences pour ce design :**

- `apps/docs` vit dans le dépôt racine public, comme `apps/dashboard`. `@lumyx/ui` y résout
  par le workspace racine et son `@source` pointe sur `packages/ui` — aucun vendoring.
- Les modifications d'`apps/landing` (§7.4) se commitent dans `lumyx_landing`.
- La copie vendorée de la landing divergera de la racine sur le palier code de la §5. La
  landing n'utilise pas `font-mono` (§5.4), donc c'est sans effet sur son rendu ; c'est une
  dette de synchronisation, pas un défaut.
- Aucun worktree du dépôt racine ne peut servir ce chantier : `bun.lock` est suivi et
  référence `apps/landing` et `apps/cloud`, absents d'un worktree parce qu'ignorés. Un
  `bun install` y réécrirait le lockfile suivi en supprimant ces membres.

---

## 3. Structure de l'app et intégration monorepo

`apps/docs` suit les conventions d'`apps/dashboard`, l'app la plus proprement intégrée du
repo : pas de workspace imbriqué, pas de dépôt git interne, pas de `bun.lock` local.

```
apps/docs/
  package.json            @lumyx/docs
  next.config.mjs         withMDX() + transpilePackages: ['@lumyx/ui']
  source.config.ts        defineConfig({ mdxOptions: { rehypeCodeOptions } })
  postcss.config.mjs      @tailwindcss/postcss
  tsconfig.json           paths @/*
  eslint.config.mjs       copie de celui de la landing
  scripts/verify-ds.mjs   variante docs
  components/
    mdx.tsx               getMDXComponents() — mapping des composants MDX
    metrics-reference.tsx <MetricsReference />
  lib/
    source.ts             defineDocs (macro) + loader(), baseUrl '/'
    layout.shared.tsx     baseOptions() — nav partagee
    metrics-data.ts       METRICS, repris de apps/landing/lib/docs-data.ts
  app/
    layout.tsx            RootProvider + GeistSans + GeistMono + globals.css
    globals.css           pont de tokens
    sitemap.ts
    robots.ts
    api/search/route.ts
    (docs)/
      layout.tsx          DocsLayout, tree = source.getPageTree()
      [[...slug]]/page.tsx
  content/docs/           le MDX (§6)
```

Quatre contraintes de l'API réelle de Fumadocs v16, vérifiées contre les exemples du dépôt
`fuma-nama/fumadocs` (`examples/next-min`, `examples/next`) :

1. **`next.config.mjs`, pas `.ts`.** `fumadocs-mdx` est ESM-only et sa documentation
   recommande explicitement `.mjs` pour une résolution ESM correcte ; un `next.config.ts`
   exigerait le résolveur TypeScript natif de Node. C'est la seule app du repo qui divergera
   de `next.config.ts` — divergence assumée et commentée dans le fichier.
2. **Deux fichiers de configuration, pas un.** `lib/source.ts` déclare les collections via
   `defineDocs` de `fumadocs-mdx/macro` ; `source.config.ts` porte les options globales via
   `defineConfig` de `fumadocs-mdx/config`, et c'est là que vit `rehypeCodeOptions` (§5).
3. **`source.getPageTree()`**, méthode, et non une propriété `source.pageTree`.
4. **Routes typées Next 16.** `LayoutProps<'/'>` et `PageProps<'/[[...slug]]'>` sont des types
   globaux générés par `next typegen`. `check-types` doit donc être
   `next typegen && tsc --noEmit`, sinon la vérification de types échoue sur des types absents.

`baseUrl` vaut `'/'` : sur `docs.lumyx.dev` la documentation est à la racine du domaine. Les
slugs de page sont préservés (`/quickstart`, `/self-hosting`, `/cloud`,
`/metrics-reference`), le préfixe `/docs` disparaît avec le changement de domaine.

### 3.1 `package.json`

Nom `@lumyx/docs`, `private: true`. React et React-DOM par `catalog:` comme les autres apps.
Dépendances ajoutées : `fumadocs-core`, `fumadocs-ui`, `fumadocs-mdx`, plus `@lumyx/ui`
(`workspace:*`), `geist`, `next`. En `devDependencies`, `@types/mdx` s'ajoute à la liste
standard — `fumadocs-mdx` en dépend pour typer `MDXComponents`.

`next-themes` n'est **pas** une dépendance directe : `RootProvider` de `fumadocs-ui` l'embarque
déjà. L'ajouter créerait deux instances du provider.

Scripts, calqués sur `apps/dashboard` :

```json
"dev": "next dev --port 3003",
"build": "next build",
"start": "next start",
"lint": "eslint",
"check-types": "next typegen && tsc --noEmit",
"verify:ds": "node scripts/verify-ds.mjs"
```

Le port 3003 est libre : landing 3000, dashboard 3001, cloud 3002.

Aucune modification de `turbo.json` n'est nécessaire — les tâches `build`, `dev`, `lint`,
`check-types` et `verify:ds` y sont déjà définies et s'appliquent par convention de nom.

### 3.2 Pas de correctif sur `apps/landing`

Une première rédaction prévoyait ici un « correctif ciblé » sur le montage de la landing. Il
est retiré : la §2 établit que ce montage est un correctif de déploiement délibéré, et le
défaire casserait son build Vercel sur trois points à la fois.

`apps/landing` n'est touchée que par la §7.4 — redirections et retrait de l'ancienne
implantation — et ces changements se commitent dans son propre dépôt.

`apps/docs/app/globals.css` utilise `@source '../../../packages/ui/src'`, comme
`apps/dashboard`, puisqu'elle vit dans le dépôt racine et lit le design system par le
workspace.

---

## 4. Le skin Lumyx

### 4.1 Le pont de tokens

Fumadocs expose un contrat de seize variables `--color-fd-*` (`background`, `foreground`,
`muted`, `muted-foreground`, `popover`, `popover-foreground`, `card`, `card-foreground`,
`border`, `primary`, `primary-foreground`, `secondary`, `secondary-foreground`, `accent`,
`accent-foreground`, `ring`).

La feuille `fumadocs-ui/css/shadcn.css` mappe ce contrat sur les **noms courts shadcn**, sans
valeurs de repli. Or `packages/ui/src/styles.css` définit déjà l'intégralité de ce contrat
shadcn, repointé sur les tokens Lumyx — c'est exactement le geste posé lors de la migration
shadcn (cf. `2026-08-31-shadcn-design-system-migration-design.md`). L'absence de repli est ce
qui rend l'opération sûre ici : toutes les variables consommées sont définies en amont.

```css
/* apps/docs/app/globals.css */
@import 'tailwindcss';
@import '@lumyx/ui/styles.css';        /* tokens Lumyx + contrat shadcn */
@import 'fumadocs-ui/css/shadcn.css';  /* --color-fd-* -> contrat shadcn */
@import 'fumadocs-ui/css/preset.css';  /* composants fumadocs */

@source '../../../packages/ui/src';
@source '../node_modules/fumadocs-ui/dist';
```

L'ordre est porteur de sens : Lumyx pose les valeurs, `shadcn.css` les consomme, `preset.css`
les applique. Les deux directives `@source` sont nécessaires — Tailwind v4 n'émet que les
classes qu'il voit, et ni `packages/ui/src` ni les composants compilés de `fumadocs-ui` ne
sont dans l'arbre de `apps/docs`.

**Le chemin du second `@source` remonte à la racine du monorepo**, pas au dossier local :
bun hisse les dépendances dans `node_modules/` à la racine, `apps/docs/node_modules` n'existe
pas, et Tailwind ignore silencieusement un `@source` pointant sur un dossier absent — le build
reste vert et les classes manquent. Constaté à l'implémentation : corriger le chemin fait
passer la feuille compilée de 106 523 à 115 855 octets.

**Une exception au pont de tokens, trouvée à l'implémentation.** L'affirmation « le contrat est
déjà défini, donc le remappage est gratuit » est vraie pour quinze des seize variables, et
fausse pour une : `shadcn.css` fait `--color-fd-accent: var(--accent)`, mais les deux contrats
ne désignent pas la même chose sous ce nom.

| | rôle de `--accent` |
| --- | --- |
| shadcn | la surface de survol discrète |
| Lumyx | la couleur d'accent elle-même (`var(--indigo-500)`, `styles.css:49`) |

L'équivalent Lumyx de la surface shadcn s'appelle `--accent-bg` (`styles.css:89`, sur
`var(--surface-hover)`) — renommé précisément pour ne pas entrer en collision avec `--accent`.
Sans remappage, `hover:bg-fd-accent` repeint chaque bouton d'icône en indigo plein sur du
texte quasi noir. Le correctif est une redéclaration dans `:root` :

```css
--color-fd-accent: var(--accent-bg);
```

Elle gagne sur `shadcn.css` par ordre de source à spécificité égale, dans les deux thèmes, et
le bloc `#nd-sidebar` de `shadcn.css` garde sa propre valeur par spécificité plus forte.

La leçon générale : un contrat partagé par nom n'est pas un contrat partagé par sémantique.
Toute variable dont les deux systèmes se disputent le *sens* — et non la valeur — doit être
vérifiée à l'œil, parce qu'aucun build ne la signalera.

### 4.2 Les écarts que le pont ne couvre pas

À traiter dans un bloc explicite de `globals.css`, après les imports. La rédaction initiale en
prévoyait quatre ; l'implémentation en a dénombré **six**, les deux derniers n'ayant été
visibles qu'à l'œil.

| Écart | Défaut Fumadocs | Traitement Lumyx |
| --- | --- | --- |
| Largeur de layout | `--fd-layout-width: 97rem` (1552px) | `var(--content-max)` = 1360px |
| Échelle de type | échelle Tailwind (prose à 16px) | 14px sur le corps de doc |
| Rayons | dérivés de `--radius` | **aucune intervention nécessaire** |
| Titres de nav | casse normale | `@apply sl-label` |
| Ancres de titre | repeintes en `--accent-text` | `color: inherit` |
| `--color-fd-accent` | `var(--accent)` (cf. §4.1) | `var(--accent-bg)` |

Trois corrections par rapport à la rédaction initiale :

- La largeur par défaut est **97rem (1552px)**, et non 1600px. Cette dernière valeur ne figure
  que dans `preset-legacy.css`; `preset.css` ne déclare pas la variable.
- **Les rayons n'ont demandé aucune intervention** — la valeur Lumyx se propage comme prévu.
- **Les ancres de titre**, écart non anticipé : Fumadocs enveloppe le texte de chaque titre
  dans un `<a>` sans classe, que la règle de base `a { color: var(--accent-text) }` du design
  system repeint en indigo. Un titre n'est pas un lien.

`sl-label` sur les titres de section de la sidebar est le seul maniérisme typographique du
système Lumyx ; le reproduire est ce qui fait que la sidebar Fumadocs se lit comme du Lumyx.
Il s'obtient par `@apply sl-label` et **jamais en re-tapant ses cinq déclarations** — c'est la
seule chose du système dont la valeur ne doit pas être recopiée.

**Les sélecteurs internes de Fumadocs ne sont pas une API.** `.fd-prose` et
`[data-sidebar-section-title]`, supposés à la rédaction, n'existent pas en v16. Les sélecteurs
réels (`#nd-docs-layout .prose`, et `#nd-sidebar p` parce que `SidebarSeparator` rend un `<p>`
nu) sont à revérifier à chaque montée de version.

### 4.3 Le risque annoncé n'était pas le bon

La rédaction initiale désignait comme risque principal une collision de blocs `@theme` :
`@lumyx/ui/styles.css` et `preset.css` déclarant tous deux `--radius`, `--color-primary`,
`--color-border`, avec une priorité décidée par l'ordre d'import.

**Cette collision n'a pas eu lieu.** Vérifié à l'implémentation : Fumadocs v16 ne déclare que
`--color-fd-*` et `--animate-fd-*` dans son `@theme`. Le préfixe `fd-` existe précisément pour
éviter ce conflit.

Deux autres modes d'échec silencieux se sont produits, qu'on n'avait pas anticipés :

1. **L'ordre des couches de cascade bat la spécificité.** Le plugin typography de Fumadocs émet
   `.prose { font-size }` dans `@layer utilities`. Une règle de skin placée en `@layer
   components` est donc perdante malgré une spécificité supérieure — elle est émise et n'a
   aucun effet. La prose mesurait 16px au lieu de 14.
2. **Le conflit de sémantique sur `--color-fd-accent`** de la §4.1.

La leçon vaut mieux que la prédiction : **dans ce genre de pontage, les défauts qui comptent ne
produisent jamais d'erreur de build.** Aucun des trois — couche perdante, `@source` fantôme,
variable au sens divergent — n'aurait rougi. Les trois se sont vus à l'œil, en lisant les
styles calculés dans le navigateur. C'est pourquoi la passe visuelle de la §7.5 est le critère
d'acceptation et non un supplément, et pourquoi elle doit lire des valeurs calculées plutôt que
regarder une capture.

### 4.4 Principe de non-éjection

Aucun composant `fumadocs-ui` n'est éjecté à ce stade, et `fumadocs-ui` n'est pas modifié.
L'éjection sélective via `fumadocs-cli add` — d'une pièce, pas du layout — reste la porte de
sortie si le remappage de tokens laisse un élément visuellement faux. Elle est hors périmètre
de ce chantier et devra faire l'objet de sa propre décision, parce qu'elle échange un chemin
de mise à jour contre du contrôle.

---

## 5. Le palier monospace dans `packages/ui`

### 5.1 Mapping Shiki → tokens Lumyx

**Correction d'une hypothèse initiale.** Ce design visait d'abord le thème Shiki
`css-variables`. Vérification faite contre `@shikijs/themes@4.4.3` : ce thème **n'existe plus
parmi les 134 thèmes fournis**. Il survit sous forme de fabrique,
`createCssVariablesTheme()`, non enregistrée par défaut — et la documentation de Shiki la
déconseille elle-même, la qualifiant de « beaucoup moins granulaire que la plupart des autres
thèmes », au profit de deux mécanismes alternatifs.

Le mécanisme retenu est le premier des deux, **Arbitrary Color Values** : depuis Shiki 0.9.15,
un objet de thème accepte des valeurs de couleur non hexadécimales — dont des variables CSS —
Shiki substituant en interne un marqueur le temps de la tokenisation. On écrit donc un thème
TextMate complet dont chaque `foreground` est un token Lumyx :

```ts
{
  name: 'lumyx',
  bg: 'var(--code-bg)',
  fg: 'var(--code-fg)',
  settings: [
    { scope: ['comment'], settings: { foreground: 'var(--code-comment)' } },
    { scope: ['string'],  settings: { foreground: 'var(--code-string)'  } },
    // …
  ],
}
```

C'est strictement meilleur que l'hypothèse de départ sur trois plans : granularité complète des
scopes TextMate au lieu d'un jeu de rôles réduit, un seul thème au lieu de deux, et aucun
enregistrement de fabrique. Le résultat visé est inchangé — couleurs Lumyx, zéro hex, mode
sombre gratuit.

Les tokens `--code-*`, définis dans `packages/ui/src/styles.css`, reprennent exactement la map
`ROLE_COLOR` de `apps/landing/lib/highlight.ts` :

| Token de code | Token Lumyx | Rôle dans `highlight.ts` |
| --- | --- | --- |
| `--code-bg` | `--surface-sunken` | fond du bloc |
| `--code-fg` | `--text-body` | `plain` |
| `--code-comment` | `--text-faint` | `comment` |
| `--code-string` | `--ok` | `str` |
| `--code-number` | `--accent-2` | `num` |
| `--code-keyword` | `--accent-text` | `kw` |
| `--code-function` | `--info` | `fn` |
| `--code-property` | `--text-strong` | `key` |
| `--code-punct` | `--text-faint` | `punct` |

Deux conséquences :

- **Les couleurs de code de la doc sont identiques à celles de la landing**, pas approchantes :
  elles sortent des mêmes tokens.
- **Le mode sombre ne demande aucune configuration.** `--ok`, `--accent-2`, `--info` et
  `--text-faint` basculent déjà sous `.dark`. Un seul thème Shiki, aucun `defaultColor: false`,
  aucun hex dans le HTML produit.

Réserve documentée par Shiki : un thème à valeurs arbitraires « diverge de la compatibilité
TextMate » et devient inutilisable hors web (`shiki-cli`, `shiki-monaco`). Sans effet ici — le
thème ne sert qu'au rendu web.

Repli si le thème à valeurs arbitraires pose problème : le second mécanisme recommandé par
Shiki, `colorReplacements`, qui repeint un thème existant couleur par couleur.

**`icon: false`** est passé dans `rehypeCodeOptions`. Par défaut Fumadocs ajoute au `<pre>` un
attribut `icon` contenant une chaîne HTML de logo de langage, destinée à être rendue via
`dangerouslySetInnerHTML`. Le système Lumyx ne met pas de logo dans un bloc de code, et
l'option évite au passage toute injection de HTML.

### 5.2 Ajouts à `packages/ui/src/styles.css`

1. `--font-mono` dans `@theme inline`, sur `var(--font-geist-mono)`. `geist/font/mono` est déjà
   présent — la landing et le dashboard dépendent de `geist` et n'en utilisent que `sans`.
   Aucune dépendance de police à ajouter.
2. Le bloc `--code-*` du tableau ci-dessus, **hors** de `@theme` : ces variables sont
   consommées par du style inline émis par Shiki, pas par des utilitaires Tailwind. Elles sont
   déclarées dans `:root` et redéclarées sous `.dark` uniquement là où le token sous-jacent ne
   bascule pas déjà de lui-même — en pratique nulle part, puisque les neuf pointent sur des
   alias sémantiques qui basculent.
3. `--text-code: 12.5px` — la valeur que `CodeBlock` et les blocs inline de la landing portent
   aujourd'hui en littéral.
4. Un commentaire énonçant la règle d'emploi, à côté de `--font-mono` :

   > Monospace pour le code de référence (documentation, `/metrics`, payloads). Sans-serif pour
   > les accessoires marketing (hero, onglets de la home) — choix délibéré, pas un oubli.

Cette note existe pour que l'écart de la §5.4 reste une décision et non un accident.

### 5.3 Amendement de `verify:ds`

La règle 2 passe de « zéro monospace » à « **aucune pile de polices monospace littérale** » :

- restent interdits : `ui-monospace`, `'SF Mono'`, `Menlo`, `Consolas` ;
- devient permis : l'utilitaire `font-mono`, qui résout sur `--font-mono`.

L'esprit de la règle est conservé — une seule source de vérité pour les polices — et le palier
s'ouvre. L'amendement est appliqué aux deux copies du script,
`packages/ui/scripts/verify-ds.mjs` et `apps/landing/scripts/verify-ds.mjs`, et la copie
d'`apps/docs` en hérite. Permettre le monospace n'oblige pas la landing à en user : elle
n'utilise `font-mono` nulle part et n'en utilisera pas davantage après ce chantier.

### 5.4 Écart assumé entre landing et docs

Après migration, `docs.lumyx.dev` rend le code en Geist Mono tandis que les snippets restés
sur `lumyx.dev` (hero, `code-panel`, onglets `docker`/`cargo`/`Cloud`) restent en Geist Sans.
Mêmes couleurs, police différente.

Vérifié : **aucun composant de snippet n'est partagé** entre la doc et la home — la doc a son
`CodeBlock` local, la home a `code-panel.tsx` et `hero-console.tsx`. En revanche le snippet
`docker run` de `quickstart` est **dupliqué à l'octet près** depuis `START.docker.lines` de
`apps/landing/lib/site-data.ts` : les mêmes cinq lignes s'afficheront dans deux polices selon
le domaine.

L'écart est assumé pour trois raisons :

1. **Les deux surfaces ne font pas le même travail.** Sur la home, un snippet est un accessoire
   visuel de cinq lignes, lu comme une image ; le sans-serif l'y maintient dans la voix
   typographique de la page. Dans la doc, un snippet est une chose qu'on copie et dont on lit
   l'alignement — JSON à douze clés, TOML, signature Rust. Le monospace gagne sa place là.
2. **L'écart n'est jamais vu côte à côte** : deux domaines, deux chromes, navigation
   séquentielle.
3. **Le coût inverse est mal placé.** Toucher `hero-console` et `code-panel` impose une passe
   visuelle sur l'above-the-fold de la landing au milieu d'un chantier dont le sujet est la
   doc. Et le palier vivant désormais dans `packages/ui`, basculer la landing plus tard coûte
   une ligne par composant.

Faiblesse signalée et non traitée : la commande `docker run` existe en deux copies, qui vivront
après migration dans deux apps distinctes — elles peuvent diverger. Candidate à
consolidation, décision séparée.

---

## 6. Contenu et migration

### 6.1 Arborescence plate, sections par `meta.json`

Les slugs de page sont préservés à l'identique ; seul le préfixe `/docs` disparaît, remplacé
par le sous-domaine. `lumyx.dev/docs/quickstart` devient `docs.lumyx.dev/quickstart`, et les
redirections de la §7.4 assurent la continuité. Les quatre sections de `DOC_NAV` sont rendues
par les séparateurs de `meta.json` plutôt que par des dossiers, pour ne pas enfoncer les slugs
d'un niveau au service de la cosmétique de nav. Des dossiers si et quand l'arbre grossit.

```
content/docs/
  meta.json               ordre + separateurs :
                          Getting started / Core concepts / Observability / Reference
  index.mdx               <- app/docs/page.tsx
  quickstart.mdx          <- app/docs/quickstart/page.tsx
  self-hosting.mdx        <- app/docs/self-hosting/page.tsx
  cloud.mdx               <- app/docs/cloud/page.tsx
  metrics-reference.mdx   <- app/docs/metrics-reference/page.tsx
  rooms.mdx  peers.mdx  signaling.mdx  forwarding.mdx        \
  alerting.mdx  topology.mdx  replay.mdx  prometheus.mdx      > 11 squelettes
  api.mdx  config.mdx  errors.mdx                            /
```

### 6.2 Ce que la migration supprime

Les props de `DocsLayout` se dissolvent dans le frontmatter et les primitives Fumadocs :

| Aujourd'hui, à la main par page | Après |
| --- | --- |
| `title`, `description` | frontmatter MDX |
| `crumb` | breadcrumbs dérivés du page tree |
| `toc` (tableau saisi à la main) | dérivé des titres du document |
| `activeId` | résolu par le page tree |

C'est le gain principal en maintenance : quatre choses à tenir synchronisées deviennent zéro.
Les entrées grisées non cliquables disparaissent également, les onze pages devenant réelles.

### 6.3 Ce que la migration doit préserver

`DocSection` rend un `h2` précédé de `border-t border-hairline pt-8` — c'est le rythme visuel
de la doc actuelle. Il devient un simple `## Titre` en MDX, la bordure étant portée par
l'override de `h2` dans `components/mdx.tsx` : zéro balisage par page, rendu identique.

`METRICS` (six métriques × sept champs, `apps/landing/lib/docs-data.ts`) pilote
`metrics-reference`. Elle est déplacée dans `apps/docs/lib/metrics-data.ts` et rendue par un
composant `<MetricsReference />` exposé au MDX. Six objets structurés ne sont pas aplatis en
prose Markdown.

`components/mdx.tsx` expose `getMDXComponents()` — la convention Fumadocs v16, qui étend
`defaultMdxComponents` de `fumadocs-ui/mdx` plutôt que de le remplacer. Il mappe :

- `Card`, `CardContent` depuis `@lumyx/ui` ;
- `Callout`, `Tabs`, `Steps` depuis `fumadocs-ui` ;
- `<MetricsReference />` ;
- overrides `h2`, `h3`, `a`, `code`, `pre` sur les paliers et tokens Lumyx.

### 6.4 Les onze squelettes

Chacun reçoit un frontmatter complet (`title`, `description`), un plan de sections en `##`, et
un `<Callout>` signalant que la page est en cours de rédaction. Ils sont inscrits dans
`meta.json`, donc la nav est complète et navigable. Le corps rédactionnel est explicitement
hors périmètre et relève d'un cycle propre.

### 6.5 Suppression

Une fois les cinq pages migrées et vérifiées : suppression d'`apps/landing/app/docs/`,
d'`apps/landing/components/site/docs-layout.tsx`, et des exports de
`apps/landing/lib/docs-data.ts` devenus orphelins (`METRICS`, `DOC_NAV`, `DocNavItem`,
`DocNavSection`). `RELEASES`, dans le même fichier, alimente `app/_changelog` et reste en
place.

`apps/landing/lib/highlight.ts` reste également : il sert `code-panel` et `hero-console` sur la
home, qui ne migrent pas.

---

## 7. Chrome, recherche, déploiement, vérification

### 7.1 Chrome partagé

Le `nav` de `DocsLayout` reçoit le `Wordmark` de `@lumyx/ui` et les liens de retour vers
`lumyx.dev`. Le `RootProvider` s'aligne sur `apps/landing/app/layout.tsx` :
`attribute="class"`, `defaultTheme="dark"`, `enableSystem={false}` — sinon les deux domaines
ouvrent dans des thèmes différents.

**Limite sans correctif propre** : `localStorage` est cloisonné par origine, donc le thème
choisi sur `lumyx.dev` ne suit pas sur `docs.lumyx.dev`. Le défaut sombre des deux côtés rend
la couture invisible dans le cas courant, mais un visiteur passé en clair sur la home
retombera en sombre sur la doc. C'est le prix du sous-domaine ; le seul correctif serait un
cookie posé sur le domaine parent, hors périmètre.

### 7.2 Recherche

Recherche intégrée de Fumadocs : `createFromSource(source)` exposé par
`app/api/search/route.ts`, avec le dialog et le raccourci clavier fournis par `fumadocs-ui`.
Pas de service externe. À seize pages, Orama Cloud est surdimensionné et ajoute une clé à
gérer pour un gain nul.

**Correction : elle n'est pas « statique ».** Une première rédaction annonçait un index
construit au build. Vérifié à l'implémentation : l'index est bâti **en mémoire à la première
requête**, et la route est rendue `ƒ Dynamic`. Conséquence pour la §7.3 : `apps/docs` n'est pas
exportable en statique pur — il lui faut un runtime serveur. C'est le cas sur Vercel par
défaut, donc sans impact sur le déploiement retenu, mais cela exclut un hébergement de fichiers
statiques.

Deux options de la première rédaction se sont révélées décoratives, et sont documentées comme
telles plutôt que retirées en silence :

- `themeSwitch: { enabled: true }` est **déjà le défaut** de `fumadocs-ui`. La bascule de thème
  n'avait donc jamais besoin d'être demandée, et la justification donnée en §7.1 (« sans elle,
  un visiteur passé en clair n'a aucun moyen de retrouver le clair ») était fausse : la bascule
  est là de toute façon. Le reste de la §7.1 — le cloisonnement de `localStorage` par origine —
  reste exact.
- `language: 'english'` donne des résultats **identiques** au défaut `multilingual`, mesuré sur
  six requêtes, sans radicalisation lexicale dans un mode comme dans l'autre.

### 7.3 Déploiement

Projet Vercel séparé, root directory `apps/docs`, commande de build
`turbo run build --filter=@lumyx/docs`, domaine `docs.lumyx.dev`.

Variables : `NEXT_PUBLIC_SITE_URL` (déjà dans `globalEnv` de `turbo.json`) et
`NEXT_PUBLIC_DOCS_URL`, à ajouter à `globalEnv` pour que la landing puisse construire ses
liens vers la doc.

### 7.4 Continuité SEO

- `apps/landing/next.config.ts` : ajout d'un `redirects()` en permanent, avec **deux règles** —
  `/docs/:path*` vers `https://docs.lumyx.dev/:path*`, et `/docs` vers
  `https://docs.lumyx.dev`. La première ne capture pas `/docs` nu ; l'omettre laisserait un 404
  sur l'URL la plus liée des deux.
- `apps/landing/app/sitemap.ts` : suppression de l'entrée `/docs`.
- `apps/docs/app/sitemap.ts` et `robots.ts` : créés sur le modèle exact de ceux de la landing,
  avec `NEXT_PUBLIC_DOCS_URL` pour base.

### 7.5 Vérification

Le critère d'acceptation d'un re-skin n'est pas « le build passe ». Dans l'ordre :

1. `turbo run check-types lint verify:ds build` — au vert sur tout le monorepo, pas seulement
   sur `apps/docs`, puisque `packages/ui` et `apps/landing` sont modifiés.
2. Passe visuelle en **clair et en sombre**, sur les cinq pages migrées plus un squelette,
   comparée au rendu actuel de `/docs`, via le skill `/browse`.

Défauts spécifiquement recherchés, parce que le build ne les attrapera pas — la liste est tirée
de ce qui s'est réellement produit (§4.3), pas de ce qu'on redoutait :

- **une règle de skin placée dans la mauvaise couche de cascade**, donc émise et sans effet.
  Se détecte en lisant la valeur calculée, jamais sur une capture ;
- **une variable partagée par nom mais pas par sens**, comme `--color-fd-accent` ;
- **un `@source` pointant sur un dossier absent** — Tailwind l'ignore en silence et les classes
  manquent ;
- **un sélecteur interne de Fumadocs qui ne matche plus rien** après une montée de version ;
- **un token `--code-*` non résolu**, qui rend le code en noir pur.

La passe visuelle lit des styles calculés dans le navigateur. Regarder une capture ne suffit
pas : les cinq défauts ci-dessus produisent une page qui a l'air plausible.

Note d'exécution : `rtk next build` remonte des succès factices dans ce repo. Les builds de
vérification passent par `rtk proxy`.

---

## 8. Ordre d'implémentation

1. `packages/ui` : palier monospace, variables `--shiki-*`, `--text-code`, commentaire de
   règle, amendement de `verify:ds`.
2. `apps/landing` : correctif `@source`, suppression du workspace imbriqué et du symlink
   périmé, amendement de `verify:ds`. Vérifier que la landing est inchangée à l'écran.
3. `apps/docs` : scaffold, pont de tokens, les six écarts de la §4.2. Vérifier sur une page
   d'essai, dans les deux thèmes, avant d'y verser du contenu.
4. Migration des cinq pages en MDX + `meta.json` + `mdx-components.tsx` + `MetricsReference`.
5. Les onze squelettes.
6. Recherche, `sitemap`, `robots`, chrome de nav.
7. Suppression d'`apps/landing/app/docs/` et des exports orphelins, ajout des redirections.
8. Vérification complète selon la §7.5.

L'étape 3 se vérifie avant l'étape 4 : verser seize pages de contenu sur un skin non validé
transforme un problème de tokens en une recherche de panne.
