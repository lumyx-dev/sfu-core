import { describe, expect, test } from "bun:test";
import { lumyxCodeTheme } from "./code-theme";

const HEX = /#[0-9a-fA-F]{3,8}\b/;
const RGB = /\brgba?\(/;

describe("lumyxCodeTheme", () => {
  test("ne contient aucune couleur litterale", () => {
    const serialized = JSON.stringify(lumyxCodeTheme);
    expect(HEX.test(serialized)).toBe(false);
    expect(RGB.test(serialized)).toBe(false);
  });

  test("toute couleur est une variable CSS pointant sur un token --code-*", () => {
    const colors = [
      lumyxCodeTheme.bg,
      lumyxCodeTheme.fg,
      ...lumyxCodeTheme.settings.map((s) => s.settings.foreground),
    ];
    expect(colors.length).toBeGreaterThan(0);
    for (const c of colors) {
      expect(c).toMatch(/^var\(--code-[a-z]+\)$/);
    }
  });

  test("couvre les sept roles de coloration en plus du fond et du texte", () => {
    const used = new Set(lumyxCodeTheme.settings.map((s) => s.settings.foreground));
    expect(used).toEqual(
      new Set([
        "var(--code-comment)",
        "var(--code-string)",
        "var(--code-number)",
        "var(--code-keyword)",
        "var(--code-function)",
        "var(--code-property)",
        "var(--code-punct)",
      ])
    );
  });

  test("chaque entree de settings porte au moins un scope", () => {
    for (const s of lumyxCodeTheme.settings) {
      expect(s.scope.length).toBeGreaterThan(0);
    }
  });

  test("s'appelle lumyx et n'annonce pas de type clair/sombre", () => {
    expect(lumyxCodeTheme.name).toBe("lumyx");
    expect(lumyxCodeTheme).not.toHaveProperty("type");
  });
});

import { cn } from "./lib/utils";

describe("cn() et le palier code", () => {
  test("ne laisse pas text-code avaler une couleur de texte", () => {
    const merged = cn("text-muted", "text-code").split(" ");
    expect(merged).toContain("text-muted");
    expect(merged).toContain("text-code");
  });

  test("deux tailles se resolvent toujours a la derniere", () => {
    expect(cn("text-13", "text-code")).toBe("text-code");
  });
});
