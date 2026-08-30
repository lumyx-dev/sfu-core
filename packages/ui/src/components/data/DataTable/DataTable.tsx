import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../../lib/cn';
import s from './DataTable.module.css';

export type DataTableAlign = 'left' | 'center' | 'right';

export type DataTableRow = Record<string, unknown> & { id?: string | number };

export interface DataTableColumn {
  key: string;
  header?: ReactNode;
  align?: DataTableAlign;
  width?: CSSProperties['width'];
  numeric?: boolean;
  muted?: boolean;
  strong?: boolean;
  render?: (row: DataTableRow, index: number) => ReactNode;
}

export interface DataTableProps {
  columns?: DataTableColumn[];
  rows?: DataTableRow[];
  onRowClick?: (row: DataTableRow, index: number) => void;
  selectedIndex?: number;
  dense?: boolean;
  style?: CSSProperties;
}

/* Source :605-663. Le useState(hover) de la source devient tr:hover (regle §3).
   Ligne selectionnee : accent-tint + inset 2px accent a gauche — la source a bien
   le liseré, contrairement a Sidebar.active (voir Sidebar.module.css :53). Ne pas
   aligner l'un sur l'autre : chacun reflete fidelement sa propre source. */
export function DataTable({
  columns = [],
  rows = [],
  onRowClick,
  selectedIndex,
  dense = false,
  style,
}: DataTableProps) {
  return (
    <div className={cn('sl-scroll', s.wrap)} style={style}>
      <table className={cn(s.table, dense && s.dense)}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={s.th} style={{ textAlign: c.align || 'left', width: c.width }}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const active = selectedIndex === i;
            return (
              <tr
                key={r.id ?? i}
                onClick={onRowClick ? () => onRowClick(r, i) : undefined}
                className={cn(s.row, onRowClick && s.clickable, active && s.selected)}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(s.td, c.numeric && 'sl-num', c.strong && s.strong, c.muted && s.muted)}
                    style={{ textAlign: c.align || 'left' }}
                  >
                    {c.render ? c.render(r, i) : (r[c.key] as ReactNode)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
