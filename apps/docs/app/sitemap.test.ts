import { describe, expect, test } from "bun:test";
import sitemap from "./sitemap";

// Meme expression que app/sitemap.ts, deliberement : le test doit suivre la variable, pas un
// domaine.
const DOCS_URL = process.env.NEXT_PUBLIC_DOCS_URL ?? "https://docs.lumyx.dev";

// La base attendue est lue de la meme expression que le code sous test, et non ecrite en dur :
// `sitemap()` derive son origine de NEXT_PUBLIC_DOCS_URL, que `turbo.json` propage desormais.
// Un `docs.lumyx.dev` litteral faisait rougir la suite sur toute URL de preview, tout domaine de
// staging et sur `localhost:3003` — mesure : 2 pass / 2 fail avec
// NEXT_PUBLIC_DOCS_URL=https://lumyx-docs-git-preview.vercel.app.
describe("sitemap", () => {
  test("liste les cinq pages redigees, sans les onze brouillons", () => {
    expect(sitemap()).toHaveLength(5);
  });

  test("toutes les URLs sont absolues sur le domaine de la doc", () => {
    for (const entry of sitemap()) {
      expect(entry.url.startsWith(`${DOCS_URL}/`) || entry.url === DOCS_URL).toBe(true);
    }
  });

  test("l'accueil est present et prioritaire", () => {
    const home = sitemap().find((e) => e.url === `${DOCS_URL}/`);
    expect(home).toBeDefined();
    expect(home?.priority).toBe(1);
  });

  test("aucune page brouillon n'est soumise a l'indexation", () => {
    const urls = sitemap().map((e) => e.url);
    for (const slug of [
      "rooms", "peers", "signaling", "forwarding", "alerting",
      "topology", "replay", "prometheus", "api", "config", "errors",
    ]) {
      expect(urls).not.toContain(`${DOCS_URL}/${slug}`);
    }
  });

  test("aucune URL en double", () => {
    const urls = sitemap().map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
