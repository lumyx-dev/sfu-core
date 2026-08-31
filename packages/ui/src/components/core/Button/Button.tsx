import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { cn } from '../../../lib/cn';
import s from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger' | 'accentQuiet';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  block?: boolean;
  icon?: ReactNode;
  trailing?: ReactNode;
  type?: 'button' | 'submit' | 'reset';
  style?: CSSProperties;
}

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  disabled = false,
  block = false,
  icon = null,
  trailing = null,
  type = 'button',
  onClick,
  style,
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(s.btn, s[size], s[variant], block && s.block, className)}
      style={style}
      {...rest}
    >
      {icon}
      {children}
      {trailing}
    </button>
  );
}
