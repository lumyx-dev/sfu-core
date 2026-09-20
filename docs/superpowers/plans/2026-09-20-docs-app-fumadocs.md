# Plan d'implémentation — `apps/docs` sur Fumadocs, skinnée Lumyx

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** remplacer les cinq pages de documentation écrites à la main dans `apps/landing/app/docs/` par une app Next dédiée, `apps/docs`, bâtie sur Fumadocs v16 et habillée avec le design system Lumyx, servie sur `docs.lumyx.dev`.

**Architecture:** Fumadocs UI est conservé tel quel pour la structure et le comportement ; son contrat de couleurs est remappé sur les tokens Lumyx via `fumadocs-ui/css/shadcn.css`, que `packages/ui/src/styles.css` alimente déjà. Un palier monospace est ouvert dans `packages/ui`, avec un thème Shiki dont chaque couleur est une variable CSS Lumyx. Aucun composant Fumadocs n'est éjecté.

**Tech Stack:** Next 16.3.2 (App Router, routes typées), React 19.2.8, Tailwind CSS v4, Fumadocs v16 (`fumadocs-core`, `fumadocs-ui`, `fumadocs-mdx`), Shiki 4.x, Bun 1.3.11 workspaces, Turborepo 2.x, tests `bun:test`.

**Spec:** `docs/superpowers/specs/2026-09-20-docs-app-fumadocs-design.md`

## Global Constraints

Ces contraintes s'appliquent à **toutes** les tâches. Chaque tâche les inclut implicitement.

- **Versions plancher, copiées du repo, à ne pas modifier :** `next` 16.3.2, `react` 19.2.8, `react-dom` 19.2.8, Tailwind v4, Bun 1.3.11 (racine). React et React-DOM se déclarent par `catalog:` dans les apps.
- **`verify:ds` règle 1 — aucune couleur littérale.** Aucun hex ni `rgb()`/`rgba()` dans `app/`, `components/`, `lib/`. Seule exception : `globals.css` de chaque app, et `packages/ui/src/styles.css`. Toute couleur passe par un token.
- **`verify:ds` règle 2 (amendée par la tâche 1) — monospace par token uniquement.** `font-mono` est permis ; les piles littérales `ui-monospace`, `'SF Mono'`, `Menlo`, `Consolas` restent interdites.
- **`verify:ds` règle 3 — aucun `dangerouslySetInnerHTML`.**
- **`verify:ds` règle 4 — aucun fichier `.css`** autre que `globals.css` dans les répertoires scannés.
- **Échelle de type Lumyx :** uniquement `text-11`, `text-12`, `text-13`, `text-14`, `text-16`, `text-20`, `text-26`, `text-34`, `text-44`. Pas de `text-sm`/`text-base`/`text-lg` de Tailwind.
- **Rayons Lumyx :** `rounded-xs` 8px, `rounded-sm` 12px, `rounded-md` 14px, `rounded-lg` 18px, `rounded-xl` 24px, `rounded-pill` 999px.
- **Couleurs par utilitaire de token :** `bg-page`, `bg-card`, `bg-sunken`, `bg-inset`, `bg-hover`, `bg-active`, `border-hairline`, `border-stroke`, `border-subtle`, `text-strong`, `text-body`, `text-muted`, `text-faint`, `text-accent`, `text-accent-text`.
- **Commandes de build et de test :** toujours préfixées par `rtk proxy` dans ce repo. `rtk next build` remonte des succès factices et `rtk`-hooké sert parfois des lectures périmées — `rtk proxy` contourne les deux.
- **Gestionnaire de paquets :** `bun`. Installer depuis la racine du monorepo (`bun install`), jamais depuis `apps/docs`.
- **Domaine de production :** `docs.lumyx.dev`. Domaine de la landing : `lumyx.dev`.
- **Port de dev :** 3003 (landing 3000, dashboard 3001, cloud 3002).
- **Langue du contenu :** la documentation est en anglais. Les commentaires de code du repo sont en français ou en anglais selon le fichier voisin — suivre le fichier qu'on modifie.
- **Attribution des commits :** terminer chaque message par `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

---

## Structure des fichiers

**Créés dans `packages/ui` (tâche 1) :**

| Fichier | Responsabilité |
| --- | --- |
| `packages/ui/src/code-theme.ts` | Le thème Shiki `lumyx`, un objet TextMate dont chaque couleur est une variable CSS. Exporté par `src/index.ts`. |
| `packages/ui/src/code-theme.test.ts` | Prouve que le thème ne contient aucune couleur littérale et couvre les neuf rôles. |
| `packages/ui/scripts/verify-ds.test.mjs` | Prouve que la règle 2 amendée accepte `font-mono` et refuse les piles littérales. |

**Modifiés dans `packages/ui` (tâche 1) :**

| Fichier | Changement |
| --- | --- |
| `packages/ui/src/styles.css` | `--font-mono` dans `@theme inline`, `--text-code`, bloc `--code-*` dans `:root`, commentaire de règle d'emploi. |
| `packages/ui/src/index.ts` | Export de `./code-theme`. |
| `packages/ui/scripts/verify-ds.mjs` | Règle 2 amendée. |
| `packages/ui/package.json` | Script `test`. |

**Modifiés dans `apps/landing` (tâche 2, puis 8) :**

| Fichier | Changement |
| --- | --- |
| `apps/landing/app/globals.css` | `@source` repointé sur `packages/ui` à la racine. |
| `apps/landing/package.json` | Suppression de la clé `workspaces`. |
| `apps/landing/scripts/verify-ds.mjs` | Règle 2 amendée, identique à celle de `packages/ui`. |
| `apps/landing/next.config.ts` | Tâche 8 : `redirects()` vers `docs.lumyx.dev`. |
| `apps/landing/app/sitemap.ts` | Tâche 8 : suppression de l'entrée `/docs`. |
| `apps/landing/lib/docs-data.ts` | Tâche 8 : suppression de `METRICS`, `DOC_NAV`, `DocNavItem`, `DocNavSection`. `RELEASES` conservé. |

**Supprimés (tâche 8) :** `apps/landing/app/docs/` (5 pages), `apps/landing/components/site/docs-layout.tsx`, `apps/landing/packages/` (tâche 2).

**Créés dans `apps/docs` :**

| Fichier | Responsabilité | Tâche |
| --- | --- | --- |
| `package.json`, `tsconfig.json`, `postcss.config.mjs`, `eslint.config.mjs`, `next.config.mjs`, `.gitignore` | Coque de l'app | 3 |
| `scripts/verify-ds.mjs` | Garde du design system, variante docs | 3 |
| `app/globals.css` | Le pont de tokens Fumadocs → Lumyx | 3 |
| `app/layout.tsx` | `RootProvider`, Geist Sans + Mono | 3 |
| `lib/source.ts` | `defineDocs` + `loader()` | 3 |
| `lib/layout.shared.tsx` | `baseOptions()` — nav partagée | 3 |
| `app/(docs)/layout.tsx` | `DocsLayout` | 3 |
| `app/(docs)/[[...slug]]/page.tsx` | `DocsPage` | 3 |
| `components/mdx.tsx` | `getMDXComponents()` | 3, étendu en 5 |
| `source.config.ts` | `rehypeCodeOptions` — thème Shiki Lumyx | 4 |
| `lib/metrics-data.ts` | `METRICS`, repris de la landing | 5 |
| `lib/site-data.ts` | `VERSION`, `REPO` | 5 |
| `components/metrics-reference.tsx` | `<MetricsReference />` | 5 |
| `components/doc-cards.tsx` | `<DocCards>` / `<DocCard>` — grille de liens sur primitives Lumyx | 5 |
| `content/docs/*.mdx`, `content/docs/meta.json` | Le contenu | 5, 6 |
| `app/api/search/route.ts` | Recherche statique | 7 |
| `app/sitemap.ts`, `app/robots.ts` | SEO | 7 |

**Modifiés à la racine :**

| Fichier | Changement | Tâche |
| --- | --- | --- |
| `turbo.json` | `NEXT_PUBLIC_DOCS_URL` ajouté à `globalEnv` | 7 |

---

## Task 1: Palier code dans `packages/ui`

Ouvre le palier monospace et le thème Shiki dans le design system, et amende la règle 2 de `verify:ds`. Rien ne consomme encore ces tokens à la fin de la tâche — c'est voulu : le design system bouge seul, vérifiable seul.

**Files:**
- Create: `packages/ui/src/code-theme.ts`
- Create: `packages/ui/src/code-theme.test.ts`
- Create: `packages/ui/scripts/verify-ds.test.mjs`
- Modify: `packages/ui/src/styles.css`
- Modify: `packages/ui/src/index.ts`
- Modify: `packages/ui/scripts/verify-ds.mjs`
- Modify: `packages/ui/package.json`

**Interfaces:**
- Consumes: rien.
- Produces:
  - `lumyxCodeTheme: ShikiThemeRegistration` exporté depuis `@lumyx/ui` — consommé par la tâche 4.
  - Tokens CSS `--font-mono`, `--text-code`, `--code-bg`, `--code-fg`, `--code-comment`, `--code-string`, `--code-number`, `--code-keyword`, `--code-function`, `--code-property`, `--code-punct` — consommés par la tâche 3 (police) et la tâche 4 (couleurs).
  - `verify-ds.mjs` règle 2 amendée — copiée par les tâches 2 et 3.

- [ ] **Step 1: Écrire le test du thème Shiki**

Crée `packages/ui/src/code-theme.test.ts` :

```ts
import { describe, expect, test } from "bun:test";
import { lumyxCodeTheme } from "./code-theme";

const HEX = /#[0-9a-fA-F]{3,8}\b/;
const RGB = /\brgba?\(/;

describe("lumyxCodeTheme", () => {
  test("ne contient aucune couleur litterale", () => {
    const serialized = JSON.stringify(lumyxCodeTheme);
    expect(HEX.test(serialized)).toBe(false);
    expect(RGB.test(serialized)).toBe(false);
  });

  test("toute couleur est une variable CSS pointant sur un token --code-*", () => {
    const colors = [
      lumyxCodeTheme.bg,
      lumyxCodeTheme.fg,
      ...lumyxCodeTheme.settings.map((s) => s.settings.foreground),
    ];
    expect(colors.length).toBeGreaterThan(0);
    for (const c of colors) {
      expect(c).toMatch(/^var\(--code-[a-z]+\)$/);
    }
  });

  test("couvre les sept roles de coloration en plus du fond et du texte", () => {
    const used = new Set(lumyxCodeTheme.settings.map((s) => s.settings.foreground));
    expect(used).toEqual(
      new Set([
        "var(--code-comment)",
        "var(--code-string)",
        "var(--code-number)",
        "var(--code-keyword)",
        "var(--code-function)",
        "var(--code-property)",
        "var(--code-punct)",
      ])
    );
  });

  test("chaque entree de settings porte au moins un scope", () => {
    for (const s of lumyxCodeTheme.settings) {
      expect(s.scope.length).toBeGreaterThan(0);
    }
  });

  test("s'appelle lumyx et n'annonce pas de type clair/sombre", () => {
    expect(lumyxCodeTheme.name).toBe("lumyx");
    expect(lumyxCodeTheme).not.toHaveProperty("type");
  });
});
```

- [ ] **Step 2: Ajouter le script `test` et lancer le test pour le voir échouer**

Dans `packages/ui/package.json`, ajoute au bloc `scripts` (après `check-types`) :

```json
"test": "bun test",
```

Run: `cd packages/ui && rtk proxy bun test src/code-theme.test.ts`
Expected: FAIL — `Cannot find module './code-theme'`.

- [ ] **Step 3: Écrire le thème Shiki**

Crée `packages/ui/src/code-theme.ts` :

```ts
/**
 * Thème Shiki Lumyx.
 *
 * Shiki accepte des valeurs de couleur non hexadécimales depuis 0.9.15 (« Arbitrary Color
 * Values ») : il substitue un marqueur interne le temps de la tokenisation, puis restitue la
 * valeur d'origine. On peut donc peindre un thème TextMate entier avec des variables CSS, ce qui
 * donne trois choses à la fois — aucune couleur littérale dans le rendu, les couleurs exactes du
 * design system, et un mode sombre gratuit puisque les tokens `--code-*` pointent sur des alias
 * sémantiques qui basculent déjà sous `.dark`.
 *
 * Contrepartie documentée par Shiki : le thème n'est plus compatible TextMate au sens strict et
 * devient inutilisable hors web (shiki-cli, shiki-monaco). Sans effet ici.
 *
 * Les neuf rôles reprennent la map `ROLE_COLOR` du tokenizer de la landing
 * (`apps/landing/lib/highlight.ts`), pour que la doc et le site marketing colorient le code de
 * façon identique.
 */

export type CodeThemeSetting = {
  scope: string[];
  settings: { foreground: string };
};

export type CodeTheme = {
  name: string;
  bg: string;
  fg: string;
  settings: CodeThemeSetting[];
};

export const lumyxCodeTheme: CodeTheme = {
  name: "lumyx",
  bg: "var(--code-bg)",
  fg: "var(--code-fg)",
  settings: [
    {
      scope: ["comment", "punctuation.definition.comment", "string.comment"],
      settings: { foreground: "var(--code-comment)" },
    },
    {
      scope: [
        "string",
        "string.quoted",
        "string.template",
        "constant.other.symbol",
        "meta.embedded.assembly",
      ],
      settings: { foreground: "var(--code-string)" },
    },
    {
      scope: [
        "constant.numeric",
        "constant.language",
        "constant.character",
        "constant.other",
        "keyword.other.unit",
      ],
      settings: { foreground: "var(--code-number)" },
    },
    {
      scope: [
        "keyword",
        "keyword.control",
        "keyword.operator.new",
        "keyword.operator.expression",
        "storage",
        "storage.type",
        "storage.modifier",
        "variable.language",
      ],
      settings: { foreground: "var(--code-keyword)" },
    },
    {
      scope: [
        "entity.name.function",
        "support.function",
        "meta.function-call.generic",
        "entity.name.type",
        "entity.name.class",
        "support.type",
        "support.class",
      ],
      settings: { foreground: "var(--code-function)" },
    },
    {
      scope: [
        "support.type.property-name",
        "meta.object-literal.key",
        "variable.other.member",
        "entity.name.tag",
        "entity.other.attribute-name",
        "support.type.property-name.toml",
        "entity.name.tag.yaml",
      ],
      settings: { foreground: "var(--code-property)" },
    },
    {
      scope: [
        "punctuation",
        "punctuation.separator",
        "punctuation.terminator",
        "punctuation.definition.string",
        "meta.brace",
        "keyword.operator",
      ],
      settings: { foreground: "var(--code-punct)" },
    },
  ],
};
```

- [ ] **Step 4: Exporter le thème et relancer le test**

Dans `packages/ui/src/index.ts`, ajoute après la ligne `export * from './lib/utils';` :

```ts
export * from './code-theme';
```

Run: `cd packages/ui && rtk proxy bun test src/code-theme.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Écrire le test de la règle 2 amendée de `verify:ds`**

Crée `packages/ui/scripts/verify-ds.test.mjs`. Le test isole la règle en écrivant des fichiers temporaires dans un répertoire scanné puis en exécutant le script :

```js
import { describe, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = new URL('./verify-ds.mjs', import.meta.url).pathname;

/**
 * Le script resout ses repertoires scannes relativement a sa propre position, donc on le copie
 * dans un faux paquet et on y depose le fichier a tester.
 */
function runWith(fileName, contents) {
  const root = mkdtempSync(join(tmpdir(), 'verify-ds-'));
  mkdirSync(join(root, 'scripts'), { recursive: true });
  mkdirSync(join(root, 'src'), { recursive: true });
  cpSync(SCRIPT, join(root, 'scripts', 'verify-ds.mjs'));
  writeFileSync(join(root, 'src', fileName), contents, 'utf8');
  const proc = Bun.spawnSync(['node', join(root, 'scripts', 'verify-ds.mjs')]);
  const output = proc.stdout.toString() + proc.stderr.toString();
  rmSync(root, { recursive: true, force: true });
  return { code: proc.exitCode, output };
}

describe('verify-ds regle 2 — monospace par token', () => {
  test('accepte l utilitaire font-mono', () => {
    const { code } = runWith('ok.tsx', 'export const A = () => <pre className="font-mono" />;');
    expect(code).toBe(0);
  });

  test('accepte la variable de token --font-mono', () => {
    const { code } = runWith('ok2.tsx', 'export const S = { fontFamily: "var(--font-mono)" };');
    expect(code).toBe(0);
  });

  test('refuse une pile monospace litterale', () => {
    const { code, output } = runWith('bad.tsx', "export const S = { fontFamily: 'Menlo, monospace' };");
    expect(code).toBe(1);
    expect(output).toContain('no-literal-monospace');
  });

  test('refuse ui-monospace', () => {
    const { code, output } = runWith('bad2.tsx', 'export const S = { fontFamily: "ui-monospace" };');
    expect(code).toBe(1);
    expect(output).toContain('no-literal-monospace');
  });

  test('refuse SF Mono et Consolas', () => {
    expect(runWith('bad3.tsx', "const f = \"'SF Mono'\";").code).toBe(1);
    expect(runWith('bad4.tsx', 'const f = "Consolas";').code).toBe(1);
  });
});
```

- [ ] **Step 6: Lancer le test pour le voir échouer**

Run: `cd packages/ui && rtk proxy bun test scripts/verify-ds.test.mjs`
Expected: FAIL — le premier test échoue avec un code de sortie 1, parce que la règle actuelle refuse `font-mono`.

- [ ] **Step 7: Amender la règle 2**

Dans `packages/ui/scripts/verify-ds.mjs`, remplace le bloc de la règle 2 :

```js
// 2. Zéro monospace — un vrai font-family/classe, pas une mention en prose ("no monospace tier").
for (const f of files) {
  if (/\bfont-mono\b|ui-monospace|'SF Mono'|Menlo|Consolas/i.test(readFileSync(f, 'utf8'))) {
    fail('no-monospace', `${rel(f)} contient une font monospace`);
  }
}
```

par :

```js
// 2. Monospace par token uniquement. `font-mono` et `var(--font-mono)` resolvent sur le palier
// declare dans styles.css ; une pile litterale contourne le design system et reste interdite.
const LITERAL_MONO = /ui-monospace|'SF Mono'|"SF Mono"|\bMenlo\b|\bConsolas\b|\bmonospace\b/i;
const MONO_TOKEN = /\bfont-mono\b|var\(--font-mono\)/;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  src.split('\n').forEach((line, i) => {
    // Une ligne qui ne fait que referencer le token est conforme, meme si elle contient le mot
    // `monospace` dans un commentaire adjacent — on ne signale que la pile litterale.
    const scrubbed = line.replace(MONO_TOKEN, '');
    if (LITERAL_MONO.test(scrubbed)) {
      fail('no-literal-monospace', `${rel(f)}:${i + 1} — ${line.trim()}`);
    }
  });
}
```

- [ ] **Step 8: Relancer les deux suites de tests**

Run: `cd packages/ui && rtk proxy bun test`
Expected: PASS — 10 tests au total (5 + 5).

- [ ] **Step 9: Ajouter les tokens CSS**

Dans `packages/ui/src/styles.css`, à l'intérieur du bloc `@theme inline`, juste après la ligne `--font-sans: …`, insère :

```css
  /* Palier code. Monospace pour le code de reference (documentation, payloads, /metrics) ;
     sans-serif pour les accessoires marketing (hero, onglets de la home) — ecart delibere,
     pas un oubli. Ne pas « harmoniser » sans relire le spec du 2026-09-20. */
  --font-mono: var(--font-geist-mono), "Geist Mono", ui-monospace, monospace;

  --text-code: 12.5px; --text-code--line-height: 1.55;
```

Puis, **après** la fermeture du bloc `@theme inline` et avant le premier `@keyframes`, ajoute :

```css
/* ============================================================================
   Roles de coloration syntaxique. Consommes par du style inline emis par Shiki
   (cf. packages/ui/src/code-theme.ts), donc hors de @theme : ce ne sont pas des
   utilitaires Tailwind. Ils pointent sur des alias semantiques qui basculent deja
   sous .dark, d'ou l'absence de redeclaration en mode sombre.
   ========================================================================== */
:root {
  --code-bg:       var(--surface-sunken);
  --code-fg:       var(--text-body);
  --code-comment:  var(--text-faint);
  --code-string:   var(--ok);
  --code-number:   var(--accent-2);
  --code-keyword:  var(--accent-text);
  --code-function: var(--info);
  --code-property: var(--text-strong);
  --code-punct:    var(--text-faint);
}
```

- [ ] **Step 10: Vérifier que `verify:ds` et les types passent**

Run: `cd packages/ui && rtk proxy bun run verify:ds && rtk proxy bun run check-types`
Expected: les deux au vert. `styles.css` contient `ui-monospace` et `monospace` mais il n'est pas dans les répertoires scannés (`app`, `components`, `lib`) — si le script le signale, c'est que `SCANNED` diffère de celui de la landing : vérifier et ne pas contourner.

- [ ] **Step 11: Commit**

```bash
rtk git add packages/ui/src/code-theme.ts packages/ui/src/code-theme.test.ts \
  packages/ui/src/styles.css packages/ui/src/index.ts \
  packages/ui/scripts/verify-ds.mjs packages/ui/scripts/verify-ds.test.mjs \
  packages/ui/package.json
rtk git commit -m "$(cat <<'EOF'
feat(ui): ouvrir un palier code dans le design system

Ajoute --font-mono (Geist Mono), --text-code et les neuf roles de
coloration --code-*, qui pointent sur des alias semantiques et basculent
donc seuls en mode sombre.

Ajoute le theme Shiki lumyx : un objet TextMate dont chaque couleur est
une variable CSS, ce qui evite toute valeur litterale dans le HTML rendu
tout en donnant les couleurs exactes du systeme. Les neuf roles reprennent
ROLE_COLOR du tokenizer de la landing.

Amende la regle 2 de verify:ds : le monospace est permis via le token,
les piles litterales restent interdites.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Désenclaver `apps/landing` du design system dupliqué

`apps/landing` déclare un workspace imbriqué et contient une copie de `packages/ui`, aujourd'hui identique à l'originale. Tailwind scanne la copie ; les modules résolvent l'originale. La tâche 1 vient de modifier l'originale, donc la landing n'émettrait pas les nouvelles classes. Cette tâche supprime la copie.

**Files:**
- Modify: `apps/landing/app/globals.css`
- Modify: `apps/landing/package.json`
- Modify: `apps/landing/scripts/verify-ds.mjs`
- Delete: `apps/landing/packages/` (répertoire entier)

**Interfaces:**
- Consumes: `packages/ui/scripts/verify-ds.mjs` de la tâche 1 (la règle 2 amendée y est copiée telle quelle).
- Produces: rien que les tâches suivantes consomment. Tâche indépendante et réversible.

- [ ] **Step 1: Confirmer que la copie est bien identique avant de la supprimer**

Run:
```bash
rtk proxy diff -r packages/ui/src apps/landing/packages/ui/src && echo "IDENTIQUE"
```
Expected: `IDENTIQUE`.

Si la commande signale des différences, **arrêter** : la copie a divergé et contient du travail non reporté. Le rapporter plutôt que de supprimer.

- [ ] **Step 2: Repointer le `@source` de Tailwind**

Dans `apps/landing/app/globals.css`, remplace :

```css
@source '../packages/ui/src';
```

par :

```css
@source '../../../packages/ui/src';
```

Le commentaire au-dessus reste valable et n'est pas modifié. Le chemin est désormais identique à celui d'`apps/dashboard/app/globals.css`.

- [ ] **Step 3: Supprimer la copie et la déclaration de workspace**

```bash
rtk proxy rm -rf apps/landing/packages
```

Dans `apps/landing/package.json`, supprime les trois lignes :

```json
  "workspaces": [
    "packages/*"
  ],
```

- [ ] **Step 3b: Supprimer le lien symbolique périmé `@lumyx/web`**

`node_modules/@lumyx/` porte deux liens vers le même répertoire : `landing` et `web`, ce dernier étant un vestige du renommage `@lumyx/web` → `@lumyx/landing`. Vérifie-le puis supprime :

```bash
rtk proxy ls -la node_modules/@lumyx/ | rtk proxy grep -E "landing|web"
```
Expected: deux lignes pointant toutes deux vers `../../apps/landing`.

```bash
rtk proxy rm node_modules/@lumyx/web
```

Le lien est dans `node_modules`, donc non versionné — la suppression ne produit aucun diff. Elle évite qu'un `import … from '@lumyx/web'` continue de résoudre et masque une référence morte. Le `bun install` de l'étape 5 ne doit pas le recréer ; s'il le recrée, c'est qu'un `package.json` déclare encore une dépendance `@lumyx/web` — la chercher plutôt que de resupprimer le lien.

- [ ] **Step 4: Amender la règle 2 de `verify:ds`**

Dans `apps/landing/scripts/verify-ds.mjs`, applique **exactement** le même remplacement que l'étape 7 de la tâche 1 : le bloc `// 2. Zéro monospace …` devient le bloc `// 2. Monospace par token uniquement …`. Les deux fichiers doivent rester identiques sur cette règle.

Vérifie-le :

```bash
rtk proxy diff <(rtk proxy sed -n '/2\. Monospace par token/,/^}/p' packages/ui/scripts/verify-ds.mjs) \
               <(rtk proxy sed -n '/2\. Monospace par token/,/^}/p' apps/landing/scripts/verify-ds.mjs) \
  && echo "REGLE IDENTIQUE"
```
Expected: `REGLE IDENTIQUE`.

- [ ] **Step 5: Réinstaller et vérifier que la landing est intacte**

```bash
rtk proxy bun install
rtk proxy bun run --filter=@lumyx/landing verify:ds
rtk proxy bun run --filter=@lumyx/landing check-types
rtk proxy bun run --filter=@lumyx/landing lint
rtk proxy bun run --filter=@lumyx/landing build
```
Expected: les quatre au vert. Le build doit produire les mêmes routes qu'avant.

- [ ] **Step 6: Vérifier visuellement que la landing n'a pas bougé**

C'est le point de la tâche : le `@source` a changé, donc l'ensemble des classes émises a changé. Un build vert ne prouve pas que le CSS est complet.

Lance `rtk proxy bun run --filter=@lumyx/landing dev` puis, avec le skill `/browse`, ouvre `http://localhost:3000` et `http://localhost:3000/docs` dans les deux thèmes. Compare avec l'état avant la tâche.

Expected: aucun écart visuel. Un écart signifie une classe non émise — vérifier le chemin `@source` plutôt que d'ajouter la classe à la main.

- [ ] **Step 7: Commit**

```bash
rtk git add apps/landing/app/globals.css apps/landing/package.json \
  apps/landing/scripts/verify-ds.mjs bun.lock
rtk git add -A apps/landing/packages
rtk git commit -m "$(cat <<'EOF'
fix(landing): scanner le design system de la racine, pas une copie morte

apps/landing declarait un workspace imbriqué et portait une copie de
packages/ui. La resolution des modules utilisait l'originale, mais le
@source de Tailwind pointait sur la copie : toute modification de
packages/ui n'etait donc pas emise en classes pour la landing.

Repointe @source sur la racine (comme apps/dashboard), supprime la copie
et la cle workspaces, et aligne la regle 2 de verify:ds sur packages/ui.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Coque d'`apps/docs` et pont de tokens

Monte l'app et valide le skin **avant** d'y verser du contenu. Verser seize pages sur un skin non validé transforme un problème de tokens en une recherche de panne.

**Files:**
- Create: `apps/docs/package.json`
- Create: `apps/docs/tsconfig.json`
- Create: `apps/docs/postcss.config.mjs`
- Create: `apps/docs/eslint.config.mjs`
- Create: `apps/docs/next.config.mjs`
- Create: `apps/docs/.gitignore`
- Create: `apps/docs/scripts/verify-ds.mjs`
- Create: `apps/docs/app/globals.css`
- Create: `apps/docs/app/layout.tsx`
- Create: `apps/docs/lib/source.ts`
- Create: `apps/docs/lib/layout.shared.tsx`
- Create: `apps/docs/components/mdx.tsx`
- Create: `apps/docs/app/(docs)/layout.tsx`
- Create: `apps/docs/app/(docs)/[[...slug]]/page.tsx`
- Create: `apps/docs/content/docs/index.mdx` (page d'essai, remplacée en tâche 5)

**Interfaces:**
- Consumes: `--font-mono` et `--text-code` de la tâche 1.
- Produces:
  - `source` exporté depuis `@/lib/source` — `source.getPageTree()`, `source.getPage(slug)`, `source.generateParams()`. Consommé par les tâches 4, 5, 7.
  - `baseOptions(): BaseLayoutProps` exporté depuis `@/lib/layout.shared`. Étendu en tâche 7.
  - `getMDXComponents(components?: MDXComponents)` exporté depuis `@/components/mdx`. Étendu en tâche 5.

- [ ] **Step 1: Créer la coque de configuration**

`apps/docs/package.json` :

```json
{
  "name": "@lumyx/docs",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3003",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "check-types": "next typegen && tsc --noEmit",
    "verify:ds": "node scripts/verify-ds.mjs"
  },
  "dependencies": {
    "@lumyx/ui": "workspace:*",
    "fumadocs-core": "^16",
    "fumadocs-mdx": "^12",
    "fumadocs-ui": "^16",
    "geist": "^1.3.1",
    "lucide-react": "^0.487.0",
    "next": "16.3.2",
    "react": "catalog:",
    "react-dom": "catalog:"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/mdx": "^2.0.14",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.3.2",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

Note : `next-themes` n'est pas listé — `RootProvider` de `fumadocs-ui` l'embarque, et une seconde instance casserait la bascule de thème.

`apps/docs/tsconfig.json` — copie exacte de `apps/landing/tsconfig.json` (même `compilerOptions`, même `include`, même `exclude`).

`apps/docs/postcss.config.mjs` :

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

`apps/docs/eslint.config.mjs` — copie exacte de `apps/landing/eslint.config.mjs`.

`apps/docs/.gitignore` — copie exacte de `apps/landing/.gitignore`, plus deux lignes pour les artefacts de Fumadocs MDX :

```
.source
.map.ts
```

`apps/docs/next.config.mjs` :

```js
// Fichier en .mjs et non .ts, contrairement aux autres apps du monorepo : fumadocs-mdx est
// ESM-only et sa documentation recommande explicitement .mjs pour une resolution ESM correcte.
// Un next.config.ts exigerait le resolveur TypeScript natif de Node.
import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  // @lumyx/ui exporte du TypeScript source, pas un build — Next le transpile.
  transpilePackages: ['@lumyx/ui'],
};

export default withMDX(config);
```

- [ ] **Step 2: Copier la garde du design system**

Copie `packages/ui/scripts/verify-ds.mjs` (version amendée par la tâche 1) vers `apps/docs/scripts/verify-ds.mjs`, puis adapte la dernière ligne de succès :

```js
console.log('✓ contraintes du design system respectees (apps/docs)');
```

Vérifie que `COLOR_EXEMPT` pointe bien sur `app/globals.css` et que `SCANNED` couvre `['app', 'components', 'lib']` — c'est le cas dans le fichier source.

- [ ] **Step 3: Installer les dépendances**

Run: `rtk proxy bun install`
Expected: installation réussie depuis la racine. `apps/docs/node_modules` ne doit **pas** apparaître — les liens vivent dans `node_modules/` à la racine.

Vérifie les versions réellement installées, parce que les plages `^16`/`^12` du `package.json` doivent correspondre à Fumadocs v16 :

```bash
rtk proxy bun pm ls | rtk proxy grep fumadocs
```
Expected: `fumadocs-core` et `fumadocs-ui` en 16.x, `fumadocs-mdx` en 12.x. Si les majeures diffèrent, vérifier les notes de version avant de poursuivre — l'API de ce plan est celle de v16.

- [ ] **Step 4: Écrire le pont de tokens**

`apps/docs/app/globals.css` :

```css
/* L'ordre des imports porte le sens du skin : Lumyx pose les valeurs du contrat shadcn,
   shadcn.css de Fumadocs les consomme pour alimenter son propre contrat --color-fd-*, et
   preset.css les applique a ses composants. Inverser l'ordre casse le remappage. */
@import 'tailwindcss';
@import '@lumyx/ui/styles.css';
@import 'fumadocs-ui/css/shadcn.css';
@import 'fumadocs-ui/css/preset.css';

/* Tailwind v4 n'emet que les classes qu'il voit : ni le design system local ni les composants
   compiles de Fumadocs ne sont dans l'arbre de cette app. */
@source '../../../packages/ui/src';
@source '../node_modules/fumadocs-ui/dist';

/* ── Les quatre ecarts que le pont de tokens ne couvre pas ── */
:root {
  /* Fumadocs v16 defaut : 1600px. Lumyx tient sa grille a 1360. */
  --fd-layout-width: var(--content-max);
}

@layer components {
  /* Les titres de section de la sidebar portent le seul manierisme typographique du systeme. */
  #nd-sidebar [data-sidebar-section-title],
  #nd-sidebar .fd-sidebar-section-title {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  /* Echelle de type Lumyx sur le corps de doc : dense (13px de base) la ou Fumadocs suit
     l'echelle Tailwind. */
  #nd-docs-layout .prose,
  .fd-prose {
    font-size: 14px;
    line-height: 1.6;
  }
}
```

Les sélecteurs de sidebar et de prose sont une hypothèse à valider à l'étape 8 : Fumadocs ne documente pas ses noms de classes internes comme une API. Si le sélecteur ne mord pas, l'inspecteur du navigateur donne le bon — le noter en commentaire à côté.

- [ ] **Step 5: Écrire le layout racine**

`apps/docs/app/layout.tsx` :

```tsx
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { RootProvider } from 'fumadocs-ui/provider/next';
import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_DOCS_URL ?? 'https://docs.lumyx.dev';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Lumyx documentation',
    template: '%s — Lumyx docs',
  },
  description:
    'Run, self-host and observe a Lumyx SFU: quickstart, deployment, the six media-path metrics and the REST API.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      {/* flex + min-h-screen sont requis par les layouts de Fumadocs UI. */}
      <body className="flex min-h-screen flex-col">
        {/* Les valeurs reprennent apps/landing/app/layout.tsx : sans alignement, les deux
            domaines ouvrent dans des themes differents. RootProvider embarque next-themes. */}
        <RootProvider
          theme={{ attribute: 'class', defaultTheme: 'dark', enableSystem: false }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Écrire la source, les options de layout et le mapping MDX**

`apps/docs/lib/source.ts` :

```ts
import { loader } from 'fumadocs-core/source';
import { defineDocs } from 'fumadocs-mdx/macro';

const docs = defineDocs({
  dir: 'content/docs',
});

// baseUrl '/' : sur docs.lumyx.dev la documentation est a la racine du domaine. Le prefixe
// /docs de l'ancienne implantation disparait avec le changement de domaine.
export const source = loader({
  baseUrl: '/',
  source: docs.toFumadocsSource(),
});
```

`apps/docs/lib/layout.shared.tsx` :

```tsx
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { Wordmark } from '@lumyx/ui';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lumyx.dev';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <Wordmark />,
      url: SITE_URL,
    },
  };
}
```

`apps/docs/components/mdx.tsx` :

```tsx
import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
```

- [ ] **Step 7: Écrire les routes et une page d'essai**

`apps/docs/app/(docs)/layout.tsx` :

```tsx
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { source } from '@/lib/source';
import { baseOptions } from '@/lib/layout.shared';

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <DocsLayout tree={source.getPageTree()} {...baseOptions()}>
      {children}
    </DocsLayout>
  );
}
```

`apps/docs/app/(docs)/[[...slug]]/page.tsx` :

```tsx
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import { source } from '@/lib/source';
import { getMDXComponents } from '@/components/mdx';

export default async function Page(props: PageProps<'/[[...slug]]'>) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX components={getMDXComponents({ a: createRelativeLink(source, page) })} />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: PageProps<'/[[...slug]]'>): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
  };
}
```

`apps/docs/content/docs/index.mdx` — page d'essai jetable, dont le seul rôle est d'exercer le skin. Elle est remplacée par le contenu réel en tâche 5 :

```mdx
---
title: Skin probe
description: Throwaway page that exercises every element the token bridge has to cover.
---

## Heading level two

Body copy at the Lumyx density, with an [internal link](/index) and `inline code`.

### Heading level three

- First list item
- Second list item

| Field | Unit | Threshold |
| --- | --- | --- |
| `packet_loss_ratio` | ratio | > 2% |

> A blockquote, to check the border token.

```json
{ "packet_loss_ratio": 0.079, "packets_lost": 412, "enabled": true }
```
```

- [ ] **Step 8: Lancer le serveur de dev et valider le skin à l'œil**

```bash
rtk proxy bun run --filter=@lumyx/docs dev
```

Avec le skill `/browse`, ouvre `http://localhost:3003` et vérifie, **dans les deux thèmes** (la bascule est dans le chrome Fumadocs) :

1. Le fond de page est `--surface-page` (clair : `#f5f6f8`, sombre : `#0b0c10`), pas le neutre de Fumadocs.
2. Les cartes et popovers sont `--surface-card`.
3. L'accent — lien actif de sidebar, anneau de focus — est l'indigo Lumyx (clair `#4f39f6`, sombre `#7c68f8`).
4. Les rayons sont généreux (18px sur les conteneurs), pas les 8px de Fumadocs.
5. La largeur de contenu plafonne à 1360px et non 1600px.
6. Les titres de section de la sidebar sont en petites capitales espacées.
7. Le `Wordmark` Lumyx est dans la barre de nav et renvoie vers `lumyx.dev`.

**C'est ici que la collision de blocs `@theme` se manifeste** (spec §4.3) : `@lumyx/ui/styles.css` et `preset.css` déclarent tous deux `--radius`, `--color-primary`, `--color-border`. Une valeur fausse ne produit aucune erreur de build. Si l'un des sept points ci-dessus est faux, inspecte la variable dans le navigateur pour voir laquelle des deux feuilles gagne, et corrige par une redéclaration explicite dans le bloc `:root` de `globals.css` — jamais en modifiant `node_modules`.

Le bloc de code sera encore colorié par le thème Shiki par défaut de Fumadocs, en monospace et en hex : c'est normal, la tâche 4 s'en occupe.

- [ ] **Step 9: Vérifier build, types, lint et design system**

```bash
rtk proxy bun run --filter=@lumyx/docs verify:ds
rtk proxy bun run --filter=@lumyx/docs check-types
rtk proxy bun run --filter=@lumyx/docs lint
rtk proxy bun run --filter=@lumyx/docs build
```
Expected: les quatre au vert. `check-types` lance `next typegen` d'abord, ce qui génère les types `LayoutProps`/`PageProps` — sans lui, il échoue sur des types introuvables.

- [ ] **Step 10: Commit**

```bash
rtk git add apps/docs bun.lock
rtk git commit -m "$(cat <<'EOF'
feat(docs): monter apps/docs sur Fumadocs v16, skinnee Lumyx

Coque de l'app (port 3003) et pont de tokens : shadcn.css de Fumadocs
consomme le contrat shadcn que packages/ui pointe deja sur les tokens
Lumyx, donc le remappage des couleurs tient en un ordre d'imports.

Traite a la main les quatre ecarts que le pont ne couvre pas : largeur de
layout a 1360px, echelle de type dense, rayons, et petites capitales sur
les titres de sidebar.

next.config est en .mjs, contrairement aux autres apps : fumadocs-mdx est
ESM-only. check-types lance next typegen d'abord, les routes etant typees.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Brancher le thème Shiki Lumyx

Remplace la coloration par défaut de Fumadocs par le thème de la tâche 1. Fin de tâche : plus un seul hex dans le HTML des blocs de code.

**Files:**
- Create: `apps/docs/source.config.ts`
- Create: `apps/docs/lib/code-theme.test.ts`

**Interfaces:**
- Consumes: `lumyxCodeTheme` depuis `@lumyx/ui` (tâche 1) ; les tokens `--code-*` (tâche 1) ; `apps/docs/content/docs/index.mdx` (tâche 3) comme sujet de test.
- Produces: rien de nouveau. Modifie le rendu de tout bloc de code.

- [ ] **Step 1: Écrire le test du rendu**

Le test traverse la vraie chaîne Shiki avec le vrai thème : c'est le seul moyen de prouver que la substitution de valeurs arbitraires fonctionne, puisque c'est un comportement interne de Shiki.

Crée `apps/docs/lib/code-theme.test.ts` :

```ts
import { describe, expect, test } from "bun:test";
import { codeToHtml } from "shiki";
import { lumyxCodeTheme } from "@lumyx/ui";

const SAMPLE = `{ "packet_loss_ratio": 0.079, "enabled": true }`;

async function render(code: string, lang: string) {
  return codeToHtml(code, { lang, theme: lumyxCodeTheme });
}

describe("coloration avec le theme lumyx", () => {
  test("n'emet aucune couleur litterale", async () => {
    const html = await render(SAMPLE, "json");
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(html).not.toMatch(/\brgba?\(/);
  });

  test("emet des variables CSS --code-* comme couleurs de token", async () => {
    const html = await render(SAMPLE, "json");
    expect(html).toContain("var(--code-");
  });

  test("distingue au moins trois roles sur un echantillon JSON", async () => {
    const html = await render(SAMPLE, "json");
    const roles = new Set(html.match(/var\(--code-[a-z]+\)/g) ?? []);
    expect(roles.size).toBeGreaterThanOrEqual(3);
  });

  test("colorie aussi Rust, TOML et shell — les langues de cette doc", async () => {
    for (const [code, lang] of [
      ['let peer = room.peer("ff104b2c")?;', "rust"],
      ['[collector]\nthresholds = true', "toml"],
      ['docker run -p 3000:3000 ghcr.io/frekimanagarm/lumyx:latest', "bash"],
    ] as const) {
      const html = await render(code, lang);
      expect(html).toContain("var(--code-");
      expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    }
  });
});
```

Ajoute à `apps/docs/package.json`, dans `scripts`, après `check-types` :

```json
"test": "bun test",
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `rtk proxy bun run --filter=@lumyx/docs test`
Expected: FAIL — `Cannot find module "shiki"`. `shiki` est une dépendance transitive de `fumadocs-core` et n'est pas résoluble directement.

- [ ] **Step 3: Déclarer `shiki` en dépendance de développement**

Le test importe `shiki` directement ; il doit être déclaré. Dans `apps/docs/package.json`, ajoute à `devDependencies` :

```json
"shiki": "^4",
```

Run: `rtk proxy bun install`
Puis relance : `rtk proxy bun run --filter=@lumyx/docs test`
Expected: PASS — 4 tests. Si un test échoue en montrant des hex, c'est que Shiki n'a pas appliqué la substitution de valeurs arbitraires : vérifier que le thème est passé comme **objet** et non comme nom, et que sa version est bien 4.x.

- [ ] **Step 4: Brancher le thème dans la config MDX**

Crée `apps/docs/source.config.ts` :

```ts
import { defineConfig } from 'fumadocs-mdx/config';
import { lumyxCodeTheme } from '@lumyx/ui';

export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: {
      // Un seul theme, et non la paire clair/sombre par defaut de Fumadocs : les couleurs sont
      // des variables CSS qui basculent deja d'elles-memes sous .dark.
      theme: lumyxCodeTheme,

      // Par defaut Fumadocs pose sur le <pre> un attribut `icon` contenant une chaine HTML de
      // logo de langage, destinee a dangerouslySetInnerHTML. Le systeme Lumyx ne met pas de
      // logo dans un bloc de code.
      icon: false,
    },
  },
});
```

- [ ] **Step 5: Vérifier le HTML réellement produit par la page**

Un test unitaire prouve que Shiki sait le faire ; il ne prouve pas que Fumadocs a bien reçu l'option. Vérifie la sortie de la vraie page.

```bash
rtk proxy bun run --filter=@lumyx/docs dev
```

Puis, dans un autre terminal :

```bash
rtk proxy curl -s http://localhost:3003 | rtk proxy grep -o 'var(--code-[a-z]*)' | sort -u
```
Expected: plusieurs rôles distincts listés.

```bash
rtk proxy curl -s http://localhost:3003 | rtk proxy grep -c '\--shiki-light'
```
Expected: `0`. Un résultat non nul signifie que la paire de thèmes par défaut est toujours active et que `theme:` n'a pas pris le pas sur `themes:` — passer explicitement `themes: undefined` à côté de `theme`.

- [ ] **Step 6: Vérifier le bloc de code à l'œil**

Avec `/browse` sur `http://localhost:3003`, dans les deux thèmes :

1. Le bloc de code est en Geist Mono, à 12,5px.
2. Son fond est `--surface-sunken`, distinct du fond de page.
3. Les chaînes sont vertes (`--ok`), les nombres coraux (`--accent-2`), les mots-clés indigo (`--accent-text`), les clés JSON en `--text-strong`, les commentaires en `--text-faint`.
4. Aucun logo de langage dans l'en-tête du bloc.
5. **Aucun token en noir pur** — un token noir signale une variable `--code-*` non définie, échec silencieux le plus probable de cette tâche.
6. En basculant clair ↔ sombre, les couleurs de code suivent sans rechargement.

- [ ] **Step 7: Vérifier la chaîne complète**

```bash
rtk proxy bun run --filter=@lumyx/docs verify:ds
rtk proxy bun run --filter=@lumyx/docs check-types
rtk proxy bun run --filter=@lumyx/docs build
```
Expected: les trois au vert.

- [ ] **Step 8: Commit**

```bash
rtk git add apps/docs/source.config.ts apps/docs/lib/code-theme.test.ts \
  apps/docs/package.json bun.lock
rtk git commit -m "$(cat <<'EOF'
feat(docs): colorier le code avec les tokens Lumyx

Branche le theme Shiki lumyx dans rehypeCodeOptions : un seul theme au
lieu de la paire clair/sombre par defaut, les couleurs etant des
variables CSS qui basculent seules sous .dark.

Coupe l'option icon, qui posait sur le <pre> une chaine HTML de logo de
langage destinee a dangerouslySetInnerHTML.

Les tests traversent la vraie chaine Shiki sur JSON, Rust, TOML et shell
et prouvent qu'aucune valeur hexadecimale ne subsiste dans le rendu.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Migrer les cinq pages existantes

**Files:**
- Create: `apps/docs/content/docs/meta.json`
- Create: `apps/docs/lib/metrics-data.ts`
- Create: `apps/docs/lib/site-data.ts`
- Create: `apps/docs/components/metrics-reference.tsx`
- Create: `apps/docs/components/metrics-reference.test.tsx`
- Create: `apps/docs/components/doc-cards.tsx`
- Modify: `apps/docs/components/mdx.tsx`
- Replace: `apps/docs/content/docs/index.mdx` (la page d'essai de la tâche 3)
- Create: `apps/docs/content/docs/quickstart.mdx`
- Create: `apps/docs/content/docs/self-hosting.mdx`
- Create: `apps/docs/content/docs/cloud.mdx`
- Create: `apps/docs/content/docs/metrics-reference.mdx`

**Interfaces:**
- Consumes: `getMDXComponents` (tâche 3), `source` (tâche 3), tokens et thème (tâches 1 et 4).
- Produces:
  - `METRICS` exporté depuis `@/lib/metrics-data`, type `Metric = { name, field, unit, threshold, scope, breaks, body, sample, action }`.
  - `VERSION: string` et `REPO: string` exportés depuis `@/lib/site-data`.
  - `MetricsReference` exporté depuis `@/components/metrics-reference`, sans props.
  - `DocCards({ children })` et `DocCard({ href, title, children })` exportés depuis `@/components/doc-cards`.

- [ ] **Step 1: Reprendre les données de la landing**

Crée `apps/docs/lib/metrics-data.ts`. Le contenu est repris de `apps/landing/lib/docs-data.ts`, avec un type explicite ajouté :

```ts
export type Metric = {
  name: string;
  field: string;
  unit: string;
  threshold: string;
  scope: string;
  breaks: string;
  body: string;
  sample: string[];
  action: string;
};

export const METRICS: Metric[] = [
  {
    name: "Packet loss", field: "packet_loss_ratio", unit: "ratio, shown as %", threshold: "> 2%", scope: "peer, room",
    breaks: "Choppy audio, frozen frames",
    body: "Fraction of RTP packets the receiver reported missing over the interval, read from RTCP receiver reports. Above 2% sustained, audio artefacts become audible before video visibly breaks.",
    sample: ['"packet_loss_ratio": 0.079,', '"packets_lost": 412,', '"packets_expected": 5215'],
    action: "Response: force audio-only for that peer, or drop it to a lower simulcast layer to reduce what has to survive the link.",
  },
  {
    name: "Round-trip time", field: "rtt_ms", unit: "milliseconds", threshold: "> 200ms", scope: "peer",
    breaks: "Participants talking over each other",
    body: "Round trip between the SFU and the peer, from RTCP sender/receiver report timestamps. Conversation stops feeling natural somewhere past 200ms one-way perceived latency.",
    sample: ['"rtt_ms": 284,', '"rtt_p95_ms": 331,', '"ice_candidate_type": "relay"'],
    action: "Response: check whether the peer fell back to a TURN relay, and whether a closer region exists for that user population.",
  },
  {
    name: "Jitter", field: "jitter_ms", unit: "milliseconds", threshold: "> 30ms", scope: "peer",
    breaks: "Growing jitter buffer, drifting latency",
    body: "Variance in packet arrival timing. The receiver absorbs it by growing its jitter buffer, which trades latency for smoothness — so high jitter shows up as delay creeping upward rather than as loss.",
    sample: ['"jitter_ms": 42,', '"jitter_buffer_delay_ms": 180'],
    action: "Response: usually a network path problem rather than a bandwidth problem. Compare with loss before touching bitrate.",
  },
  {
    name: "NACK ratio", field: "nack_ratio", unit: "ratio, shown as %", threshold: "> 5%", scope: "peer",
    breaks: "Retransmission storms, saturated uplink",
    body: "Share of packets that had to be requested again. A rising NACK ratio is the earliest signal that a peer uplink is saturated — it moves before loss and before freeze ratio.",
    sample: ['"nack_ratio": 0.114,', '"nack_count": 1284,', '"retransmit_bytes": 482113'],
    action: "Response: reduce the target bitrate for that publisher, or turn off the highest simulcast layer for the room.",
  },
  {
    name: "Freeze ratio", field: "freeze_ratio", unit: "ratio, shown as %", threshold: "> 1%", scope: "peer",
    breaks: "Video the user calls broken",
    body: "Share of the interval during which the decoder produced no new frame. This is the metric closest to what a participant actually complains about, which is why its threshold is the tightest.",
    sample: ['"freeze_ratio": 0.041,', '"freeze_count": 6,', '"total_freeze_duration_ms": 2460'],
    action: "Response: if freeze is high while loss is low, look at the sender — encoder starvation and CPU pressure produce exactly this shape.",
  },
  {
    name: "Bitrate", field: "bitrate_kbps", unit: "kilobits per second", threshold: "< 100kbps", scope: "peer, track, room",
    breaks: "Encoder giving up entirely",
    body: "Forwarded bitrate per track. Reported as a floor rather than a ceiling: a video track that collapses under 100kbps has effectively stopped being video.",
    sample: ['"bitrate_kbps": 84,', '"target_bitrate_kbps": 1200,', '"codec": "vp8", "layer": "f"'],
    action: "Response: check congestion control decisions and whether the publisher is CPU-bound before assuming the network.",
  },
];
```

Ne reprends ni `DOC_NAV`, ni `RELEASES`, ni les types de nav : la nav vient désormais du page tree, et `RELEASES` reste dans la landing pour son changelog.

Crée `apps/docs/lib/site-data.ts` avec les deux seules constantes que les pages migrées consomment :

```ts
// Reprises de apps/landing/lib/site-data.ts. Duplication assumee et volontairement minimale :
// deux constantes plutot qu'un paquet partage pour deux chaines.
export const VERSION = "v0.4.1";
export const REPO = "https://github.com/FrekiManagarm/lumyx";
```

- [ ] **Step 2: Écrire le test de `MetricsReference`**

Crée `apps/docs/components/metrics-reference.test.tsx` :

```tsx
import { describe, expect, test } from "bun:test";
import { METRICS } from "../lib/metrics-data";

describe("donnees des metriques", () => {
  test("porte les six metriques du collecteur", () => {
    expect(METRICS).toHaveLength(6);
    expect(METRICS.map((m) => m.field)).toEqual([
      "packet_loss_ratio",
      "rtt_ms",
      "jitter_ms",
      "nack_ratio",
      "freeze_ratio",
      "bitrate_kbps",
    ]);
  });

  test("chaque metrique porte les neuf champs que la page rend", () => {
    for (const m of METRICS) {
      for (const key of ["name", "field", "unit", "threshold", "scope", "breaks", "body", "action"] as const) {
        expect(typeof m[key]).toBe("string");
        expect(m[key].length).toBeGreaterThan(0);
      }
      expect(Array.isArray(m.sample)).toBe(true);
      expect(m.sample.length).toBeGreaterThan(0);
    }
  });

  test("les champs servent d'ancres, donc ils sont uniques", () => {
    expect(new Set(METRICS.map((m) => m.field)).size).toBe(METRICS.length);
  });
});
```

- [ ] **Step 3: Lancer le test pour le voir échouer**

Run: `rtk proxy bun run --filter=@lumyx/docs test`
Expected: FAIL — `Cannot find module "../lib/metrics-data"` si l'étape 1 n'est pas faite, sinon PASS directement. Si l'étape 1 est faite et le test passe, c'est correct : ces tests gardent la copie des données contre une reprise incomplète.

- [ ] **Step 4: Écrire `MetricsReference`**

Crée `apps/docs/components/metrics-reference.tsx` :

```tsx
import { Card, CardContent } from '@lumyx/ui';
import { METRICS } from '@/lib/metrics-data';

/**
 * Les six metriques, rendues depuis les donnees plutot que reecrites en prose MDX : sept champs
 * par metrique se tiennent mieux dans un objet que dans des paragraphes paralleles.
 * `field` sert d'ancre, ce qui alimente la table des matieres de la page.
 */
export function MetricsReference() {
  return (
    <div className="flex flex-col gap-8">
      {METRICS.map((m) => (
        <section key={m.field} id={m.field} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="text-20 font-semibold tracking-[-0.02em] text-strong">{m.name}</h3>
            <span className="font-mono text-code text-muted">{m.field}</span>
          </div>

          <p className="max-w-[680px] text-14 leading-relaxed text-body text-pretty">{m.body}</p>

          <Card>
            <CardContent className="flex flex-col gap-2">
              <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {[
                  ['Unit', m.unit],
                  ['Default threshold', m.threshold],
                  ['Scope', m.scope],
                ].map(([label, value]) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    <dt className="sl-label">{label}</dt>
                    <dd className="text-13 text-body">{value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-1 rounded-md border border-subtle bg-sunken px-4 py-3.5">
            {m.sample.map((line) => (
              <span key={line} className="whitespace-pre font-mono text-code text-body">
                {line}
              </span>
            ))}
          </div>

          <p className="max-w-[680px] text-13 text-muted text-pretty">
            <span className="text-strong">What breaks:</span> {m.breaks}
          </p>
          <p className="max-w-[680px] text-13 text-muted text-pretty">{m.action}</p>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Écrire la grille de cartes de liens**

`index.mdx` termine par une grille de quatre cartes « Where to go next ». Fumadocs fournit `Cards`/`Card`, mais son `Card` collisionnerait avec celui de `@lumyx/ui` dans le mapping MDX, et son rendu n'est pas celui du système. On reconstruit la paire sur les primitives Lumyx, en reprenant le balisage de l'ancienne page.

Crée `apps/docs/components/doc-cards.tsx` :

```tsx
import Link from 'next/link';
import { Card, CardContent } from '@lumyx/ui';

export function DocCards({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}

export function DocCard({
  href,
  title,
  children,
}: {
  href: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="no-underline hover:no-underline">
      <Card className="h-full transition-colors duration-[120ms] ease-[var(--ease-out)] hover:border-stroke">
        <CardContent className="flex flex-col gap-1.5">
          <span className="text-14 font-medium text-strong">{title}</span>
          <span className="text-13 leading-relaxed text-muted text-pretty">{children}</span>
        </CardContent>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 6: Exposer les composants au MDX**

Remplace le contenu de `apps/docs/components/mdx.tsx` :

```tsx
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Callout } from 'fumadocs-ui/components/callout';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { Step, Steps } from 'fumadocs-ui/components/steps';
import type { MDXComponents } from 'mdx/types';
import { Card, CardContent } from '@lumyx/ui';
import { MetricsReference } from '@/components/metrics-reference';
import { DocCard, DocCards } from '@/components/doc-cards';

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,

    // `DocSection` rendait un h2 precede d'une hairline : c'etait le rythme visuel de l'ancienne
    // doc. Porte ici, il s'obtient avec un simple `## Titre` en MDX.
    h2: (props: React.ComponentProps<'h2'>) => (
      <h2
        {...props}
        className="mt-8 border-t border-hairline pt-8 text-26 font-semibold tracking-[-0.02em] text-strong"
      />
    ),
    h3: (props: React.ComponentProps<'h3'>) => (
      <h3 {...props} className="mt-6 text-20 font-semibold tracking-[-0.02em] text-strong" />
    ),
    p: (props: React.ComponentProps<'p'>) => (
      <p {...props} className="max-w-[680px] text-14 leading-relaxed text-body text-pretty" />
    ),

    Callout,
    Tabs,
    Tab,
    Steps,
    Step,
    Card,
    CardContent,
    MetricsReference,
    DocCards,
    DocCard,

    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
```

- [ ] **Step 7: Écrire `meta.json`**

Crée `apps/docs/content/docs/meta.json`. Les chaînes `---Titre---` sont les séparateurs de section de Fumadocs ; elles reproduisent les quatre sections de l'ancien `DOC_NAV` sans enfoncer les slugs d'un niveau :

```json
{
  "pages": [
    "---Getting started---",
    "index",
    "quickstart",
    "self-hosting",
    "cloud",
    "---Core concepts---",
    "rooms",
    "peers",
    "signaling",
    "forwarding",
    "---Observability---",
    "metrics-reference",
    "alerting",
    "topology",
    "replay",
    "prometheus",
    "---Reference---",
    "api",
    "config",
    "errors"
  ]
}
```

Les onze dernières entrées pointent sur des fichiers créés en tâche 6. Tant qu'ils n'existent pas, Fumadocs les ignore silencieusement ; la nav est incomplète mais l'app tourne.

- [ ] **Step 8: Migrer les cinq pages**

Pour chacune des cinq pages, ouvre la source TSX et transpose. La règle de transposition, identique pour les cinq :

| Dans le TSX | En MDX |
| --- | --- |
| `title` de `DocsLayout` | `title:` du frontmatter |
| `description` de `DocsLayout` | `description:` du frontmatter |
| `crumb`, `activeId`, `toc` | **supprimés** — dérivés par Fumadocs |
| `<DocSection id="x" title="T">` | `## T` (l'ancre est dérivée du titre) |
| `<p className="…">` | paragraphe Markdown nu |
| `<CodeBlock lines={[…]} />` | bloc de code clôturé, avec le langage |
| `<Card><CardContent>` | `<Card><CardContent>` (inchangé, les composants sont exposés) |
| `<Link href="/docs/x">` | `[texte](/x)` — le préfixe `/docs` tombe |
| `{VERSION}`, `{REPO}` | `import { VERSION, REPO } from '@/lib/site-data'` en tête de MDX |

Remplace `apps/docs/content/docs/index.mdx` (la page d'essai) par la transposition de `apps/landing/app/docs/page.tsx`. Frontmatter :

```mdx
---
title: Introduction
description: Lumyx is a WebRTC SFU with observability built into the media path — one binary carries signaling, forwarding and the dashboard, and the collector reads the six metrics below off RTCP as packets pass through.
---
```

Les quatre sections `what-it-is`, `architecture`, `open-source`, `next` deviennent quatre `##`. Le diagramme ASCII de la section architecture devient un bloc de code clôturé sans langage (```` ``` ````), et non une `Card` remplie de `<span>` : c'est du texte préformaté, le bloc de code le sert mieux.

La grille de quatre cartes « Where to go next » utilise la paire de l'étape 5, avec les quatre entrées de `NEXT_STEPS` de la page d'origine et les `href` amputés de leur préfixe `/docs` :

```mdx
<DocCards>
  <DocCard href="/quickstart" title="Quickstart">
    Run the SFU locally and connect a client in a couple of minutes.
  </DocCard>
  <DocCard href="/self-hosting" title="Self-hosting">
    Deploy the binary in production — Docker, from source, or behind your own proxy.
  </DocCard>
  <DocCard href="/cloud" title="Lumyx Cloud">
    Same SFU, hosted. Regions, retention and alerting wired in.
  </DocCard>
  <DocCard href="/metrics-reference" title="Metrics reference">
    The six metrics the collector reads off RTCP, and what each threshold breach means.
  </DocCard>
</DocCards>
```

`quickstart.mdx` : transposition de `apps/landing/app/docs/quickstart/page.tsx`. Les deux `CodeBlock` deviennent des blocs ```` ```bash ```` et ```` ```ts ````.

`self-hosting.mdx` : transposition de `apps/landing/app/docs/self-hosting/page.tsx`. Les trois `CodeBlock` prennent le langage qui leur correspond — inspecte le contenu pour choisir entre `bash`, `toml` et `dockerfile`.

`cloud.mdx` : transposition de `apps/landing/app/docs/cloud/page.tsx`. Le `CodeBlock` unique devient ```` ```bash ````.

`metrics-reference.mdx` : la page est presque entièrement pilotée par les données.

```mdx
---
title: Metrics reference
description: The six metrics the collector reads off RTCP as packets pass through, what each threshold breach means, and what to do about it.
---

## The six metrics

<MetricsReference />
```

Reprends le paragraphe d'introduction de `apps/landing/app/docs/metrics-reference/page.tsx` au-dessus du composant s'il en porte un.

- [ ] **Step 9: Lancer les tests et vérifier le rendu**

```bash
rtk proxy bun run --filter=@lumyx/docs test
rtk proxy bun run --filter=@lumyx/docs check-types
rtk proxy bun run --filter=@lumyx/docs verify:ds
rtk proxy bun run --filter=@lumyx/docs build
```
Expected: les quatre au vert. Le build doit lister cinq routes statiques.

- [ ] **Step 10: Comparer chaque page migrée à son original**

C'est le contrôle de la tâche. Lance les deux serveurs en parallèle :

```bash
rtk proxy bun run --filter=@lumyx/landing dev   # 3000
rtk proxy bun run --filter=@lumyx/docs dev      # 3003
```

Avec `/browse`, compare deux à deux, **dans les deux thèmes** :

| Original | Migré |
| --- | --- |
| `localhost:3000/docs` | `localhost:3003/` |
| `localhost:3000/docs/quickstart` | `localhost:3003/quickstart` |
| `localhost:3000/docs/self-hosting` | `localhost:3003/self-hosting` |
| `localhost:3000/docs/cloud` | `localhost:3003/cloud` |
| `localhost:3000/docs/metrics-reference` | `localhost:3003/metrics-reference` |

Vérifie pour chacune : aucune perte de prose ni de snippet, la hairline au-dessus de chaque `##`, les liens internes qui résolvent (le préfixe `/docs` a sauté — un lien oublié donne un 404), la table des matières dérivée qui liste les mêmes sections que l'ancien tableau `toc` saisi à la main.

- [ ] **Step 11: Commit**

```bash
rtk git add apps/docs/content apps/docs/lib apps/docs/components apps/docs/package.json
rtk git commit -m "$(cat <<'EOF'
feat(docs): migrer les cinq pages de documentation en MDX

Transpose introduction, quickstart, self-hosting, cloud et la reference
des metriques depuis les pages TSX de la landing. Le frontmatter remplace
title et description ; crumb, activeId et le tableau toc disparaissent,
Fumadocs les derivant du page tree et des titres.

DocSection devient un simple ## en MDX, la hairline etant portee par
l'override de h2 dans components/mdx.tsx.

Les six metriques restent des donnees, rendues par MetricsReference
plutot qu'aplaties en prose.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Les onze squelettes

Rend la nav complète et navigable. Le corps rédactionnel est hors périmètre ; chaque page annonce son état.

**Files:**
- Create: `apps/docs/content/docs/rooms.mdx`, `peers.mdx`, `signaling.mdx`, `forwarding.mdx`
- Create: `apps/docs/content/docs/alerting.mdx`, `topology.mdx`, `replay.mdx`, `prometheus.mdx`
- Create: `apps/docs/content/docs/api.mdx`, `config.mdx`, `errors.mdx`

**Interfaces:**
- Consumes: `Callout` via `getMDXComponents` (tâche 5) ; `meta.json` (tâche 5), qui référence déjà ces onze slugs.
- Produces: onze pages résolvables, complétant la nav.

- [ ] **Step 1: Écrire les onze fichiers**

Chacun suit ce gabarit exact — frontmatter, avertissement, plan de sections :

```mdx
---
title: <Titre>
description: <une phrase disant ce que la page couvrira>
---

<Callout type="warn" title="Draft">
  This page is an outline. The sections below are the intended shape; the prose is still being
  written.
</Callout>

## <Section 1>

## <Section 2>

## <Section 3>
```

Les `title` reprennent **exactement** les libellés de `DOC_NAV` dans `apps/landing/lib/docs-data.ts`, pour que la nav ne change pas de vocabulaire en changeant de moteur. Titres, descriptions et sections, à reprendre tels quels :

| Fichier | `title` | `description` | Sections (`##`) |
| --- | --- | --- | --- |
| `rooms.mdx` | Rooms and sessions | A room is created on first join and disposed when the last peer leaves; a session is one continuous occupancy of it. | Lifecycle · Identifiers · Limits |
| `peers.mdx` | Peers and tracks | Each peer holds one transport and publishes zero or more tracks, which subscribers request individually. | Joining a room · Publishing · Subscribing |
| `signaling.mdx` | Signaling protocol | Clients drive Lumyx over a WebSocket, exchanging offer, answer and ICE candidates as JSON envelopes. | Transport · Message envelope · Offer and answer · ICE candidates |
| `forwarding.mdx` | Selective forwarding | Lumyx forwards packets without transcoding, choosing which simulcast layer each subscriber receives. | What an SFU does not do · Simulcast layers · Subscription control |
| `alerting.mdx` | Alerting and webhooks | Every peer gets default thresholds on connect; breaches debounce for 30 seconds before firing a webhook. | Default thresholds · Debounce window · Webhook payload |
| `topology.mdx` | Room topology | The topology view renders the publish and subscribe edges of a room, each carrying its own bitrate. | Reading the graph · Per-edge bitrate |
| `replay.mdx` | Session replay | Sessions replay from the in-memory window by default, and from Postgres or object storage once a backend is configured. | Retention window · Storage backends · Replaying a session |
| `prometheus.mdx` | Prometheus endpoint | The same six metrics the dashboard reads are exported on `/metrics` in Prometheus text format. | Scrape configuration · Exported series · Labels |
| `api.mdx` | REST API | Rooms, peers and tokens are managed over a JSON REST API authenticated with a project key. | Authentication · Rooms · Peers · Tokens |
| `config.mdx` | Configuration | Lumyx starts with no config file; every setting has a default, an environment variable and a file key. | Precedence · Environment variables · File reference |
| `errors.mdx` | Error codes | Every error Lumyx returns carries a stable code, across signaling, HTTP and the media path. | Signaling errors · HTTP errors · Media errors |

Les descriptions sont dans la voix des cinq pages migrées : affirmatives et concrètes, jamais « this page will explain ».

- [ ] **Step 2: Vérifier que la nav est complète**

```bash
rtk proxy bun run --filter=@lumyx/docs build
```
Expected: le build liste **seize** routes statiques (5 + 11).

- [ ] **Step 3: Parcourir la nav à l'œil**

Avec `/browse` sur `http://localhost:3003`, vérifie : les quatre séparateurs de section apparaissent en petites capitales, les seize entrées sont cliquables, aucune n'est grisée ou morte, et un squelette affiche bien son `Callout` d'avertissement.

- [ ] **Step 4: Vérifier la chaîne et commiter**

```bash
rtk proxy bun run --filter=@lumyx/docs check-types
rtk proxy bun run --filter=@lumyx/docs verify:ds
rtk git add apps/docs/content/docs
rtk git commit -m "$(cat <<'EOF'
feat(docs): ajouter les onze pages restantes en squelette

Frontmatter, plan de sections et avertissement de redaction en cours pour
rooms, peers, signaling, forwarding, alerting, topology, replay,
prometheus, api, config et errors.

Les titres reprennent les libelles de DOC_NAV : la nav passe de onze
entrees grisees non cliquables a seize pages reelles.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Recherche, SEO et finition du chrome

**Files:**
- Create: `apps/docs/app/api/search/route.ts`
- Create: `apps/docs/app/sitemap.ts`
- Create: `apps/docs/app/robots.ts`
- Create: `apps/docs/app/sitemap.test.ts`
- Modify: `apps/docs/lib/layout.shared.tsx`
- Modify: `turbo.json`

**Interfaces:**
- Consumes: `source` (tâche 3) ; les seize pages (tâches 5 et 6).
- Produces: route `GET /api/search` ; `sitemap()` et `robots()` par défaut.

- [ ] **Step 1: Ajouter la route de recherche**

Crée `apps/docs/app/api/search/route.ts` :

```ts
import { createFromSource } from 'fumadocs-core/search/server';
import { source } from '@/lib/source';

// Recherche statique, indexee au build. A seize pages, un service heberge ajouterait une cle a
// gerer pour un gain nul.
export const { GET } = createFromSource(source, {
  language: 'english',
});
```

- [ ] **Step 2: Vérifier que la recherche répond et trouve**

```bash
rtk proxy bun run --filter=@lumyx/docs dev
rtk proxy curl -s 'http://localhost:3003/api/search?query=packet%20loss' | head -c 600
```
Expected: du JSON citant la page `metrics-reference`. Une réponse vide sur une requête dont le terme figure dans le contenu signale un index non construit — vérifier que `source` est bien celui de `lib/source.ts`.

Puis avec `/browse` : ouvre `http://localhost:3003`, déclenche la recherche (⌘K), tape `jitter`. Vérifie que le dialog adopte les tokens Lumyx — fond `--surface-card`, ligne sélectionnée `--accent-tint` — et non le neutre de Fumadocs.

- [ ] **Step 3: Compléter le chrome de nav**

Dans `apps/docs/lib/layout.shared.tsx`, remplace le corps de `baseOptions()` pour ajouter les liens de retour et garder la bascule de thème :

```tsx
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { Wordmark } from '@lumyx/ui';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lumyx.dev';
const REPO = 'https://github.com/FrekiManagarm/lumyx';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <Wordmark />,
      url: SITE_URL,
    },
    links: [
      { text: 'Home', url: SITE_URL, external: true },
      { text: 'GitHub', url: REPO, external: true },
    ],
    // La bascule reste visible : sans elle, un visiteur passe en clair sur lumyx.dev n'a aucun
    // moyen de retrouver le clair ici, localStorage etant cloisonne par origine.
    themeSwitch: { enabled: true },
  };
}
```

- [ ] **Step 4: Écrire le test du sitemap**

Crée `apps/docs/app/sitemap.test.ts` :

```ts
import { describe, expect, test } from "bun:test";
import sitemap from "./sitemap";

describe("sitemap", () => {
  test("liste les seize pages de la documentation", () => {
    expect(sitemap()).toHaveLength(16);
  });

  test("toutes les URLs sont absolues sur le domaine de la doc", () => {
    for (const entry of sitemap()) {
      expect(entry.url).toMatch(/^https:\/\//);
      expect(entry.url).toContain("docs.lumyx.dev");
    }
  });

  test("l'accueil est present et prioritaire", () => {
    const home = sitemap().find((e) => e.url === "https://docs.lumyx.dev/");
    expect(home).toBeDefined();
    expect(home?.priority).toBe(1);
  });

  test("aucune URL en double", () => {
    const urls = sitemap().map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
```

- [ ] **Step 5: Lancer le test pour le voir échouer**

Run: `rtk proxy bun run --filter=@lumyx/docs test`
Expected: FAIL — `Cannot find module "./sitemap"`.

- [ ] **Step 6: Écrire le sitemap et le robots**

`apps/docs/app/sitemap.ts` — dérivé du page tree plutôt que d'une liste tenue à la main, pour qu'une page ajoutée n'exige pas de s'en souvenir :

```ts
import type { MetadataRoute } from 'next';
import { source } from '@/lib/source';

const SITE_URL = process.env.NEXT_PUBLIC_DOCS_URL ?? 'https://docs.lumyx.dev';

export default function sitemap(): MetadataRoute.Sitemap {
  return source.getPages().map((page) => ({
    url: `${SITE_URL}${page.url}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: page.url === '/' ? 1 : 0.7,
  }));
}
```

`apps/docs/app/robots.ts` — calqué sur celui de la landing :

```ts
import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_DOCS_URL ?? 'https://docs.lumyx.dev';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
```

Run: `rtk proxy bun run --filter=@lumyx/docs test`
Expected: PASS — 4 tests. Si le compte n'est pas 16, c'est que `source.getPages()` ne renvoie pas ce qu'on croit : afficher le tableau pour voir ce qu'il contient.

- [ ] **Step 7: Déclarer la variable d'environnement partagée**

Dans `turbo.json`, ajoute `"NEXT_PUBLIC_DOCS_URL"` au tableau `globalEnv`, après `"NEXT_PUBLIC_SITE_URL"` :

```json
"globalEnv": ["NODE_ENV", "VERCEL_ENV", "NEXT_PUBLIC_DASHBOARD_URL", "NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_DOCS_URL", "NEXT_PUBLIC_PLAUSIBLE_DOMAIN"],
```

- [ ] **Step 8: Vérifier et commiter**

```bash
rtk proxy bun run --filter=@lumyx/docs check-types
rtk proxy bun run --filter=@lumyx/docs verify:ds
rtk proxy bun run --filter=@lumyx/docs lint
rtk proxy bun run --filter=@lumyx/docs build
rtk git add apps/docs/app apps/docs/lib/layout.shared.tsx turbo.json
rtk git commit -m "$(cat <<'EOF'
feat(docs): recherche statique, sitemap, robots et chrome de nav

Recherche indexee au build via createFromSource, sans service externe.
Le sitemap derive du page tree plutot que d'une liste tenue a la main.
La nav porte le Wordmark, les liens de retour vers lumyx.dev et le depot,
et garde la bascule de theme visible — localStorage etant cloisonne par
origine, c'est le seul moyen de retrouver le clair depuis la doc.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Retirer l'ancienne doc et rediriger

Dernière tâche : la landing cesse de servir la doc. À faire seulement quand la tâche 5 a confirmé visuellement les cinq pages — c'est le point de non-retour.

**Files:**
- Delete: `apps/landing/app/docs/` (5 pages)
- Delete: `apps/landing/components/site/docs-layout.tsx`
- Modify: `apps/landing/lib/docs-data.ts`
- Modify: `apps/landing/next.config.ts`
- Modify: `apps/landing/app/sitemap.ts`
- Create: `apps/landing/next.config.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces: redirections permanentes de `lumyx.dev/docs*` vers `docs.lumyx.dev`.

- [ ] **Step 1: Confirmer qu'aucun autre consommateur ne subsiste**

```bash
rtk proxy grep -rn "docs-layout\|DOC_NAV\|METRICS" apps/landing/app apps/landing/components apps/landing/lib
```
Expected: uniquement des occurrences dans `app/docs/`, `components/site/docs-layout.tsx` et la déclaration dans `lib/docs-data.ts`. Toute autre occurrence — en particulier dans `components/site/chrome.tsx`, qui porte le header — doit être traitée avant la suppression.

```bash
rtk proxy grep -rn '"/docs' apps/landing/app apps/landing/components apps/landing/lib
```
Expected: liste les liens vers `/docs` dans le header, le pied de page et la home. Ils doivent tous pointer vers `docs.lumyx.dev` à l'étape 4 — sinon ils traverseront une redirection à chaque clic.

- [ ] **Step 2: Écrire le test des redirections**

Crée `apps/landing/next.config.test.ts` :

```ts
import { describe, expect, test } from "bun:test";
import config from "./next.config";

const DOCS = "https://docs.lumyx.dev";

describe("redirections de /docs vers le sous-domaine", () => {
  test("declare une fonction redirects", () => {
    expect(typeof config.redirects).toBe("function");
  });

  test("redirige /docs nu, l'URL la plus liee des deux", async () => {
    const rules = await config.redirects!();
    const bare = rules.find((r) => r.source === "/docs");
    expect(bare).toBeDefined();
    expect(bare?.destination).toBe(DOCS);
    expect(bare?.permanent).toBe(true);
  });

  test("redirige les sous-chemins en conservant le chemin", async () => {
    const rules = await config.redirects!();
    const nested = rules.find((r) => r.source === "/docs/:path*");
    expect(nested).toBeDefined();
    expect(nested?.destination).toBe(`${DOCS}/:path*`);
    expect(nested?.permanent).toBe(true);
  });
});
```

- [ ] **Step 3: Lancer le test pour le voir échouer**

Run: `cd apps/landing && rtk proxy bun test next.config.test.ts`
Expected: FAIL sur le premier test — `config.redirects` est `undefined`.

- [ ] **Step 4: Ajouter les redirections**

Dans `apps/landing/next.config.ts`, remplace le contenu par :

```ts
import type { NextConfig } from 'next';

const DOCS_URL = process.env.NEXT_PUBLIC_DOCS_URL ?? 'https://docs.lumyx.dev';

const nextConfig: NextConfig = {
  // @lumyx/ui exporte du TypeScript source, pas un build — Next le transpile.
  transpilePackages: ['@lumyx/ui'],
  env: {
    CLOUD_APP_URL: process.env.CLOUD_APP_URL
  },
  // La documentation a demenage sur docs.lumyx.dev. Deux regles : `/docs/:path*` ne capture pas
  // `/docs` nu, et c'est l'URL la plus liee des deux.
  async redirects() {
    return [
      { source: '/docs', destination: DOCS_URL, permanent: true },
      { source: '/docs/:path*', destination: `${DOCS_URL}/:path*`, permanent: true },
    ];
  }
};

export default nextConfig;
```

Run: `cd apps/landing && rtk proxy bun test next.config.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Repointer les liens internes de la landing**

Pour chaque occurrence trouvée à l'étape 1, remplace le `href` relatif `/docs…` par l'URL absolue correspondante sur `docs.lumyx.dev`. Dans les composants concernés (`components/site/chrome.tsx` et tout autre listé), introduis une constante plutôt que de répéter l'URL :

```ts
// dans apps/landing/lib/site-data.ts
export const DOCS_URL = process.env.NEXT_PUBLIC_DOCS_URL ?? "https://docs.lumyx.dev";
```

Les liens deviennent `<a href={DOCS_URL}>` ou `<a href={`${DOCS_URL}/quickstart`}>`, et non plus `<Link href="/docs">` — ce sont désormais des liens externes, `next/link` n'a plus lieu d'être.

- [ ] **Step 6: Supprimer l'ancienne implantation**

```bash
rtk proxy rm -rf apps/landing/app/docs
rtk proxy rm apps/landing/components/site/docs-layout.tsx
```

Dans `apps/landing/lib/docs-data.ts`, supprime `METRICS`, `DOC_NAV`, et les types `DocNavItem` et `DocNavSection`. **Conserve `RELEASES`**, consommé par `app/_changelog/page.tsx`.

Dans `apps/landing/app/sitemap.ts`, supprime l'entrée `/docs` du tableau `STATIC_ROUTES` :

```ts
  { path: "", changeFrequency: "weekly", priority: 1 },
  // /docs a demenage sur docs.lumyx.dev, qui porte son propre sitemap.
```

- [ ] **Step 7: Vérifier que la landing tient debout sans la doc**

```bash
rtk proxy bun run --filter=@lumyx/landing test
rtk proxy bun run --filter=@lumyx/landing check-types
rtk proxy bun run --filter=@lumyx/landing verify:ds
rtk proxy bun run --filter=@lumyx/landing lint
rtk proxy bun run --filter=@lumyx/landing build
```
Expected: les cinq au vert. Le build ne doit plus lister aucune route sous `/docs`. Une erreur de type sur un import orphelin de `docs-layout` ou `DOC_NAV` signale un consommateur manqué à l'étape 1.

- [ ] **Step 8: Vérifier les redirections en fonctionnement**

```bash
rtk proxy bun run --filter=@lumyx/landing dev
rtk proxy curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" http://localhost:3000/docs
rtk proxy curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" http://localhost:3000/docs/quickstart
rtk proxy curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" http://localhost:3000/docs/metrics-reference
```
Expected: `308 -> https://docs.lumyx.dev`, puis `308 -> https://docs.lumyx.dev/quickstart`, puis `308 -> https://docs.lumyx.dev/metrics-reference`.

- [ ] **Step 9: Vérification finale sur tout le monorepo**

Les trois paquets modifiés sont `packages/ui`, `apps/landing` et `apps/docs`. `apps/dashboard` et `apps/cloud` consomment `packages/ui` et doivent être contrôlés aussi.

```bash
rtk proxy bun run check-types
rtk proxy bun run lint
rtk proxy bun run verify:ds
rtk proxy bun run test
rtk proxy bun run build
```
Expected: tout au vert sur les six paquets.

Puis passe visuelle finale avec `/browse`, **dans les deux thèmes** :

- `localhost:3000` — la home n'a pas bougé, ses snippets sont toujours en sans-serif (écart assumé, spec §5.4)
- `localhost:3003` — les cinq pages migrées, plus un squelette
- `localhost:3001` et `localhost:3002` — dashboard et cloud n'ont pas bougé, `packages/ui` ayant changé

Les deux défauts à chercher spécifiquement, parce qu'aucune commande ne les attrape : une valeur issue de la collision `@theme` (rayon, couleur ou taille faux), et un token de code en noir pur, signe d'une variable `--code-*` non résolue.

- [ ] **Step 10: Commit**

```bash
rtk git add -A apps/landing
rtk git commit -m "$(cat <<'EOF'
refactor(landing): retirer la documentation, redirigee vers docs.lumyx.dev

Supprime les cinq pages de app/docs, le shell docs-layout, et les exports
METRICS, DOC_NAV, DocNavItem et DocNavSection devenus orphelins. RELEASES
reste : app/_changelog le consomme.

Ajoute deux redirections permanentes — /docs et /docs/:path* — et
repointe les liens internes du header et du pied de page vers le
sous-domaine, ou ils cessent d'etre des liens next/link.

Retire /docs du sitemap de la landing : apps/docs porte le sien.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Après le plan : le déploiement

Hors du périmètre des tâches ci-dessus, parce qu'il se fait dans l'interface Vercel et non dans le repo. À faire après la tâche 8 :

1. Nouveau projet Vercel, root directory `apps/docs`, build `turbo run build --filter=@lumyx/docs`, install `bun install`.
2. Domaine `docs.lumyx.dev`.
3. Variables : `NEXT_PUBLIC_DOCS_URL=https://docs.lumyx.dev`, `NEXT_PUBLIC_SITE_URL=https://lumyx.dev`.
4. Sur le projet de la landing, ajouter `NEXT_PUBLIC_DOCS_URL=https://docs.lumyx.dev`, sans quoi les redirections de la tâche 8 tomberont sur la valeur par défaut codée dans le fichier — correcte, mais non configurable.
5. Après le premier déploiement, vérifier `https://lumyx.dev/docs` → `https://docs.lumyx.dev` en 308, et soumettre `https://docs.lumyx.dev/sitemap.xml` à la Search Console.
