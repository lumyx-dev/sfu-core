import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { METRICS } from "./metrics-data";
import { MetricsThresholds } from "../components/metrics-reference";

describe("donnees des metriques", () => {
  test("porte les six metriques du collecteur", () => {
    expect(METRICS).toHaveLength(6);
    expect(METRICS.map((m) => m.field)).toEqual([
      "packet_loss_ratio",
      "rtt_ms",
      "jitter_ms",
      "nack_ratio",
      "freeze_ratio",
      "bitrate_kbps",
    ]);
  });

  test("chaque metrique porte les neuf champs que la page rend", () => {
    for (const m of METRICS) {
      for (const key of ["name", "field", "unit", "threshold", "scope", "breaks", "body", "action"] as const) {
        expect(typeof m[key]).toBe("string");
        expect(m[key].length).toBeGreaterThan(0);
      }
      expect(Array.isArray(m.sample)).toBe(true);
      expect(m.sample.length).toBeGreaterThan(0);
    }
  });

  test("les champs servent d'ancres, donc ils sont uniques", () => {
    expect(new Set(METRICS.map((m) => m.field)).size).toBe(METRICS.length);
  });
});

describe("MetricsThresholds", () => {
  // Le tableau recapitulatif est la seule vue d'ensemble des six metriques : une ligne perdue
  // ne casse rien et ne se voit pas. On compte donc les cellules et on verifie que chaque valeur
  // des donnees arrive bien dans le rendu.
  const html = renderToStaticMarkup(createElement(MetricsThresholds));

  test("rend les six lignes sur les six colonnes", () => {
    expect(html.match(/<th\b/g) ?? []).toHaveLength(6);
    expect(html.match(/<tr\b/g) ?? []).toHaveLength(METRICS.length + 1);
    expect(html.match(/<td\b/g) ?? []).toHaveLength(METRICS.length * 6);
  });

  test("chaque metrique y porte ses six valeurs", () => {
    for (const m of METRICS) {
      for (const value of [m.name, m.field, m.unit, m.threshold, m.scope, m.breaks]) {
        expect(html).toContain(escapeHtml(value));
      }
    }
  });

  test("la colonne des seuils garde les chiffres tabulaires", () => {
    // `sl-num` est ce qui aligne verticalement `> 2%`, `> 200ms` et `< 100kbps`.
    expect(html.match(/class="[^"]*\bsl-num\b[^"]*"/g) ?? []).toHaveLength(METRICS.length);
  });
});

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
