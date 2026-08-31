import type { CSSProperties, ReactNode, SelectHTMLAttributes } from 'react';
import { cn } from '../../../lib/cn';
import s from './Select.module.css';

export type SelectSize = 'sm' | 'md';

export interface SelectOption {
  value: string;
  label: ReactNode;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size' | 'style'> {
  label?: ReactNode;
  options?: Array<string | SelectOption>;
  size?: SelectSize;
  style?: CSSProperties;
  wrapperStyle?: CSSProperties;
}

export function Select({
  label,
  options = [],
  value,
  onChange,
  size = 'md',
  style,
  wrapperStyle,
  className,
  ...rest
}: SelectProps) {
  return (
    <label className={s.wrapper} style={wrapperStyle}>
      {label && <span className="sl-label">{label}</span>}
      <span className={s.box}>
        <select
          value={value}
          onChange={onChange}
          className={cn(s.field, s[size], className)}
          style={style}
          {...rest}
        >
          {options.map((o) => {
            const opt = typeof o === 'string' ? { value: o, label: o } : o;
            return (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            );
          })}
        </select>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={s.chevron}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
    </label>
  );
}
