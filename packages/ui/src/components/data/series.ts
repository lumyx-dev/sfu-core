/**
 * The five fixed chart values, plus danger for a breach line.
 *
 * These are raw `var(--sl-…)` strings rather than Tailwind classes because they
 * are consumed by SVG `stroke` / `fill` / `stop-color` attributes, which take a
 * paint value and not a utility class. They still flip with `.theme-dark`.
 *
 * Note: upstream's `TONES` map in Sparkline.jsx and TimeSeriesChart.jsx is
 * shifted by one — `warn` resolves to series-3 (green) and `ok` to series-5
 * (grey). Corrected here so a tone name means its colour.
 */
export const SERIES = {
  accent: "var(--sl-series-1)",
  secondary: "var(--sl-series-2)",
  ok: "var(--sl-series-3)",
  warn: "var(--sl-series-4)",
  neutral: "var(--sl-series-5)",
  danger: "var(--sl-danger)",
} as const;

export type SeriesTone = keyof typeof SERIES;

export function seriesColor(tone: SeriesTone | undefined): string {
  return (tone && SERIES[tone]) || SERIES.accent;
}
