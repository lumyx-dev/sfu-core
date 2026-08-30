import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../../lib/cn';
import type { IconName } from '../../../lib/icons';
import { Icon } from '../../core/Icon';
import s from './Toast.module.css';

export type ToastSeverity = 'critical' | 'warning' | 'info' | 'success';

/* SEVERITY map — source :1656-1679, identique a AlertBanner/SeverityBadge (icone + couleur). */
const SEVERITY_ICON: Record<ToastSeverity, IconName> = {
  critical: 'circle-alert',
  warning: 'triangle-alert',
  info: 'info',
  success: 'circle-check',
};

export interface ToastProps {
  severity?: ToastSeverity;
  title?: ReactNode;
  message?: ReactNode;
  time?: ReactNode;
  onDismiss?: () => void;
  style?: CSSProperties;
}

export function Toast({ severity = 'info', title, message, time, onDismiss, style }: ToastProps) {
  return (
    <div role="alert" className={cn(s.toast, s[severity])} style={style}>
      <span className={s.icon}>
        <Icon name={SEVERITY_ICON[severity]} size={16} />
      </span>
      <div className={s.body}>
        <span className={s.title}>{title}</span>
        {message && <span className={s.message}>{message}</span>}
      </div>
      {time && <span className={cn('sl-num', s.time)}>{time}</span>}
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className={s.dismiss}>
          <Icon name="x" size={14} />
        </button>
      )}
    </div>
  );
}

export type ToastPlacement = 'bottom-right' | 'top-right' | 'bottom-left';

/* pos map — source :1736-1750 ne definit que ces 3 placements (pas 'top-left'). Un placement
   hors de cette liste retombe sans offset (pos = undefined dans la source), donc le type ne
   propose que les 3 valeurs reellement gerees. */
const PLACEMENT_CLASS: Record<ToastPlacement, string> = {
  'bottom-right': s.bottomRight,
  'top-right': s.topRight,
  'bottom-left': s.bottomLeft,
};

export interface ToastStackProps {
  children?: ReactNode;
  placement?: ToastPlacement;
  style?: CSSProperties;
}

export function ToastStack({ children, placement = 'bottom-right', style }: ToastStackProps) {
  return (
    <div className={cn(s.stack, PLACEMENT_CLASS[placement])} style={style}>
      {children}
    </div>
  );
}
