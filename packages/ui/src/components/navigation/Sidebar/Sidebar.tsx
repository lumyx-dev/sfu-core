import type { CSSProperties } from 'react';
import { cn } from '../../../lib/cn';
import type { IconName } from '../../../lib/icons';
import { Icon } from '../../core/Icon';
import { StatusDot, type StatusDotStatus } from '../../core/StatusDot';
import s from './Sidebar.module.css';

export interface SidebarItem {
  id?: string;
  label?: string;
  icon?: IconName;
  count?: number;
  status?: StatusDotStatus;
  /** Rend une etiquette de section au lieu d'une Row cliquable — source :2004. */
  section?: string;
}

export interface SidebarProps {
  items?: SidebarItem[];
  activeId?: string;
  onSelect?: (id: string | undefined) => void;
  brand?: string;
  brandMeta?: string;
  footer?: string;
  width?: number;
  style?: CSSProperties;
}

export function Sidebar({
  items = [],
  activeId,
  onSelect,
  brand = 'Lumyx',
  brandMeta,
  footer,
  width = 248,
  style,
}: SidebarProps) {
  return (
    <nav className={s.sidebar} style={{ width, ...style }}>
      <div className={s.brandBlock}>
        <span className={s.brandName}>{brand}</span>
        {brandMeta && <span className={s.brandMeta}>{brandMeta}</span>}
      </div>
      <div className={cn('sl-scroll', s.list)}>
        {items.map((item, i) =>
          item.section ? (
            <div key={'s' + i} className={cn('sl-label', s.sectionLabel)}>
              {item.section}
            </div>
          ) : (
            <Row key={item.id} item={item} active={item.id === activeId} onSelect={onSelect} />
          )
        )}
      </div>
      {footer && <div className={s.footer}>{footer}</div>}
    </nav>
  );
}

interface RowProps {
  item: SidebarItem;
  active: boolean;
  onSelect?: (id: string | undefined) => void;
}

function Row({ item, active, onSelect }: RowProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect && onSelect(item.id)}
      className={cn(s.row, active && s.active)}
    >
      {item.icon && <Icon name={item.icon} size={16} />}
      <span className={s.label}>{item.label}</span>
      {item.status && <StatusDot status={item.status} size={6} halo={false} />}
      {item.count != null && <span className={cn('sl-num', s.count)}>{item.count}</span>}
    </button>
  );
}
