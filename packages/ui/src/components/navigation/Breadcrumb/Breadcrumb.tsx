import { Fragment, type CSSProperties } from 'react';
import { cn } from '../../../lib/cn';
import s from './Breadcrumb.module.css';

export interface BreadcrumbItem {
  id?: string;
  label: string;
}

export interface BreadcrumbProps {
  items?: BreadcrumbItem[];
  onSelect?: (id: string | undefined, index: number) => void;
  style?: CSSProperties;
}

export function Breadcrumb({ items = [], onSelect, style }: BreadcrumbProps) {
  return (
    <nav className={s.breadcrumb} style={style}>
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <Fragment key={item.id || i}>
            {i > 0 && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                className={s.chevron}
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            )}
            <button
              type="button"
              onClick={() => !last && onSelect && onSelect(item.id, i)}
              className={cn(s.crumb, last && s.last)}
            >
              {item.label}
            </button>
          </Fragment>
        );
      })}
    </nav>
  );
}
