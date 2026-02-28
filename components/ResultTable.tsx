/**
 * ResultTable.tsx — Sortable data table for SELECT query results.
 *
 * Parses the `result` JSON string from the LLM response and renders
 * a table with click-to-sort column headers. Falls back to a raw
 * code block if the result isn't a row array.
 */

"use client";

import { useState, useMemo } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

type SortDirection = 'asc' | 'desc' | null;
interface SortState {
  column: string;
  direction: SortDirection;
}

function parseRows(result: string): Record<string, unknown>[] | null {
  try {
    const parsed = JSON.parse(result);
    const rows: unknown =
      Array.isArray(parsed) ? parsed : (parsed?.rows ?? parsed?.data ?? null);
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rows as Record<string, unknown>[];
  } catch {
    return null;
  }
}

interface ResultTableProps {
  result: string;
}

export function ResultTable({ result }: ResultTableProps) {
  const [sort, setSort] = useState<SortState>({ column: '', direction: null });
  const rows = useMemo(() => parseRows(result), [result]);

  const sortedRows = useMemo(() => {
    if (!rows || !sort.column || !sort.direction) return rows ?? [];
    return [...rows].sort((a, b) => {
      const av = a[sort.column], bv = b[sort.column];
      const aNum = Number(av), bNum = Number(bv);
      const numeric = !isNaN(aNum) && !isNaN(bNum);
      const cmp =
        numeric ?
          aNum - bNum
        : String(av ?? '').localeCompare(String(bv ?? ''));
      return sort.direction === 'asc' ? cmp : -cmp;
    });
  }, [rows, sort]);

  // Non-tabular fallback
  if (!rows) {
    const trimmed = result?.trim();
    if (!trimmed || trimmed === 'null' || trimmed === '[]' || trimmed === '{}') return null;
    return (
      <pre className='rounded-md border bg-muted/50 px-4 py-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap'>
        {trimmed}
      </pre>
    );
  }

  const columns = Object.keys(rows[0]);

  const toggleSort = (col: string) =>
    setSort((prev) => {
      if (prev.column !== col) return { column: col, direction: "asc" };
      if (prev.direction === "asc") return { column: col, direction: "desc" };
      return { column: "", direction: null };
    });

  const SortIcon = ({ col }: { col: string }) => {
    if (sort.column !== col) return <ChevronsUpDown className="h-3 w-3 opacity-40" />;
    return sort.direction === "asc"
      ? <ChevronUp className="h-3 w-3" />
      : <ChevronDown className="h-3 w-3" />;
  };

  return (
    <div className="rounded-md border overflow-hidden text-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-muted border-b">
              {columns.map((col) => (
                <th
                  key={col}
                  onClick={() => toggleSort(col)}
                  className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none whitespace-nowrap"
                >
                  <span className="flex items-center gap-1">
                    {col} <SortIcon col={col} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, i) => (
              <tr
                key={i}
                className={cn(
                  "border-b last:border-0 transition-colors hover:bg-muted/40",
                  i % 2 === 0 ? "bg-background" : "bg-muted/20",
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col}
                    className="px-3 py-2 text-sm font-mono whitespace-nowrap max-w-[300px] truncate"
                    title={row[col] == null ? "NULL" : String(row[col])}
                  >
                    {row[col] == null ? (
                      <span className="text-muted-foreground italic">NULL</span>
                    ) : (
                      String(row[col])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Affected Records ─────────────────────────────────────────────────────────

function getRowCount(result: string): number | null {
  try {
    const parsed = JSON.parse(result);
    const rows = Array.isArray(parsed) ? parsed : parsed?.rows ?? parsed?.data ?? null;
    if (Array.isArray(rows)) return rows.length;
    if (typeof parsed?.rowCount === "number") return parsed.rowCount;
    if (typeof parsed?.rowsAffected === "number") return parsed.rowsAffected;
  } catch { /* ignore */ }
  return null;
}

interface AffectedRecordsProps {
  result: string;
  countColor: string;
}

export function AffectedRecords({ result, countColor }: AffectedRecordsProps) {
  const count = getRowCount(result);
  if (count === null) return null;

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Affected Records
      </p>
      <p className={cn("text-2xl font-bold", countColor)}>
        {count.toLocaleString()}{" "}
        <span className="text-sm font-normal text-muted-foreground">
          {count === 1 ? "row" : "rows"}
        </span>
      </p>
    </div>
  );
}