import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../../lib/cn';
import type { IconName } from '../../../lib/icons';
import { Icon } from '../../core/Icon';
import s from './SeverityBadge.module.css';

export type SeverityBadgeSeverity = 'critical' | 'warning' | 'info' | 'success';

/* SEVERITY map — source :1596-1619, identique a AlertBanner. Icone + label par defaut restent
   des donnees JS (le label par defaut depend de la severite) ; la couleur/tint sont en CSS. */
const SEVERITY: Record<SeverityBadgeSeverity, { icon: IconName; label: string }> = {
  critical: { icon: 'circle-alert', label: 'Critical' },
  warning: { icon: 'triangle-alert', label: 'Warning' },
  info: { icon: 'info', label: 'Info' },
  success: { icon: 'circle-check', label: 'Resolved' },
};

export interface SeverityBadgeProps {
  severity?: SeverityBadgeSeverity;
  label?: ReactNode;
  showIcon?: boolean;
  style?: CSSProperties;
}

export function SeverityBadge({ severity = 'info', label, showIcon = true, style }: SeverityBadgeProps) {
  const meta = SEVERITY[severity] || SEVERITY.info;
  return (
    <span className={cn(s.badge, s[severity])} style={style}>
      {showIcon && <Icon name={meta.icon} size={12} />}
      {label || meta.label}
    </span>
  );
}
