import type { CSSProperties, SVGProps } from 'react';
import { ICONS, type IconName } from '../../../lib/icons';

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name' | 'ref'> {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  style?: CSSProperties;
}

/**
 * Lucide, à stroke-width 1.75 — plus lourd que le défaut de 2 de la librairie ne le rendrait à
 * 14px. La source allait chercher le SVG sur unpkg ; ici lucide-react le fournit à la compilation.
 */
export function Icon({ name, size = 16, strokeWidth = 1.75, style, ...rest }: IconProps) {
  const Glyph = ICONS[name];
  return (
    <Glyph
      aria-label={name}
      role="img"
      width={size}
      height={size}
      strokeWidth={strokeWidth}
      style={{ flex: '0 0 auto', color: 'currentColor', ...style }}
      {...rest}
    />
  );
}
