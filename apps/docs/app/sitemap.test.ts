import { describe, expect, test } from "bun:test";
import sitemap from "./sitemap";

describe("sitemap", () => {
  test("liste les seize pages de la documentation", () => {
    expect(sitemap()).toHaveLength(16);
  });

  test("toutes les URLs sont absolues sur le domaine de la doc", () => {
    for (const entry of sitemap()) {
      expect(entry.url).toMatch(/^https:\/\//);
      expect(entry.url).toContain("docs.lumyx.dev");
    }
  });

  test("l'accueil est present et prioritaire", () => {
    const home = sitemap().find((e) => e.url === "https://docs.lumyx.dev/");
    expect(home).toBeDefined();
    expect(home?.priority).toBe(1);
  });

  test("aucune URL en double", () => {
    const urls = sitemap().map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
