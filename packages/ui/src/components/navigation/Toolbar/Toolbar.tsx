import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../../lib/cn';
import s from './Toolbar.module.css';

export interface ToolbarProps {
  left?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
  sticky?: boolean;
  style?: CSSProperties;
}

export function Toolbar({ left, right, children, sticky = false, style }: ToolbarProps) {
  return (
    <div className={cn(s.toolbar, sticky && s.sticky)} style={style}>
      <span className={s.left}>
        {left}
        {children}
      </span>
      <span className={s.right}>{right}</span>
    </div>
  );
}
