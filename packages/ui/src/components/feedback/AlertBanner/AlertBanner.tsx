import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../../lib/cn';
import type { IconName } from '../../../lib/icons';
import { Icon } from '../../core/Icon';
import { IconButton } from '../../core/IconButton';
import s from './AlertBanner.module.css';

export type AlertSeverity = 'critical' | 'warning' | 'info' | 'success';

/* Icone par severite — source SEVERITY map :1170-1194 (identique a SeverityBadge/Toast).
   La couleur est portee par les classes CSS (source :1194-1217). */
const SEVERITY_ICON: Record<AlertSeverity, IconName> = {
  critical: 'circle-alert',
  warning: 'triangle-alert',
  info: 'info',
  success: 'circle-check',
};

export interface AlertBannerProps {
  severity?: AlertSeverity;
  title?: ReactNode;
  message?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
  style?: CSSProperties;
}

export function AlertBanner({
  severity = 'warning',
  title,
  message,
  meta,
  action,
  onDismiss,
  style,
}: AlertBannerProps) {
  return (
    <div role="status" className={cn(s.banner, s[severity])} style={style}>
      <span className={s.icon}>
        <Icon name={SEVERITY_ICON[severity]} size={18} />
      </span>
      <div className={s.body}>
        {title && <span className={s.title}>{title}</span>}
        {message && <span className={s.message}>{message}</span>}
        {meta && (
          <span className={cn('sl-num', s.meta)}>{meta}</span>
        )}
      </div>
      {action && <span className={s.actions}>{action}</span>}
      {onDismiss && (
        <IconButton label="Dismiss" size={28} onClick={onDismiss}>
          <Icon name="x" size={14} />
        </IconButton>
      )}
    </div>
  );
}
