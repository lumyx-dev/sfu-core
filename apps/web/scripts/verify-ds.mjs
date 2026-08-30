#!/usr/bin/env node
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SCANNED = ['app', 'components', 'content'].map((d) => join(ROOT, d));

// Seul fichier autorisé à porter une valeur de couleur littérale : c'est là que vivent
// les rares valeurs marketing-locales, comme tokens/ l'est pour packages/ui.
const COLOR_EXEMPT = join(ROOT, 'app', 'globals.css');

// Îlots interactifs déclarés par le plan. Tout autre 'use client' est une violation.
const CLIENT_ALLOWED = new Set([
  'MarketingMotion.tsx',
  'ScrollProgress.tsx',
  'Spotlight.tsx',
  'SnippetTabs.tsx',
  'PricingStrip.tsx',
  'CostEstimator.tsx',
  'PlanSwitcher.tsx',
  'DocsRail.tsx',
  'SignupWizard.tsx',
]);

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

// Même stratégie inversée que packages/ui : tout #hex ou rgb()/rgba() est présumé être une
// couleur en dur, sauf les références d'ancre et de fragment SVG, qui ne sont pas des couleurs.
const SAFE_HEX_REF =
  /(?:\bxlink:href|\bhref)\s*=\s*(?:"#[^"]*"|'#[^']*'|\{\s*['"]#[^'"}]*['"]\s*\})|\burl\(\s*#[^)]*\)/g;
const HEX = /#[0-9a-fA-F]{3,8}\b/;
const RGB = /\brgba?\(/;

// 1. Aucune couleur en dur hors globals.css
for (const f of files) {
  if (f === COLOR_EXEMPT) continue;
  readFileSync(f, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      const scrubbed = line.replace(SAFE_HEX_REF, '');
      if (HEX.test(scrubbed) || RGB.test(scrubbed)) {
        fail('no-hardcoded-color', `${rel(f)}:${i + 1} — ${line.trim()}`);
      }
    });
}

// 2. 'use client' sur les seuls îlots déclarés
for (const f of files.filter((f) => extname(f) === '.tsx')) {
  const isClient = /^\s*['"]use client['"]/m.test(readFileSync(f, 'utf8'));
  if (isClient && !CLIENT_ALLOWED.has(basename(f))) {
    fail('use-client', `${rel(f)} porte 'use client' — ilot non declare dans le plan`);
  }
}

// 3. Zéro monospace
for (const f of files) {
  if (/monospace|ui-monospace|'SF Mono'|Menlo|Consolas/i.test(readFileSync(f, 'utf8'))) {
    fail('no-monospace', `${rel(f)} contient une font monospace`);
  }
}

// 4. Pas de dangerouslySetInnerHTML
for (const f of files) {
  if (readFileSync(f, 'utf8').includes('dangerouslySetInnerHTML')) {
    fail('no-dangerous-html', rel(f));
  }
}

if (failures.length) {
  console.error(`\n✗ ${failures.length} violation(s) des contraintes du design system\n`);
  failures.forEach((f) => console.error('  ' + f));
  process.exit(1);
}
console.log('✓ contraintes du design system respectees (apps/web)');
