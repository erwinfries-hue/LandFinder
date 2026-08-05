"use client";

import { useMemo, useState, type ReactNode } from "react";

export type ColumnAlign = "left" | "center" | "right";

export type Column<Row> = {
  key: string;
  header: ReactNode;
  align?: ColumnAlign;
  /** Wert, nach dem sortiert wird (Zahl oder String). */
  sortValue: (row: Row) => number | string;
  /** Darstellung der Zelle. */
  render: (row: Row) => ReactNode;
};

/**
 * Client-seitig sortierbare Tabelle. Jede Spalte ist per Klick auf den Header sortierbar
 * (erneuter Klick kehrt die Richtung um). Standardmässig sind alle Spalten zentriert,
 * ausser align:"left" wird explizit gesetzt (z.B. für die Objekt-Spalte).
 */
export function SortableTable<Row>({
  columns,
  rows,
  rowKey,
}: {
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    return [...rows].sort((a, b) => {
      const av = col.sortValue(a);
      const bv = col.sortValue(b);
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), "de");
      return cmp * sort.dir;
    });
  }, [rows, sort, columns]);

  function toggleSort(key: string) {
    setSort((prev) => (prev?.key === key ? { key, dir: (prev.dir * -1) as 1 | -1 } : { key, dir: 1 }));
  }

  return (
    <div className="twrap">
      <table className="sortable">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                data-key={col.key}
                onClick={() => toggleSort(col.key)}
                style={col.align && col.align !== "center" ? { textAlign: col.align } : undefined}
              >
                {col.header}
                <span className="sort-ind">
                  {sort?.key === col.key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((col) => (
                <td
                  key={col.key}
                  style={col.align && col.align !== "center" ? { textAlign: col.align } : undefined}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
