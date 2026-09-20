import { afterEach, describe, expect, test } from 'bun:test';
import { writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const PKG = new URL('..', import.meta.url).pathname;
const SCRIPT = join(PKG, 'scripts', 'verify-ds.mjs');
// Le script scanne src/ recursivement : on y depose la sonde, puis on la retire. Prefixe
// distinctif pour qu'un residu soit reconnaissable dans git status.
const PROBE = join(PKG, 'src', '__verify-ds-probe.tsx');

function runWith(contents) {
  writeFileSync(PROBE, contents, 'utf8');
  try {
    const proc = Bun.spawnSync(['node', SCRIPT], { cwd: PKG });
    return {
      code: proc.exitCode,
      output: proc.stdout.toString() + proc.stderr.toString(),
    };
  } finally {
    rmSync(PROBE, { force: true });
  }
}

afterEach(() => {
  // Ceinture et bretelles : aucun residu meme si une assertion jette.
  if (existsSync(PROBE)) rmSync(PROBE, { force: true });
});

describe('verify-ds regle 2 — monospace par token', () => {
  test('accepte l utilitaire font-mono', () => {
    const { code, output } = runWith('export const A = () => <pre className="font-mono" />;\n');
    expect(output).not.toContain('no-literal-monospace');
    expect(code).toBe(0);
  });

  test('accepte la variable de token --font-mono', () => {
    const { code } = runWith('export const S = { fontFamily: "var(--font-mono)" };\n');
    expect(code).toBe(0);
  });

  test('refuse une pile monospace litterale', () => {
    const { code, output } = runWith("export const S = { fontFamily: 'Menlo, monospace' };\n");
    expect(code).toBe(1);
    expect(output).toContain('no-literal-monospace');
  });

  test('refuse ui-monospace', () => {
    const { code, output } = runWith('export const S = { fontFamily: "ui-monospace" };\n');
    expect(code).toBe(1);
    expect(output).toContain('no-literal-monospace');
  });

  test('refuse SF Mono et Consolas', () => {
    expect(runWith('const f = "\'SF Mono\'";\n').code).toBe(1);
    expect(runWith('const f = "Consolas";\n').code).toBe(1);
  });

  test('styles.css reste exempte — il porte ui-monospace par conception', () => {
    // Sans sonde, le script doit passer : styles.css contient la pile litterale du token.
    const proc = Bun.spawnSync(['node', SCRIPT], { cwd: PKG });
    expect(proc.exitCode).toBe(0);
  });
});
