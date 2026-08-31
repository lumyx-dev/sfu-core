import { cn } from '../../lib/utils';

/**
 * The Lumyx mark — six triangles around a hexagonal aperture, alternating full
 * and half opacity. Drawn with `currentColor` (never a fixed fill) so one
 * component serves every scope: `text-accent` on light chrome, `text-strong`
 * inside a dark band, inherited ink anywhere else.
 *
 * Source of truth: docs/brand/lumyx-mark-currentcolor.svg — keep the paths in sync.
 */
export function LumyxMark({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      role="presentation"
      aria-hidden
      focusable="false"
      className={cn('shrink-0', className)}
    >
      <path fill="currentColor" d="M24.0 4.0 L41.3 14.0 L31.5 24.0 Z" />
      <path fill="currentColor" fillOpacity="0.5" d="M41.3 14.0 L41.3 34.0 L27.8 30.5 Z" />
      <path fill="currentColor" d="M41.3 34.0 L24.0 44.0 L20.3 30.5 Z" />
      <path fill="currentColor" fillOpacity="0.5" d="M24.0 44.0 L6.7 34.0 L16.5 24.0 Z" />
      <path fill="currentColor" d="M6.7 34.0 L6.7 14.0 L20.2 17.5 Z" />
      <path fill="currentColor" fillOpacity="0.5" d="M6.7 14.0 L24.0 4.0 L27.8 17.5 Z" />
    </svg>
  );
}
