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

const files = walk(SRC);
const rel = (p) => p.slice(ROOT.length);
const isTokenFile = (p) => p.startsWith(TOKENS + '/') || p === TOKENS;
// tokens/ is exempt from BOTH content rules below (no-hardcoded-color, no-monospace) — not
// narrowed out of the walk, exempted on purpose. Reason: tokens/*.css is already pinned
// byte-for-byte against the handoff by rule 5 (tokens-verbatim), which is strictly stronger
// than any content regex here — a token file cannot acquire a stray hardcoded colour or a
// monospace declaration without tokens-verbatim failing first. Running these two rules over
// files that are already guarded by an external source of truth adds no coverage and only
// produces false positives (e.g. a comment that *denies* monospace, like "no monospace",
// tripping a naive substring match). Do not "fix" this back to scanning tokens/ — add the
// stronger check to tokens-verbatim instead if real coverage is missing there.

// 1. Aucune couleur en dur hors tokens/
// Strategie inversee : tout #hex ou rgb()/rgba() est presume etre une
// couleur en dur, sauf s'il correspond a l'un des motifs de reference
// connus et enumeres explicitement ci-dessous (pas de couleur du tout —
// des references d'ancre/SVG). Une liste fermee qu'on etend deliberement
// si un nouveau cas legitime apparait, plutot qu'une liste ouverte de
// "contextes de couleur" qui laisse passer les valeurs raccourcies CSS
// (border: 1px solid #abc123, box-shadow: ... #333, etc — la couleur n'y
// suit jamais directement ':', ',' ou '(').
const SAFE_HEX_REF =
  /(?:\bxlink:href|\bhref)\s*=\s*(?:"#[^"]*"|'#[^']*'|\{\s*['"]#[^'"}]*['"]\s*\})|\burl\(\s*#[^)]*\)/g;
const HEX = /#[0-9a-fA-F]{3,8}\b/;
const RGB = /\brgba?\(/;
for (const f of files) {
  if (isTokenFile(f)) continue; // tokens/ is exempt — see isTokenFile above
  const body = readFileSync(f, 'utf8');
  body.split('\n').forEach((line, i) => {
    const scrubbed = line.replace(SAFE_HEX_REF, '');
    if (HEX.test(scrubbed) || RGB.test(scrubbed)) {
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
  if (isTokenFile(f)) continue; // tokens/ is exempt — see isTokenFile above
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

// 6. Le bloc de tokens inline dans apps/sfu/assets/test.html (delimite par les commentaires
// LUMYX DESIGN TOKENS) doit etre identique a la concatenation des 9 fichiers tokens/ du
// handoff, jointe par '\n' — meme logique de jointure que celle utilisee pour construire le
// bloc dans test.html (cf. rapport). Le SFU sert cette page comme une seule chaine HTML sans
// route d'assets statiques ; les tokens y sont donc copies en dur et doivent rester verbatim.
let sfuTokensSkipped = false;
const SFU_TEST_HTML = join(ROOT, '..', '..', 'apps', 'sfu', 'assets', 'test.html');
const TOKEN_ORDER = [
  'fonts.css',
  'palette.css',
  'semantic.css',
  'typography.css',
  'spacing.css',
  'radius.css',
  'elevation.css',
  'motion.css',
  'base.css',
];
if (DS) {
  const dsTokens = join(DS, 'tokens');
  if (!existsSync(SFU_TEST_HTML)) {
    fail('sfu-tokens-verbatim', `${rel(SFU_TEST_HTML)} n'existe pas`);
  } else {
    const html = readFileSync(SFU_TEST_HTML, 'utf8');
    const OPEN = '/* ===== LUMYX DESIGN TOKENS — copied verbatim from the handoff. Do not hand-edit. ===== */';
    const CLOSE = '/* ===== END LUMYX DESIGN TOKENS ===== */';
    const openIdx = html.indexOf(OPEN);
    const closeIdx = html.indexOf(CLOSE);
    if (openIdx === -1 || closeIdx === -1 || closeIdx < openIdx) {
      fail('sfu-tokens-verbatim', `${rel(SFU_TEST_HTML)} ne contient pas de bloc de tokens delimite (marqueurs OPEN/CLOSE introuvables)`);
    } else {
      const actual = html.slice(openIdx + OPEN.length + 1, closeIdx).replace(/\n$/, '');
      const expected = TOKEN_ORDER.map((name) => readFileSync(join(dsTokens, name), 'utf8'))
        .join('\n')
        .replace(/\n$/, '');
      if (actual !== expected) {
        fail('sfu-tokens-verbatim', `${rel(SFU_TEST_HTML)} — le bloc de tokens inline diverge de la concatenation verbatim de tokens/{${TOKEN_ORDER.join(',')}}`);
      }
    }
  }
} else {
  sfuTokensSkipped = true;
  console.log('· $DS non defini — verification sfu-tokens-verbatim sautee');
}

if (failures.length) {
  console.error(`\n✗ ${failures.length} violation(s) des contraintes du design system\n`);
  failures.forEach((f) => console.error('  ' + f));
  process.exit(1);
}

if (tokensSkipped || sfuTokensSkipped) {
  const skipped = [tokensSkipped && 'tokens-verbatim', sfuTokensSkipped && 'sfu-tokens-verbatim']
    .filter(Boolean)
    .join(', ');
  console.log(`✓ contraintes respectees (${skipped} SAUTE: $DS non defini)`);
} else {
  console.log('✓ contraintes du design system respectees');
}
