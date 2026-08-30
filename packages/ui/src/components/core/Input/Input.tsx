import type { CSSProperties, InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../../lib/cn';
import s from './Input.module.css';

export type InputSize = 'sm' | 'md';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'style' | 'prefix' | 'suffix'> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  prefix?: ReactNode;
  suffix?: ReactNode;
  size?: InputSize;
  style?: CSSProperties;
  wrapperStyle?: CSSProperties;
}

export function Input({
  label,
  hint,
  error,
  prefix,
  suffix,
  size = 'md',
  style,
  wrapperStyle,
  className,
  ...rest
}: InputProps) {
  return (
    <label className={s.wrapper} style={wrapperStyle}>
      {label && <span className="sl-label">{label}</span>}
      <span className={cn(s.box, s[size], Boolean(error) && s.error)}>
        {prefix && <span className={s.prefix}>{prefix}</span>}
        <input className={cn(s.field, className)} style={style} {...rest} />
        {suffix && <span className={s.suffix}>{suffix}</span>}
      </span>
      {(hint || error) && (
        <span className={cn(s.hint, Boolean(error) && s.hintError)}>{error || hint}</span>
      )}
    </label>
  );
}
