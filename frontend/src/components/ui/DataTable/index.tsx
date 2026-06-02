import "./styles.css";
import type { ReactNode } from "react";
import { EmptyState } from "../EmptyState";

export function DataTable<T>({
  columns,
  rows,
  emptyMessage,
  getRowKey,
}: {
  columns: Array<{ key: string; header: string; render: (row: T) => ReactNode }>;
  rows: T[];
  emptyMessage: string;
  getRowKey: (row: T, index: number) => string;
}) {
  if (rows.length === 0) return <EmptyState message={emptyMessage} />;
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>{columns.map((column) => <th key={column.key}>{column.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={getRowKey(row, index)}>
              {columns.map((column) => <td key={column.key}>{column.render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
