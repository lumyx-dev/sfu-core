#!/usr/bin/env node
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
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

if (failures.length) {
  console.error(`\n✗ ${failures.length} violation(s) des contraintes du design system\n`);
  failures.forEach((f) => console.error('  ' + f));
  process.exit(1);
}
console.log('✓ contraintes du design system respectees');
