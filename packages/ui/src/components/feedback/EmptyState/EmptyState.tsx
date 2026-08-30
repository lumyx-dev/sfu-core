import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../../lib/cn';
import type { IconName } from '../../../lib/icons';
import { Icon } from '../../core/Icon';
import s from './EmptyState.module.css';

export interface EmptyStateProps {
  icon?: IconName;
  title?: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  style?: CSSProperties;
}

export function EmptyState({
  icon = 'radio-tower',
  title,
  hint,
  action,
  compact = false,
  style,
}: EmptyStateProps) {
  return (
    <div className={cn(s.state, compact && s.compact)} style={style}>
      <span className={s.iconWrap}>
        <Icon name={icon} size={20} />
      </span>
      <span className={s.title}>{title}</span>
      {hint && <span className={s.hint}>{hint}</span>}
      {action && <span className={s.action}>{action}</span>}
    </div>
  );
}
