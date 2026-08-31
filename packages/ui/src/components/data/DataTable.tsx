import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

export interface DataColumn<Row> {
  key: string;
  header: ReactNode;
  align?: "left" | "center" | "right";
  width?: number | string;
  /** Applies tabular figures — set it on any column of numbers. */
  numeric?: boolean;
  /** Quiet column: timestamps, machine identifiers, secondary context. */
  muted?: boolean;
  /** The column that identifies the row. */
  strong?: boolean;
  render?: (row: Row, index: number) => ReactNode;
}

export interface DataTableProps<Row> {
  columns?: DataColumn<Row>[];
  rows?: Row[];
  /** Makes rows clickable. Omit for a read-only table. */
  onRowClick?: (row: Row, index: number) => void;
  /** Tints the row and adds a 2px inset accent edge. */
  selectedIndex?: number;
  dense?: boolean;
  className?: string;
}

/** Row identity: `row.id` when present, otherwise the index. */
type WithOptionalId = { id?: string | number };

export function DataTable<Row extends WithOptionalId & Record<string, unknown>>({
  columns = [],
  rows = [],
  onRowClick,
  selectedIndex,
  dense = false,
  className,
}: DataTableProps<Row>) {
  const cell = dense ? "px-4 py-[9px]" : "px-4 py-[13px]";
  return (
    <div className={cn("sl-scroll overflow-x-auto", className)}>
      <table className="w-full border-collapse text-13">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                style={{ width: c.width, textAlign: c.align ?? "left" }}
                className={cn(
                  "sl-label whitespace-nowrap border-b border-border bg-card pt-0",
                  cell,
                )}
              >
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
                aria-selected={active || undefined}
                className={cn(
                  "transition-colors duration-120 ease-out",
                  onRowClick ? "cursor-pointer" : "cursor-default",
                  active
                    ? "bg-accent-tint shadow-[inset_2px_0_0_var(--sl-accent)]"
                    : "bg-transparent hover:bg-hover",
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    style={{ textAlign: c.align ?? "left" }}
                    className={cn(
                      "whitespace-nowrap border-b border-border-subtle",
                      cell,
                      c.numeric && "sl-num",
                      c.strong
                        ? "font-medium text-strong"
                        : c.muted
                          ? "font-normal text-muted"
                          : "font-normal text-body",
                    )}
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
