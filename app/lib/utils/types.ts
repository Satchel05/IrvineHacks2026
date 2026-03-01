/**
 * types.ts — Shared types and interfaces for all agents and the MCP layer.
 *
 * Import what you need:
 *   import type { RiskAgentResult, ChatMessage, SchemaResult } from '@/app/lib/utils/types';
 */

import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';

// ─── Chat / Messaging ─────────────────────────────────────────────────────────

/** A single message in the chat history passed between the frontend and agents. */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// ─── Risk ─────────────────────────────────────────────────────────────────────

/**
 * Integer risk level of a SQL statement.
 *
 * 0 — Low       : SELECT only, safe to auto-approve
 * 1 — Moderate  : INSERT, scoped UPDATE (with WHERE)
 * 2 — High      : DELETE, broad UPDATE (no WHERE)
 * 3 — Extreme   : DROP, TRUNCATE, DDL, permission changes
 */
export type RiskLevel = 0 | 1 | 2 | 3;

/** Return type of riskAgent — risk classification + estimated affected rows. */
export interface RiskAgentResult {
  risk: RiskLevel;
  rowEstimate: number | null;
}

// ─── SQL Agent ────────────────────────────────────────────────────────────────

/** Return type of sqlAgent — the generated SQL string, or null if unanswerable. */
export interface SqlAgentResult {
  sql: string | null;
}


// ─── Table / Query Results ────────────────────────────────────────────────────

/**
 * A single database row, typed as a plain object with string keys.
 * Values may be any primitive that Postgres returns (string, number, boolean, null).
 */
export type DbRow = Record<string, string | number | boolean | null>;

/** Structured response shape returned by the main AI query pipeline (ai.ts). */
export interface StructuredQueryResponse {
  /** The exact SQL statement that was (or will be) executed. */
  sql: string;
  /** Human-readable explanation of what the query does. */
  explanation: string;
  /**
   * JSON-stringified result payload.
   * SELECT → returned rows. INSERT/UPDATE/DELETE (pre-confirm) → rows to be affected.
   */
  result: string;
  /** Plain-text confirmation message shown to the user before destructive operations. */
  confirmation: string;
  /** Whether this operation still requires explicit user approval before execution. */
  confirmation_required: boolean;
  /** Whether the user has explicitly approved execution. */
  user_confirmed: boolean;
  /** Risk level 0–3. */
  risk: RiskLevel;
  /** Number of rows returned (SELECT) or affected (write operations). */
  rowCount: number;
  /**
   * Persisted accept/reject decision — injected into stored message content
   * so it survives page reloads.
   */
  confirmation_decision?: 'accepted' | 'rejected';
}

// ─── Schema ───────────────────────────────────────────────────────────────────

/** Return type of initializeSchema / the schema cache entries. */
export interface SchemaResult {
  /** Bare table names, e.g. ["users", "orders"]. */
  tables: string[];
  /** Raw column-level details for up to 10 tables, concatenated as plain text. */
  details: string;
}

// ─── MCP Layer ────────────────────────────────────────────────────────────────

/** Stored in the MCP client cache for each unique connection string. */
export interface MCPCacheEntry {
  /** The live MCP client wrapping the Postgres child process. */
  mcpClient: Client;
  /**
   * Anthropic-formatted tool definitions fetched from the MCP server.
   * Pass directly to `anthropic.messages.stream({ tools })`.
   */
  tools: Tool[];
}

/** Shape of a single content block returned by MCP tool calls. */
export interface MCPTextBlock {
  type?: string;
  text?: string;
}

// ─── Agent pipeline ───────────────────────────────────────────────────────────

/**
 * Full context object that can be threaded through a multi-step agent pipeline.
 * Agents upstream populate fields; downstream agents read them.
 */
export interface AgentPipelineContext {
  /** Original natural-language question from the user. */
  question: string;
  /** Database connection string for this request. */
  connectionString: string;
  /** Raw schema text passed to sqlAgent. */
  schema?: string;
  /** SQL produced by sqlAgent. */
  sql?: string | null;
  /** Risk + row estimate produced by riskAgent. */
  riskResult?: RiskAgentResult;
  /** Final structured response from the execution step. */
  queryResult?: StructuredQueryResponse;
}
