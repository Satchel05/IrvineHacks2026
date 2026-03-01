import type { RiskAgentResult } from '@/app/lib/utils/types';

/**
 * riskAgent — fully deterministic, zero LLM calls.
 *
 * Risk levels:
 *   3 = Extreme  — DROP, TRUNCATE, DDL (ALTER/CREATE/RENAME), GRANT/REVOKE
 *   2 = High     — DELETE (any), UPDATE without WHERE
 *   1 = Moderate — INSERT, UPDATE with WHERE
 *   0 = Low      — SELECT / WITH / EXPLAIN (read-only)
 */
export function riskAgent(tentativeSql: string): RiskAgentResult {
  const sql = tentativeSql.trim();
  // Strip leading SQL comments so we match the first real keyword
  const stripped = sql.replace(/^(--[^\n]*\n|\/\*[\s\S]*?\*\/|\s)+/, '').toUpperCase();

  // Level 3 — schema / irreversible changes
  if (/^(DROP|TRUNCATE|ALTER|CREATE|RENAME|GRANT|REVOKE)\b/.test(stripped)) {
    return { risk: 3, rowEstimate: null };
  }

  // Level 2 — broad destructive writes
  // DELETE is always level 2
  if (/^DELETE\b/.test(stripped)) {
    return { risk: 2, rowEstimate: null };
  }
  // UPDATE without a WHERE clause
  if (/^UPDATE\b/.test(stripped) && !/\bWHERE\b/.test(stripped)) {
    return { risk: 2, rowEstimate: null };
  }

  // Level 1 — scoped writes
  if (/^(INSERT|UPDATE|MERGE|REPLACE|UPSERT)\b/.test(stripped)) {
    return { risk: 1, rowEstimate: null };
  }

  // Level 0 — read-only
  return { risk: 0, rowEstimate: null };
}
