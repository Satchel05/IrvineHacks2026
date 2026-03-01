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
import { getRiskConfig } from "./risk";

type SortDirection = "asc" | "desc" | null;
interface SortState {
  column: string;
  direction: SortDirection;
}

function parseRows(result: string): Record<string, unknown>[] | null {
  try {
    const parsed = JSON.parse(result);
    const rows: unknown = Array.isArray(parsed)
      ? parsed
      : (parsed?.rows ?? parsed?.data ?? null);
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
  const [sort, setSort] = useState<SortState>({ column: "", direction: null });
  const rows = useMemo(() => parseRows(result), [result]);

  const sortedRows = useMemo(() => {
    if (!rows || !sort.column || !sort.direction) return rows ?? [];
    return [...rows].sort((a, b) => {
      const av = a[sort.column], bv = b[sort.column];
      const aNum = Number(av), bNum = Number(bv);
      const numeric = !isNaN(aNum) && !isNaN(bNum);
      const cmp = numeric
        ? aNum - bNum
        : String(av ?? "").localeCompare(String(bv ?? ""));
      return sort.direction === "asc" ? cmp : -cmp;
    });
  }, [rows, sort]);

  // Non-tabular fallback
  if (!rows) {
    const trimmed = result?.trim();
    if (!trimmed || trimmed === "null" || trimmed === "[]" || trimmed === "{}") return null;
    return (
      <pre className="rounded-md border bg-muted/50 px-4 py-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
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

/**
 * Determines whether the SQL is a write operation (INSERT/UPDATE/DELETE).
 * For writes, `result` contains preview rows — not the actual affected count —
 * so we should not derive the count from result.length in those cases.
 */
function isWriteOperation(sql: string): boolean {
  return /^\s*(INSERT|UPDATE|DELETE|MERGE)\b/i.test(sql);
}

/**
 * Extracts the row count from the result payload.
 *
 * Rules:
 * - For SELECT queries: count the rows in the result array (only if > 0).
 * - For write operations: look for explicit rowCount/rowsAffected fields only.
 *   Never use array.length for writes — the array is a preview, not a count.
 * - Returns null (hide the widget) when count cannot be determined or is 0.
 */
function getRowCount(result: string, sql: string): number | null {
  try {
    const parsed = JSON.parse(result);
    if (typeof parsed?.rowCount === "number") return parsed.rowCount;
    // Fallback: For SELECT queries, count rows in array
    const rows = Array.isArray(parsed) ? parsed : parsed?.rows ?? parsed?.data ?? null;
    if (Array.isArray(rows) && rows.length > 0) return rows.length;
  } catch { }
  return null;
}

interface AffectedRecordsProps {
  result: string;
  sql: string;
  riskCfg: RiskConfig; // ← was `countColor: string`, now pass the whole config
}

export function AffectedRecords({ result, sql, riskCfg }: AffectedRecordsProps) {
  const count = getRowCount(result, sql);
  if (count === null) return null;

  return (
    <div
      className={cn(
        "rounded-lg px-6 py-4 w-full select-none border",
        riskCfg.notesBg,
      )}
    >
      <p className={cn("text-md font-semibold tracking-wide mb-1", riskCfg.notesTitleColor)}>
        Affected Records
      </p>
      <div className="flex flex-row items-center gap-2">
        <p className={cn("text-3xl font-bold leading-none", riskCfg.countColor)}>
          {count.toLocaleString()}
        </p>
        <p className="text-xs text-muted-foreground">
          {count === 1 ? "record" : "records"}
        </p>
      </div>
    </div>
  );
}