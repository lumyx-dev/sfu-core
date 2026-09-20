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
