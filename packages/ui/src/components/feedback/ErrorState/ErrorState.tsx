import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../../lib/cn';
import { Icon } from '../../core/Icon';
import s from './ErrorState.module.css';

export interface ErrorStateProps {
  title?: ReactNode;
  message?: ReactNode;
  code?: string;
  detail?: string;
  action?: ReactNode;
  style?: CSSProperties;
}

export function ErrorState({
  title = 'Something failed',
  message,
  code,
  detail,
  action,
  style,
}: ErrorStateProps) {
  return (
    <div className={s.state} style={style}>
      <span className={s.iconWrap}>
        <Icon name="circle-alert" size={20} />
      </span>
      <span className={s.title}>{title}</span>
      {message && <span className={s.message}>{message}</span>}
      {(code || detail) && (
        <div className={cn('sl-scroll', 'sl-num', s.inset)}>
          {code ? `${code}  ` : ''}
          {detail}
        </div>
      )}
      {action && <span className={s.action}>{action}</span>}
    </div>
  );
}
