/**
 * AssistantMessage.tsx — Renders structured AI responses from the database assistant.
 *
 * The LLM returns JSON matching this shape:
 *   { sql, explanation, result, confirmation, confirmation_required?, user_confirmed? }
 *
 * Rendering rules:
 *   - sql                → SQL code block (hidden if empty)
 *   - explanation        → Plain prose
 *   - result             → Sortable table (hidden if no rows)
 *   - confirmation_required: true → Amber warning banner with Accept / Reject buttons.
 *                          Clicking either calls `onConfirm(accepted)` so the
 *                          parent can send a follow-up message to the LLM.
 *   - confirmation_required: false/absent → Plain muted confirmation line.
 *
 * Non-JSON content (e.g. "🔧 Executing tool…") falls back to plain text.
 */

"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StructuredResponse {
  sql: string;
  explanation: string;
  /** JSON-stringified query result payload. */
  result: string;
  confirmation: string;
  /** If true, the operation needs user sign-off before executing. */
  confirmation_required?: boolean;
  user_confirmed?: boolean;
  /** UI-persisted decision (distinct from model's user_confirmed). */
  confirmation_decision?: "accepted" | "rejected";
}

type SortDirection = "asc" | "desc" | null;
interface SortState {
  column: string;
  direction: SortDirection;
}

export interface AssistantMessageProps {
  content: string;
  /**
   * Called when the user clicks Accept (true) or Reject (false).
   * The parent should inject a follow-up user message into the chat
   * so the LLM knows whether to proceed.
   */
  onConfirm?: (accepted: boolean) => void;
  /**
   * Emits whether the confirmation buttons are still visible for this message.
   * `true` means Accept/Reject is currently shown.
   */
  onConfirmationStateChange?: (pending: boolean) => void;
  /**
   * Called to persist the decision in the message content.
   * The parent should update the stored message with this decision.
   */
  onDecisionPersist?: (decision: "accepted" | "rejected") => void;
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
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted text-muted-foreground text-xs font-mono">
        <span>SQL</span>
        <button
          onClick={copy}
          className="hover:text-foreground transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="px-4 py-3 overflow-x-auto font-mono text-sm leading-relaxed whitespace-pre">
        {sql}
      </pre>
    </div>
  );
}

// ─── Result Table ─────────────────────────────────────────────────────────────

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

function ResultTable({ result }: { result: string }) {
  const [sort, setSort] = useState<SortState>({ column: "", direction: null });
  const rows = useMemo(() => parseRows(result), [result]);

  // Move sortedRows hook before any early returns to comply with Rules of Hooks
  const sortedRows = useMemo(() => {
    if (!rows || !sort.column || !sort.direction) return rows ?? [];
    return [...rows].sort((a, b) => {
      const av = a[sort.column],
        bv = b[sort.column];
      const aNum = Number(av),
        bNum = Number(bv);
      const numeric = !isNaN(aNum) && !isNaN(bNum);
      const cmp = numeric
        ? aNum - bNum
        : String(av ?? "").localeCompare(String(bv ?? ""));
      return sort.direction === "asc" ? cmp : -cmp;
    });
  }, [rows, sort]);

  if (!rows) {
    const trimmed = result?.trim();
    if (!trimmed || trimmed === "null" || trimmed === "[]" || trimmed === "{}")
      return null;
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
    if (sort.column !== col)
      return <ChevronsUpDown className="h-3 w-3 opacity-40" />;
    return sort.direction === "asc" ? (
      <ChevronUp className="h-3 w-3" />
    ) : (
      <ChevronDown className="h-3 w-3" />
    );
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

// ─── Confirmation Banner ──────────────────────────────────────────────────────

/**
 * Shown when `confirmation_required` is true.
 *
 * Displays the LLM's confirmation text and two action buttons.
 * After the user clicks, the buttons are replaced by a compact status badge
 * so the decision is permanently visible in the chat history.
 */
function ConfirmationBanner({
  text,
  onConfirm,
  onPendingChange,
  persistedDecision,
  onDecisionPersist,
}: {
  text: string;
  onConfirm?: (accepted: boolean) => void;
  onPendingChange?: (pending: boolean) => void;
  persistedDecision?: "accepted" | "rejected";
  onDecisionPersist?: (decision: "accepted" | "rejected") => void;
}) {
  // Local state for immediate UI feedback before persistence completes
  const [localDecision, setLocalDecision] = useState<
    "accepted" | "rejected" | null
  >(null);

  // Effective decision: prefer persisted (survives reload), fall back to local (immediate feedback)
  const decision = persistedDecision ?? localDecision;

  // Use a ref to avoid depending on the callback identity in the effect
  const onPendingChangeRef = useRef(onPendingChange);
  useEffect(() => {
    onPendingChangeRef.current = onPendingChange;
  });

  useEffect(() => {
    onPendingChangeRef.current?.(decision === null);
    return () => onPendingChangeRef.current?.(false);
  }, [decision]);

  const handleClick = (accepted: boolean) => {
    const d = accepted ? "accepted" : "rejected";
    setLocalDecision(d);
    onDecisionPersist?.(d);
    onConfirm?.(accepted);
  };

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
        ⚠️ Confirmation required
      </p>

      <p className="text-sm leading-relaxed">{text}</p>

      {decision === null ? (
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
            onClick={() => handleClick(true)}
          >
            <Check className="h-3.5 w-3.5" />
            Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
            onClick={() => handleClick(false)}
          >
            <X className="h-3.5 w-3.5" />
            Reject
          </Button>
        </div>
      ) : (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
            decision === "accepted"
              ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
              : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
          )}
        >
          {decision === "accepted" ? (
            <Check className="h-3 w-3" />
          ) : (
            <X className="h-3 w-3" />
          )}
          {decision === "accepted" ? "Accepted — executing…" : "Rejected"}
        </span>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract all valid JSON objects from content and merge them.
 * Handles cases where the LLM outputs multiple JSON responses.
 */
function extractStructured(content: string): StructuredResponse | null {
  const jsonObjects: Partial<StructuredResponse>[] = [];
  let depth = 0;
  let start = -1;

  // Find all balanced JSON objects in the content
  for (let i = 0; i < content.length; i++) {
    if (content[i] === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (content[i] === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        const jsonStr = content.slice(start, i + 1);
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed && typeof parsed === "object") {
            jsonObjects.push(parsed);
          }
        } catch {
          // Not valid JSON, skip
        }
        start = -1;
      }
    }
  }

  if (jsonObjects.length === 0) return null;

  // Merge all JSON objects, later ones override earlier ones
  const merged: Partial<StructuredResponse> = {};
  for (const obj of jsonObjects) {
    // For each field, prefer non-empty values
    if (obj.sql && (!merged.sql || merged.sql.trim() === ""))
      merged.sql = obj.sql;
    if (
      obj.explanation &&
      (!merged.explanation || merged.explanation.trim() === "")
    )
      merged.explanation = obj.explanation;
    if (
      obj.result &&
      (!merged.result ||
        merged.result.trim() === "" ||
        merged.result === "null" ||
        merged.result === "[]")
    ) {
      merged.result = obj.result;
    }
    if (
      obj.confirmation &&
      (!merged.confirmation || merged.confirmation.trim() === "")
    )
      merged.confirmation = obj.confirmation;
    if (obj.confirmation_required !== undefined)
      merged.confirmation_required = obj.confirmation_required;
    if (obj.user_confirmed !== undefined)
      merged.user_confirmed = obj.user_confirmed;
    if (obj.confirmation_decision !== undefined)
      merged.confirmation_decision = obj.confirmation_decision;
  }

  // Only return if we have at least an explanation
  if (typeof merged.explanation === "string") {
    return merged as StructuredResponse;
  }

  return null;
}

function cleanConfirmation(text: string): string {
  return text
    .split("\n")
    .filter(
      (line) => !line.trim().startsWith("|") && !line.trim().startsWith("|-"),
    )
    .join("\n")
    .trim();
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function AssistantMessage({
  content,
  onConfirm,
  onConfirmationStateChange,
  onDecisionPersist,
}: AssistantMessageProps) {
  const structured = extractStructured(content);

  // Any non-JSON prefix lines (e.g. "🔧 Executing tool: query...")
  const prefixLines = structured
    ? content
        .slice(0, content.indexOf("{"))
        .split("\n")
        .map((l) => l.replace(/\*/g, "").trim())
        .filter(Boolean)
    : [];

  if (!structured) {
    return (
      <pre className="whitespace-pre-wrap text-sm font-sans">{content}</pre>
    );
  }

  const {
    sql,
    explanation,
    result,
    confirmation,
    confirmation_required,
    confirmation_decision,
  } = structured;

  const sqlString = typeof sql === "string" ? sql : "";
  const hasSql =
    sqlString.trim().length > 0 &&
    sqlString.trim() !== "{}" &&
    sqlString.trim() !== "null";

  const cleanedConfirmation = confirmation
    ? cleanConfirmation(String(confirmation))
    : "";

  return (
    <div className="space-y-3 text-sm">
      {/* Tool status prefix */}
      {prefixLines.map((line, i) => (
        <p key={i} className="text-muted-foreground text-xs">
          {line}
        </p>
      ))}

      {/* SQL */}
      {hasSql && <SqlBlock sql={sqlString.trim()} />}

      {/* Explanation */}
      {explanation && <p className="leading-relaxed">{explanation}</p>}

      {/* Result table */}
      {result && <ResultTable result={result} />}

      {/* Confirmation — interactive banner or plain muted text */}
      {cleanedConfirmation &&
        (confirmation_required ? (
          <ConfirmationBanner
            text={cleanedConfirmation}
            onConfirm={onConfirm}
            onPendingChange={onConfirmationStateChange}
            persistedDecision={confirmation_decision}
            onDecisionPersist={onDecisionPersist}
          />
        ) : (
          <p className="text-muted-foreground text-xs border-t pt-2">
            {cleanedConfirmation}
          </p>
        ))}
    </div>
  );
}
