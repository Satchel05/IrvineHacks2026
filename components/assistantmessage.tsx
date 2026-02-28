/**
 * AssistantMessage.tsx — Renders structured AI responses from the database assistant.
 *
 * The LLM returns JSON matching this shape:
 *   { sql, explanation, result, confirmation }
 *
 * This component parses that JSON and renders each field distinctly:
 *   - sql          → Syntax-highlighted SQL code block (hidden if empty)
 *   - explanation  → Plain prose text
 *   - result       → Interactive sortable table (hidden if no rows)
 *   - confirmation → Muted summary line at the bottom
 *
 * If the content isn't valid JSON (e.g. tool-call status messages like
 * "🔧 Executing tool…"), it falls back to rendering raw text as-is.
 *
 * Usage:
 *   <AssistantMessage content={message.content} />
 */

import { useState, useMemo } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

/** The JSON shape the LLM is instructed to return. */
interface StructuredResponse {
  sql: string;
  explanation: string;
  /** JSON-stringified query result — an array of row objects, or a raw string. */
  result: string;
  confirmation: string;
}

type SortDirection = "asc" | "desc" | null;

interface SortState {
  column: string;
  direction: SortDirection;
}

// ─── SQL Code Block ───────────────────────────────────────────────────────────

function SqlBlock({ sql }: { sql: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(sql).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="rounded-md border bg-muted/50 overflow-hidden text-sm">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted text-muted-foreground text-xs font-mono">
        <span>SQL</span>
        <button
          onClick={copy}
          className="hover:text-foreground transition-colors"
          aria-label="Copy SQL"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      {/* Code */}
      <pre className="px-4 py-3 overflow-x-auto font-mono text-sm leading-relaxed whitespace-pre">
        {sql}
      </pre>
    </div>
  );
}

// ─── Result Table ─────────────────────────────────────────────────────────────

/**
 * Parses `result` (a JSON string) into an array of row objects.
 * Returns null if parsing fails or if there are no rows.
 */
function parseRows(result: string): Record<string, unknown>[] | null {
  try {
    const parsed = JSON.parse(result);
    // Some MCP tools wrap rows under { rows: [...] } or { data: [...] }
    const rows: unknown = Array.isArray(parsed)
      ? parsed
      : parsed?.rows ?? parsed?.data ?? null;

    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rows as Record<string, unknown>[];
  } catch {
    return null;
  }
}

function ResultTable({ result }: { result: string }) {
  const [sort, setSort] = useState<SortState>({ column: "", direction: null });

  const rows = useMemo(() => parseRows(result), [result]);

  if (!rows) {
  const resultString = typeof result === "string" ? result : JSON.stringify(result);
  const trimmed = resultString.trim();
  
  // Only render if there is meaningful content
  if (!trimmed || trimmed === "null" || trimmed === "[]" || trimmed === "{}") return null;

  return (
    <pre className="rounded-md border bg-muted/50 px-4 py-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
      {trimmed}
    </pre>
  );
}

  const columns = Object.keys(rows[0]);

  const toggleSort = (col: string) => {
    setSort((prev) => {
      if (prev.column !== col) return { column: col, direction: "asc" };
      if (prev.direction === "asc") return { column: col, direction: "desc" };
      return { column: "", direction: null };
    });
  };

  const sortedRows = useMemo(() => {
    if (!sort.column || !sort.direction) return rows;
    return [...rows].sort((a, b) => {
      const av = a[sort.column];
      const bv = b[sort.column];
      const aStr = av == null ? "" : String(av);
      const bStr = bv == null ? "" : String(bv);
      // Numeric sort if both values look like numbers
      const aNum = Number(av);
      const bNum = Number(bv);
      const numeric = !isNaN(aNum) && !isNaN(bNum);
      const cmp = numeric ? aNum - bNum : aStr.localeCompare(bStr);
      return sort.direction === "asc" ? cmp : -cmp;
    });
  }, [rows, sort]);

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
                    {col}
                    <SortIcon col={col} />
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
                  "border-b last:border-0 transition-colors",
                  i % 2 === 0 ? "bg-background" : "bg-muted/20",
                  "hover:bg-muted/40",
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

// ─── Fallback: Raw text ───────────────────────────────────────────────────────

/** Used for non-JSON messages like "🔧 Executing tool: query..." */
function RawMessage({ content }: { content: string }) {
  return (
    <pre className="whitespace-pre-wrap text-sm font-sans">
      {content}
    </pre>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface AssistantMessageProps {
  content: string;
}

/**
 * Extracts a JSON object from content that may contain leading/trailing
 * non-JSON lines (e.g. "🔧 *Executing tool: query...*\n\n{...}").
 */
function extractStructured(content: string): StructuredResponse | null {
  // Find the first '{' and last '}' to isolate the JSON blob
  const contentString = typeof content === "string" ? content : JSON.stringify(content);
  const start = contentString.indexOf("{");
  const end = contentString.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    const parsed = JSON.parse(content.slice(start, end + 1));
    if (parsed && typeof parsed.explanation === "string") {
      return parsed as StructuredResponse;
    }
  } catch {
    // Not valid JSON
  }
  return null;
}

/**
 * Strip markdown table syntax and excess whitespace from confirmation text.
 * The LLM sometimes adds a markdown table even though we render one ourselves.
 */
function cleanConfirmation(text: any): string {
  const textString = typeof text === "string" ? text : JSON.stringify(text);

  return textString
    .split("\n")
    .filter((line) => !line.trim().startsWith("|") && !line.trim().startsWith("|-"))
    .join("\n")
    .trim();
}

/**
 * Renders a structured assistant message. Falls back to raw text if the
 * content isn't valid JSON or doesn't match the expected shape.
 */
export function AssistantMessage({ content }: AssistantMessageProps) {
  const structured = extractStructured(content);

  // Collect any non-JSON prefix lines (e.g. tool status messages)
  const prefixLines = structured
    ? content
        .slice(0, content.indexOf("{"))
        .split("\n")
        .map((l) => l.replace(/\*/g, "").trim()) // strip markdown emphasis
        .filter(Boolean)
    : [];

  if (!structured) {
    return <RawMessage content={typeof content === "string" ? content : JSON.stringify(content, null, 2)} />;
  }

  const { sql, explanation, result, confirmation } = structured;
  console.log("SQL TYPE:", typeof sql, sql);
  // Convert sql to string if it's not already
// Convert sql to string if needed
const sqlString = typeof sql === "string" ? sql : JSON.stringify(sql);

// Determine if SQL is actually meaningful
const hasValidSql =
  sqlString &&
  sqlString.trim() !== "" &&          // not empty string
  sqlString.trim() !== "{}" &&        // not literal empty object
  sqlString.trim() !== "null";        // sometimes LLM outputs null

// Then check if it has content
// const hasSql = sqlString.trim().length > 0;
  const cleanedConfirmation = confirmation ? cleanConfirmation(confirmation) : "";

  return (
    <div className="space-y-3 text-sm">
      {/* 0. Tool status lines (e.g. "Executing tool: query...") */}
      {prefixLines.map((line, i) => (
        <p key={i} className="text-muted-foreground text-xs">
          {line}
        </p>
      ))}

      
      

      {/* 1. SQL code block — only if non-empty */}
      {hasValidSql && <SqlBlock sql={sqlString.trim()} />}

      {/* 2. Explanation — always shown */}
      {hasValidSql && explanation && (
        <p className="leading-relaxed">{explanation}</p>
      )}

      {/* 3. Result table (or raw fallback) */}
      {result && <ResultTable result={result} />}

      {/* 4. Confirmation — muted summary line, markdown table stripped */}
      {cleanedConfirmation && (
        <div className="bg-grey-30 border-3 border-grey-400 p-4 mt-4 rounded-md">
  <p className="text-black-800 text-base leading-relaxed">
    {cleanedConfirmation}
  </p>
</div>
      )}
    </div>
  );
}