import { cn } from "@/lib/utils";

/** The only permitted gradient: a 14%→0 fade under a line, in that line's own colour. */
export function Sparkline({
  data, color = "var(--series-1)", width = 120, height = 28, className,
}: { data: number[]; color?: string; width?: number; height?: number; className?: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pt = (v: number, i: number) => [
    (i / (data.length - 1)) * width,
    height - 2 - ((v - min) / span) * (height - 4),
  ];
  const line = data.map((v, i) => pt(v, i).map((n) => n.toFixed(2)).join(",")).join(" ");
  const id = `spark-${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className={cn("block", className)} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.14" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${line} ${width},${height}`} fill={`url(#${id})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
