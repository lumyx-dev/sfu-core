#!/usr/bin/env node
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { extendTailwindMerge } from 'tailwind-merge';
import { join, extname } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');
// styles.css is the only file allowed to carry a literal colour/monospace font — every token
// (raw palette, semantic alias, shadcn contract) lives there, on purpose (see its own header).
const TOKENS_FILE = join(SRC, 'styles.css');

const failures = [];
const fail = (rule, detail) => failures.push(`[${rule}] ${detail}`);

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = walk(SRC);
const rel = (p) => p.slice(ROOT.length);

// 1. Aucune couleur en dur hors styles.css
const SAFE_HEX_REF =
  /(?:\bxlink:href|\bhref)\s*=\s*(?:"#[^"]*"|'#[^']*'|\{\s*['"]#[^'"}]*['"]\s*\})|\burl\(\s*#[^)]*\)/g;
const HEX = /#[0-9a-fA-F]{3,8}\b/;
const RGB = /\brgba?\(/;
// #000/transparent inside a maskImage gradient is a luminance mask, not a paint colour.
const MASK_IMAGE_LINE = /\b(?:mask-image|maskImage|WebkitMaskImage|-webkit-mask-image)\s*[:=]/;
for (const f of files) {
  if (f === TOKENS_FILE) continue;
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

// 2. Zéro monospace — un vrai font-family/classe, pas une mention en prose.
for (const f of files) {
  if (f === TOKENS_FILE) continue;
  if (/\bfont-mono\b|ui-monospace|'SF Mono'|Menlo|Consolas/i.test(readFileSync(f, 'utf8'))) {
    fail('no-monospace', `${rel(f)} contient une font monospace`);
  }
}

// 3. Pas de dangerouslySetInnerHTML — usage reel, pas une mention en commentaire
const DANGEROUS_HTML_USAGE = /dangerouslySetInnerHTML\s*[=:]/;
for (const f of files) {
  if (DANGEROUS_HTML_USAGE.test(readFileSync(f, 'utf8'))) {
    fail('no-dangerous-html', rel(f));
  }
}

// 4. Zero *.module.css — styles.css est le seul CSS du package ; tout style de composant est de
// l'utilitaire Tailwind (cva pour les variantes), jamais un fichier appareille.
for (const f of files) {
  if (extname(f) === '.css' && f !== TOKENS_FILE) {
    fail('no-css-modules', rel(f));
  }
}

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

// 6. cn() ne doit jamais avaler une couleur de texte a cause de l'echelle typographique
// numerique (text-11 … text-44). tailwind-merge classe `text-13` dans `text-color` tant qu'on
// ne lui apprend pas l'echelle — il supprimait alors text-on-accent / text-white des boutons
// pleins (bg-accent / bg-danger), qui retombaient sur la couleur de texte heritee du body.
const UTILS_FILE = join(SRC, 'lib', 'utils.ts');
const declared = readFileSync(UTILS_FILE, 'utf8').match(/const FONT_SIZES\s*=\s*\[([^\]]*)\]/);
const registered = declared ? [...declared[1].matchAll(/["'](\d+)["']/g)].map((m) => m[1]) : [];
// L'echelle de reference, c'est styles.css : --text-11 … --text-44.
const scale = [...readFileSync(TOKENS_FILE, 'utf8').matchAll(/--text-(\d+):/g)].map((m) => m[1]);
const uniqueScale = [...new Set(scale)];

if (!declared) {
  fail('cn-font-scale', `${rel(UTILS_FILE)} — FONT_SIZES introuvable : cn() ne connait plus l'echelle typographique`);
}
for (const size of uniqueScale) {
  if (!registered.includes(size)) {
    fail('cn-font-scale', `text-${size} existe dans styles.css mais manque a FONT_SIZES dans ${rel(UTILS_FILE)}`);
  }
}

// Et on verifie le comportement reel, pas seulement la declaration.
const twMerge = extendTailwindMerge({ extend: { classGroups: { 'font-size': [{ text: registered }] } } });
const COLORS = ['text-on-accent', 'text-white', 'text-strong', 'text-body', 'text-muted', 'text-faint', 'text-danger'];
for (const size of uniqueScale) {
  for (const color of COLORS) {
    const merged = twMerge(`${color} text-${size}`).split(' ');
    if (!merged.includes(color) || !merged.includes(`text-${size}`)) {
      fail('cn-keeps-size-and-color', `"${color} text-${size}" fusionne en "${merged.join(' ')}"`);
    }
  }
}

if (failures.length) {
  console.error(`\n✗ ${failures.length} violation(s) des contraintes du design system\n`);
  failures.forEach((f) => console.error('  ' + f));
  process.exit(1);
}
console.log('✓ contraintes du design system respectees');
