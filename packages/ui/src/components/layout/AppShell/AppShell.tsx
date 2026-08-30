import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../../lib/cn';
import s from './AppShell.module.css';

export type AppShellTheme = 'dark';

export interface AppShellProps {
  sidebar?: ReactNode;
  toolbar?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  maxWidth?: CSSProperties['maxWidth'];
  theme?: AppShellTheme;
  style?: CSSProperties;
}

export function AppShell({
  sidebar,
  toolbar,
  footer,
  children,
  maxWidth,
  theme,
  style,
}: AppShellProps) {
  return (
    <div className={cn(s.shell, theme === 'dark' && 'theme-dark')} style={style}>
      {sidebar}
      <div className={s.main}>
        {toolbar}
        <main className={cn('sl-scroll', s.scrollArea)}>
          <div
            className={s.content}
            style={{ maxWidth, margin: maxWidth ? '0 auto' : undefined }}
          >
            {children}
          </div>
        </main>
        {footer}
      </div>
    </div>
  );
}
