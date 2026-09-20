#!/usr/bin/env node
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
// `content` fait partie du perimetre : les seize `.mdx` portent du vrai balisage de design system
// (cloud.mdx a une vingtaine d'attributs `className`, index.mdx ecrit un `<a>` a la main), et
// Tailwind les scanne deja. La liste venait telle quelle de la variante dashboard, ou aucun
// dossier de contenu n'existe — l'omission etait un heritage, pas une decision.
// Consequence acceptee : la regle 2 rejettera le mot « monospace » ecrit dans la prose d'une page.
// C'est un mot d'une ligne a reformuler le jour ou ca arrive, contre une garde permanente sur
// seize fichiers d'interface.
const SCANNED = ['app', 'components', 'lib', 'content'].map((d) => join(ROOT, d));

// Seul fichier autorisé à porter une valeur de couleur littérale — c'est là que vivrait une
// valeur marketing-locale si jamais une apparaît. En pratique il n'y en a aucune.
const COLOR_EXEMPT = join(ROOT, 'app', 'globals.css');

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

// 1. Aucune couleur en dur hors globals.css
// #000/transparent inside a maskImage gradient is a luminance mask (opaque vs. hidden), not a
// paint colour — exempt those lines rather than the whole file, so a real colour slipped in
// alongside one still gets caught.
const SAFE_HEX_REF =
  /(?:\bxlink:href|\bhref)\s*=\s*(?:"#[^"]*"|'#[^']*'|\{\s*['"]#[^'"}]*['"]\s*\})|\burl\(\s*#[^)]*\)/g;
const HEX = /#[0-9a-fA-F]{3,8}\b/;
const RGB = /\brgba?\(/;
const MASK_IMAGE_LINE = /\b(?:mask-image|maskImage|WebkitMaskImage|-webkit-mask-image)\s*[:=]/;
for (const f of files) {
  if (f === COLOR_EXEMPT) continue;
  readFileSync(f, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      if (MASK_IMAGE_LINE.test(line)) return;
      const scrubbed = line.replace(SAFE_HEX_REF, '');
      if (HEX.test(scrubbed) || RGB.test(scrubbed)) {
        fail('no-hardcoded-color', `${rel(f)}:${i + 1} — ${line.trim()}`);
      }
    });
}

// 2. Monospace par token uniquement. `font-mono` et `var(--font-mono)` resolvent sur le palier
// declare dans le design system ; une pile litterale le contourne et reste interdite.
const LITERAL_MONO = /ui-monospace|'SF Mono'|"SF Mono"|\bMenlo\b|\bConsolas\b|\bmonospace\b/i;
const MONO_TOKEN = /\bfont-mono\b|var\(--font-mono\)/g;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  src.split('\n').forEach((line, i) => {
    const scrubbed = line.replace(MONO_TOKEN, '');
    if (LITERAL_MONO.test(scrubbed)) {
      fail('no-literal-monospace', `${rel(f)}:${i + 1} — ${line.trim()}`);
    }
  });
}

// 3. Pas de dangerouslySetInnerHTML
const DANGEROUS_HTML_USAGE = /dangerouslySetInnerHTML\s*[=:]/;
for (const f of files) {
  if (DANGEROUS_HTML_USAGE.test(readFileSync(f, 'utf8'))) {
    fail('no-dangerous-html', rel(f));
  }
}

// 4. Zéro *.module.css — globals.css est le seul fichier CSS d'apps/docs.
for (const f of files) {
  if (extname(f) === '.css' && f !== COLOR_EXEMPT) {
    fail('no-css-modules', rel(f));
  }
}

if (failures.length) {
  console.error(`\n✗ ${failures.length} violation(s) des contraintes du design system\n`);
  failures.forEach((f) => console.error('  ' + f));
  process.exit(1);
}
console.log('✓ contraintes du design system respectees (apps/docs)');
