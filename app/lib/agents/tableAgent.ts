import Anthropic from '@anthropic-ai/sdk';
import { getMCPClient } from '@/app/lib/mcp';
import type { MCPTextBlock } from '@/app/lib/utils/types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function isReadQuery(sql: string): boolean {
  return /^\s*(SELECT|WITH|EXPLAIN)\b/i.test(sql.trim());
}

function normalizeResultToJsonString(rawText: string): string {
  const trimmed = rawText.trim();

  if (!trimmed) {
    return JSON.stringify([{ notice: 'No rows returned' }]);
  }

  const tryParse = (text: string): unknown | null => {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  };

  const parsed = tryParse(trimmed);
  if (parsed !== null) {
    if (Array.isArray(parsed)) return JSON.stringify(parsed);
    if (typeof parsed === 'object' && parsed) {
      const obj = parsed as Record<string, unknown>;
      if (Array.isArray(obj.rows)) return JSON.stringify(obj.rows);
      if (Array.isArray(obj.data)) return JSON.stringify(obj.data);
    }
    return JSON.stringify(parsed);
  }

  const jsonMatch = trimmed.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (jsonMatch) {
    const extracted = tryParse(jsonMatch[1]);
    if (extracted !== null) {
      if (Array.isArray(extracted)) return JSON.stringify(extracted);
      if (typeof extracted === 'object' && extracted) {
        const obj = extracted as Record<string, unknown>;
        if (Array.isArray(obj.rows)) return JSON.stringify(obj.rows);
        if (Array.isArray(obj.data)) return JSON.stringify(obj.data);
      }
      return JSON.stringify(extracted);
    }
  }

  return JSON.stringify([{ result: trimmed }]);
}

// ─── Shared SQL Requirements ──────────────────────────────────────────────────

const TABLE_REQUIREMENTS = `
Data returned from a SQL query or affected by a SQL statement.

Represent table information as a JSON string with a structure representative of the tables and columns involved in the SQL query.

NEVER guess or fabricate table names, column names, or data types. If the SQL query references a table or column that does not exist in the schema, return an empty object for that table or column.

You MUST return only the tables and columns that are actually referenced in the SQL query. Do NOT include any additional tables or columns that are not directly involved in the SQL query.

Include ALL column values that will be written. Do NOT summarize. Do NOT omit fields.

The result field MUST always be a JSON-stringified value.

For SELECT queries: the returned rows.
For INSERT operations: a JSON array of the exact row(s) that WERE inserted.
For UPDATE/DELETE: the rows that were affected.
CRITICAL: Never leave result empty — always use the raw database result exactly as returned.
`;

// ─── Result interface ───────────────────────────────────────────────────────

export interface PreviewResult {
  result: string; // LLM-formatted preview of affected rows
  sql: string;
  transactionId?: string; // MCP transaction ID for write operations (needs commit/rollback)
}

/** Extract the raw text from MCP content blocks */
function extractMCPText(content: MCPTextBlock[]): string {
  return content
    .filter((b) => b?.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text!)
    .join('\n');
}

/** Parse transaction_id from MCP DML response text */
function extractTransactionId(rawText: string): string | null {
  try {
    // The MCP response is JSON with transaction_id at the top, followed by instructions
    const jsonMatch = rawText.match(/\{[\s\S]*?"transaction_id"[\s\S]*?\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.transaction_id ?? null;
    }
  } catch {
    /* not JSON */
  }
  // Fallback: regex for transaction ID pattern
  const match = rawText.match(/transaction_id["\s:]+["']?(tx_[a-z0-9_]+)/i);
  return match?.[1] ?? null;
}

/**
 * Execute SQL and return results for display.
 * - SELECT: executed directly via execute_query.
 * - Writes (INSERT/UPDATE/DELETE): executed via execute_dml_ddl_dcl_tcl, which
 *   creates a PENDING TRANSACTION that must be committed or rolled back via
 *   `approvePreview` or `rejectPreview` using the returned `transactionId`.
 */
export async function tableAgent(
  sql: string,
  connectionString: string,
  schema: string,
): Promise<PreviewResult> {
  const isSelect = isReadQuery(sql);
  const { mcpClient } = await getMCPClient(connectionString);

  // SELECTs — execute directly, no transaction needed
  if (isSelect) {
    const mcpResult = await mcpClient.callTool({
      name: 'execute_query',
      arguments: { sql },
    });
    const rawText = extractMCPText(mcpResult.content as MCPTextBlock[]);

    if (mcpResult.isError) {
      throw new Error(rawText || 'execute_query failed');
    }

    return {
      result: normalizeResultToJsonString(rawText),
      sql,
    };
  }

  // ── Write operations (INSERT/UPDATE/DELETE) ──────────────────────────────
  // The MCP server's execute_dml_ddl_dcl_tcl executes the DML and creates a
  // PENDING TRANSACTION with a transaction_id. The data is visible within
  // the transaction but NOT committed until execute_commit is called.
  //
  // Flow:
  //   1. Execute DML → get transaction_id (data pending)
  //   2. Return preview + transaction_id to frontend
  //   3. User approves → call execute_commit(transaction_id)
  //      User rejects → call execute_rollback(transaction_id)

  console.log('[tableAgent] Executing write DML:', sql.slice(0, 120));
  const mcpResult = await mcpClient.callTool({
    name: 'execute_dml_ddl_dcl_tcl',
    arguments: { sql },
  });

  const rawText = extractMCPText(mcpResult.content as MCPTextBlock[]);
  console.log('[tableAgent] DML result:', rawText.slice(0, 400));

  // Check for errors
  if (mcpResult.isError) {
    throw new Error(`SQL execution failed: ${rawText}`);
  }

  // Extract the transaction ID
  const transactionId = extractTransactionId(rawText);
  console.log('[tableAgent] Transaction ID:', transactionId);

  if (!transactionId) {
    console.warn('[tableAgent] No transaction ID found in MCP response!');
  }

  // Ask the LLM to format the write result for display
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: `You are a SQL result formatter. The DML has been executed but NOT committed yet. Format the result for preview.\n\n${TABLE_REQUIREMENTS}`,
    messages: [
      {
        role: 'user',
        content: `SQL executed (pending commit):\n${sql}\n\nMCP result:\n${rawText}\n\nSchema:\n${schema}`,
      },
    ],
    output_config: {
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            result: { type: 'string', description: TABLE_REQUIREMENTS },
          },
          required: ['result'],
          additionalProperties: false,
        },
      },
    },
  });

  const block = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === 'text',
  );
  if (!block?.text) throw new Error('tableAgent: empty response from model');
  const parsed = JSON.parse(block.text) as { result: string };

  return {
    result: parsed.result,
    sql,
    transactionId: transactionId ?? undefined,
  };
}

/**
 * Commit a pending transaction when the user approves.
 * Uses the MCP `execute_commit` tool with the transaction ID.
 */
export async function approvePreview(
  connectionString: string,
  transactionId: string,
): Promise<void> {
  console.log('[approvePreview] Committing transaction:', transactionId);

  const { mcpClient } = await getMCPClient(connectionString);
  const mcpResult = await mcpClient.callTool({
    name: 'execute_commit',
    arguments: { transaction_id: transactionId },
  });

  const rawText = extractMCPText(mcpResult.content as MCPTextBlock[]);
  console.log('[approvePreview] Commit result:', rawText.slice(0, 300));

  if (mcpResult.isError || /\berror\b/i.test(rawText)) {
    throw new Error(`Commit failed: ${rawText}`);
  }
  console.log('[approvePreview] Transaction committed successfully.');
}

/**
 * Rollback a pending transaction when the user rejects.
 * Uses the MCP `execute_rollback` tool with the transaction ID.
 */
export async function rejectPreview(
  connectionString: string,
  transactionId?: string,
): Promise<void> {
  if (!transactionId) {
    console.log('[rejectPreview] No transaction ID — nothing to rollback.');
    return;
  }
  console.log('[rejectPreview] Rolling back transaction:', transactionId);

  const { mcpClient } = await getMCPClient(connectionString);
  const mcpResult = await mcpClient.callTool({
    name: 'execute_rollback',
    arguments: { transaction_id: transactionId },
  });

  const rawText = extractMCPText(mcpResult.content as MCPTextBlock[]);
  console.log('[rejectPreview] Rollback result:', rawText.slice(0, 300));
}
