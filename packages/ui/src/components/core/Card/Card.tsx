import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../../lib/cn';
import s from './Card.module.css';

export interface CardProps {
  title?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  padded?: boolean;
  footer?: ReactNode;
  style?: CSSProperties;
  bodyStyle?: CSSProperties;
  headerStyle?: CSSProperties;
}

export function Card({
  title, meta, actions, children, padded = true, footer, style, bodyStyle, headerStyle,
}: CardProps) {
  return (
    <section className={s.card} style={style}>
      {(title || actions) && (
        <header className={s.header} style={headerStyle}>
          <span className={s.titleGroup}>
            <h3 className={s.title}>{title}</h3>
            {meta && <span className={s.meta}>{meta}</span>}
          </span>
          {actions && <span className={s.actions}>{actions}</span>}
        </header>
      )}
      <div className={cn(s.body, padded && s.bodyPadded)} style={bodyStyle}>
        {children}
      </div>
      {footer && <div className={s.footer}>{footer}</div>}
    </section>
  );
}
