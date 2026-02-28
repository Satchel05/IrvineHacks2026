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
  confirmation_decision?: 'accepted' | 'rejected';
  /** Risk level: 0=low, 1=moderate, 2=high, 3=extreme */
  risk?: number;
}

/**
 * Extracts and merges all valid JSON objects from a content string.
 *
 * Handles cases where the LLM prefixes output with tool-call lines like:
 *   "🔧 Executing tool: query...\n\n{ ...json... }"
 *
 * If multiple JSON blobs are present, later fields override earlier ones
 * only when the earlier value is empty/null.
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
    if (obj.sql && !merged.sql?.trim()) merged.sql = obj.sql;
    if (obj.explanation && !merged.explanation?.trim()) merged.explanation = obj.explanation;
    if (
      obj.result &&
      (!merged.result?.trim() || merged.result === "null" || merged.result === "[]")
    ) merged.result = obj.result;
    if (obj.confirmation && !merged.confirmation?.trim()) merged.confirmation = obj.confirmation;
    if (obj.confirmation_required !== undefined) merged.confirmation_required = obj.confirmation_required;
    if (obj.user_confirmed !== undefined) merged.user_confirmed = obj.user_confirmed;
    if (obj.confirmation_decision !== undefined) merged.confirmation_decision = obj.confirmation_decision;
    if (obj.risk !== undefined) merged.risk = obj.risk;
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