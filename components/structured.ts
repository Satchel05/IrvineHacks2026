/**
 * structured.ts — Shared types and parsing helpers for LLM responses.
 *
 * The LLM returns JSON matching `StructuredResponse`. This module provides:
 *   - The type definition
 *   - `extractStructured` — parses (possibly multi-JSON) content strings
 *   - `cleanConfirmation` — strips markdown table artifacts from LLM output
 */

export interface StructuredResponse {
  sql: string;
  explanation: string;
  /** JSON-stringified query result payload. */
  result: string;
  confirmation: string;
  confirmation_required?: boolean;
  user_confirmed?: boolean;
  /** UI-persisted decision — injected by the frontend, not the LLM. */
  confirmation_decision?: "accepted" | "rejected";
  /** Risk level: 0=low, 1=moderate, 2=high, 3=extreme */
  risk?: number;
}

/**
 * Extracts and merges all valid JSON objects from a content string.
 *
 * Handles cases where the LLM prefixes output with tool-call lines like:
 *   "🔧 Executing tool: query...\n\n{ ...json... }"
 *
 * Merge strategy per field type:
 *   - Text fields (sql, explanation, confirmation): first non-empty value wins.
 *     The first blob is the LLM's considered response; later blobs are
 *     post-tool-call summaries that sometimes omit or downgrade these fields.
 *   - result: last non-empty value wins — the final blob has actual query data.
 *   - risk: HIGHEST value across all blobs (most conservative).
 *   - confirmation_required: TRUE if ANY blob says true (most conservative).
 *   - user_confirmed: TRUE if ANY blob says true.
 *   - confirmation_decision: first value wins (UI-injected, set once).
 */
export function extractStructured(content: string): StructuredResponse | null {
  const jsonObjects: Partial<StructuredResponse>[] = [];
  let depth = 0;
  let start = -1;

  for (let i = 0; i < content.length; i++) {
    if (content[i] === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (content[i] === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        try {
          const parsed = JSON.parse(content.slice(start, i + 1));
          if (parsed && typeof parsed === "object") jsonObjects.push(parsed);
        } catch {
          // Not valid JSON — skip
        }
        start = -1;
      }
    }
  }

  if (jsonObjects.length === 0) return null;

  const merged: Partial<StructuredResponse> = {};
  for (const obj of jsonObjects) {
    // Text fields: first non-empty wins
    if (obj.sql && !merged.sql?.trim()) merged.sql = obj.sql;
    if (obj.explanation && !merged.explanation?.trim()) merged.explanation = obj.explanation;
    if (obj.confirmation && !merged.confirmation?.trim()) merged.confirmation = obj.confirmation;

    // result: last non-empty wins (final blob has actual executed data)
    if (obj.result?.trim() && obj.result !== "null" && obj.result !== "[]") {
      merged.result = obj.result;
    }

    // risk: take the HIGHEST seen value — never silently downgrade
    if (obj.risk !== undefined) {
      merged.risk = merged.risk === undefined
        ? obj.risk
        : Math.max(merged.risk, obj.risk);
    }

    // confirmation_required: true if ANY blob says true
    if (obj.confirmation_required === true) merged.confirmation_required = true;
    else if (obj.confirmation_required === false && merged.confirmation_required === undefined) {
      merged.confirmation_required = false;
    }

    // user_confirmed: true if ANY blob says true
    if (obj.user_confirmed === true) merged.user_confirmed = true;
    else if (obj.user_confirmed === false && merged.user_confirmed === undefined) {
      merged.user_confirmed = false;
    }

    // confirmation_decision: first value wins (UI-injected, set once)
    if (obj.confirmation_decision !== undefined && merged.confirmation_decision === undefined) {
      merged.confirmation_decision = obj.confirmation_decision;
    }
  }

  return typeof merged.explanation === "string"
    ? (merged as StructuredResponse)
    : null;
}

/**
 * Strips markdown table rows from the LLM's confirmation text.
 * The LLM sometimes renders a table even when we display one ourselves.
 */
export function cleanConfirmation(text: string): string {
  return text
    .split("\n")
    .filter(
      (line) =>
        !line.trim().startsWith("|") && !line.trim().startsWith("|-"),
    )
    .join("\n")
    .trim();
}

/**
 * Returns any non-JSON prefix lines from content
 * (e.g. "🔧 Executing tool: query..."), with markdown emphasis stripped.
 */
export function extractPrefixLines(
  content: string,
  structured: StructuredResponse,
): string[] {
  return content
    .slice(0, content.indexOf("{"))
    .split("\n")
    .map((l) => l.replace(/\*/g, "").trim())
    .filter(Boolean);
}