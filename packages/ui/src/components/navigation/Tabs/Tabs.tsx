import type { CSSProperties } from 'react';
import { cn } from '../../../lib/cn';
import s from './Tabs.module.css';

export type TabsVariant = 'underline' | 'segmented';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export interface TabsProps {
  tabs?: TabItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
  variant?: TabsVariant;
  style?: CSSProperties;
}

export function Tabs({ tabs = [], activeId, onSelect, variant = 'underline', style }: TabsProps) {
  const seg = variant === 'segmented';
  return (
    <div role="tablist" className={cn(s.tablist, seg ? s.segmented : s.underline)} style={style}>
      {tabs.map((t) => (
        <Tab key={t.id} tab={t} active={t.id === activeId} seg={seg} onSelect={onSelect} />
      ))}
    </div>
  );
}

interface TabProps {
  tab: TabItem;
  active: boolean;
  seg: boolean;
  onSelect?: (id: string) => void;
}

function Tab({ tab, active, seg, onSelect }: TabProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => onSelect && onSelect(tab.id)}
      className={cn(s.tab, seg ? s.tabSegmented : s.tabUnderline, active && s.active)}
    >
      {tab.label}
      {tab.count != null && <span className={cn('sl-num', s.count)}>{tab.count}</span>}
    </button>
  );
}
