import { describe, expect, test } from "bun:test";
import { METRICS } from "../lib/metrics-data";

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
