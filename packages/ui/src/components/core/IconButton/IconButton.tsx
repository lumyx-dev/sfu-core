import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { cn } from '../../../lib/cn';
import s from './IconButton.module.css';

export type IconButtonTone = 'default' | 'danger';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  label: string;
  size?: number;
  active?: boolean;
  disabled?: boolean;
  tone?: IconButtonTone;
  style?: CSSProperties;
}

export function IconButton({
  children,
  label,
  size = 32,
  active = false,
  disabled = false,
  tone = 'default',
  onClick,
  style,
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(s.iconBtn, tone === 'danger' && s.danger, active && s.active, className)}
      style={{ width: size, height: size, ...style }}
      {...rest}
    >
      {children}
    </button>
  );
}
