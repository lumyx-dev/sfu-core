import { describe, expect, test } from "bun:test";
import { codeToHtml } from "shiki";
import { lumyxCodeTheme } from "@lumyx/ui";
import sourceConfig from "../source.config";

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

// Le test ci-dessus prouve que Shiki SAIT appliquer le theme lumyx. Il ne prouve pas que
// source.config.ts branche bien cette capacite dans Fumadocs : c'est une simple assignation
// d'objet, sans logique a l'execution, mais c'est la ligne la plus fragile du diff — une
// regression y est silencieuse (build vert, page recolorée en defaut Fumadocs) tant qu'elle n'est
// pas verifiee sur le HTML servi. Cette assertion transforme un futur oubli en test rouge.
describe("branchement de rehypeCodeOptions dans source.config.ts", () => {
  test("mode themes+colorsRendering:none, sans cle theme, avec icon coupe", () => {
    // `mdxOptions` est type comme une union (objet | fonction | preset "minimal") a cause de la
    // forme generale de `defineConfig` ; source.config.ts n'utilise aucune de ces variantes, donc
    // on descend directement au shape concret plutot que de re-discriminer l'union ici.
    const mdxOptions = sourceConfig.mdxOptions as { rehypeCodeOptions?: unknown } | undefined;
    const opts = mdxOptions?.rehypeCodeOptions;
    if (!opts || opts === false) {
      throw new Error("rehypeCodeOptions doit rester un objet, pas false/absent");
    }
    const rehypeCodeOptions = opts as Record<string, unknown>;

    // Pas de cle `theme` : "themes" in options doit rester la seule verite pour Shiki, sans
    // ambiguite avec la fusion superficielle des defauts de fumadocs-core (voir le commentaire
    // de source.config.ts).
    expect(rehypeCodeOptions).not.toHaveProperty("theme");

    const themes = rehypeCodeOptions.themes as { light?: unknown; dark?: unknown } | undefined;
    expect(themes?.light).toBe(lumyxCodeTheme);
    expect(themes?.dark).toBe(lumyxCodeTheme);

    expect(rehypeCodeOptions.defaultColor).toBe("light");
    expect(rehypeCodeOptions.colorsRendering).toBe("none");
    expect(rehypeCodeOptions.icon).toBe(false);
  });
});
