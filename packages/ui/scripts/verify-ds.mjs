#!/usr/bin/env node
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');
const COMPONENTS = join(SRC, 'components');
const TOKENS = join(SRC, 'tokens');
const DS = process.env.DS;

const failures = [];
const fail = (rule, detail) => failures.push(`[${rule}] ${detail}`);

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = walk(COMPONENTS);
const rel = (p) => p.slice(ROOT.length);

// 1. Aucune couleur en dur hors tokens/
// Le hex doit apparaitre dans un contexte de valeur de couleur — precede de
// ':', ',', '(' (eventuellement suivi d'espaces et d'un guillemet) — pas
// n'importe ou sur la ligne. Ca evite les faux positifs sur les fragments
// d'ancre/route (href="#face", xlink:href="#dead") tout en gardant la
// detection des vraies couleurs (color: "#ABCDEF", linear-gradient(#fff, #000)).
const HEX = /[:,(]\s*['"]?#[0-9a-fA-F]{3,8}\b/;
const RGB = /\brgba?\(/;
for (const f of files) {
  const body = readFileSync(f, 'utf8');
  body.split('\n').forEach((line, i) => {
    if (HEX.test(line) || RGB.test(line)) {
      fail('no-hardcoded-color', `${rel(f)}:${i + 1} — ${line.trim()}`);
    }
  });
}

// 2. 'use client' sur EventList uniquement
for (const f of files.filter((f) => extname(f) === '.tsx')) {
  const body = readFileSync(f, 'utf8');
  const isClient = /^\s*['"]use client['"]/m.test(body);
  const isEventList = basename(f) === 'EventList.tsx';
  if (isClient && !isEventList) {
    fail('use-client', `${rel(f)} porte 'use client' — seul EventList y a droit`);
  }
}

// 3. Zéro monospace
for (const f of files) {
  const body = readFileSync(f, 'utf8');
  if (/monospace|ui-monospace|'SF Mono'|Menlo|Consolas/i.test(body)) {
    fail('no-monospace', `${rel(f)} contient une font monospace`);
  }
}

// 4. Pas de dangerouslySetInnerHTML
for (const f of files) {
  if (readFileSync(f, 'utf8').includes('dangerouslySetInnerHTML')) {
    fail('no-dangerous-html', rel(f));
  }
}

// 5. Les tokens sont identiques au handoff (fonts.css excepté du contenu, cf.
// spec §4 — mais fonts.css doit quand meme EXISTER des deux cotes). Comparaison
// dans les deux sens : un fichier manquant localement ou un fichier en trop
// localement doivent tous deux echouer et se nommer.
let tokensSkipped = false;
if (DS) {
  const dsTokens = join(DS, 'tokens');
  const localNames = new Set(readdirSync(TOKENS));
  const dsNames = new Set(existsSync(dsTokens) ? readdirSync(dsTokens) : []);
  const allNames = new Set([...localNames, ...dsNames]);
  for (const name of [...allNames].sort()) {
    const inLocal = localNames.has(name);
    const inDs = dsNames.has(name);
    if (!inLocal) {
      fail('tokens-verbatim', `tokens/${name} existe dans le handoff mais pas dans packages/ui/src/tokens/`);
      continue;
    }
    if (!inDs) {
      fail('tokens-verbatim', `tokens/${name} existe dans packages/ui/src/tokens/ mais pas dans le handoff`);
      continue;
    }
    if (name === 'fonts.css') continue; // present des deux cotes — contenu excepte
    const mine = readFileSync(join(TOKENS, name), 'utf8');
    const theirs = readFileSync(join(dsTokens, name), 'utf8');
    if (mine !== theirs) fail('tokens-verbatim', `tokens/${name} diverge du handoff`);
  }
} else {
  tokensSkipped = true;
  console.log('· $DS non defini — verification tokens-verbatim sautee');
}

if (failures.length) {
  console.error(`\n✗ ${failures.length} violation(s) des contraintes du design system\n`);
  failures.forEach((f) => console.error('  ' + f));
  process.exit(1);
}

if (tokensSkipped) {
  console.log('✓ contraintes respectees (tokens-verbatim SAUTE: $DS non defini)');
} else {
  console.log('✓ contraintes du design system respectees');
}
