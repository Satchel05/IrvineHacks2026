import Anthropic from '@anthropic-ai/sdk';
import { getMCPClient } from '@/app/lib/mcp';
import type { MCPTextBlock } from '@/app/lib/utils/types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

// ─── Preview Transaction ────────────────────────────────────────────────────

export interface PreviewResult {
  result: string; // LLM-formatted preview of affected rows
  sql: string;
}

/**
 * Execute a write SQL statement inside a transaction without committing.
 * The real rows are affected and readable, but nothing is persisted until
 * `approvePreview` is called. Call `rejectPreview` to roll back.
 *
 * Pass `connectionString` to approve/reject.
 */
export async function tableAgent(
  sql: string,
  connectionString: string,
  schema: string,
): Promise<PreviewResult> {
  /**
   * Determines whether the provided SQL string is a SELECT query.
   * Uses a case-insensitive regular expression to check if the trimmed SQL
   * statement begins with the SELECT keyword, ignoring leading whitespace.
   * @param sql - The SQL query string to test
   * @returns true if the SQL statement is a SELECT query, false otherwise
   */
  const isSelect = /^\s*SELECT\b/i.test(sql.trim());
  const { mcpClient } = await getMCPClient(connectionString);

  // SELECTs don't need transaction wrapping — execute directly and return
  if (isSelect) {
    const mcpResult = await mcpClient.callTool({
      name: 'execute_query',
      arguments: { sql },
    });
    const rawTextForSelect = (mcpResult.content as MCPTextBlock[])
      .filter((b) => b?.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text!)
      .join('\n');
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: `You are a SQL result formatter. Return the rows as a clean JSON-stringified value.\n\n${TABLE_REQUIREMENTS}`,
      messages: [
        {
          role: 'user',
          content: `SQL executed:\n${sql}\n\nRaw result:\n${rawTextForSelect}\n\nSchema:\n${schema}`,
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
    return { result: parsed.result, sql };
  }

  // Write ops: open a transaction — caller must invoke approvePreview or rejectPreview
  await mcpClient.callTool({
    name: 'execute_query',
    arguments: { sql: 'BEGIN' },
  });

  let rawText: string;
  try {
    const mcpResult = await mcpClient.callTool({
      name: 'execute_query',
      arguments: { sql },
    });

    rawText = (mcpResult.content as MCPTextBlock[])
      .filter((b) => b?.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text!)
      .join('\n');
  } catch (err) {
    // If execution fails, roll back immediately and rethrow
    await mcpClient.callTool({
      name: 'execute_query',
      arguments: { sql: 'ROLLBACK' },
    });
    throw err;
  }

  // Format the live (uncommitted) result with the LLM
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: `You are a SQL result formatter. Given a raw database result from an UNCOMMITTED transaction, return the rows or affected records as a clean JSON-stringified value. Make clear this is a preview — not yet committed.\n\n${TABLE_REQUIREMENTS}`,
    messages: [
      {
        role: 'user',
        content: `SQL executed (inside open transaction, NOT yet committed):\n${sql}\n\nRaw database result:\n${rawText}\n\nSchema:\n${schema}`,
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
  const text = block?.text;
  if (!text) {
    await mcpClient.callTool({
      name: 'execute_query',
      arguments: { sql: 'ROLLBACK' },
    });
    throw new Error('executePreview: empty response from model');
  }

  const parsed = JSON.parse(text) as { result: string };

  return { result: parsed.result, sql };
}

/**
 * Commit the open transaction for this connection.
 * Call this when the user approves the preview.
 */
export async function approvePreview(connectionString: string): Promise<void> {
  const { mcpClient } = await getMCPClient(connectionString);
  await mcpClient.callTool({
    name: 'execute_query',
    arguments: { sql: 'COMMIT' },
  });
}

/**
 * Roll back the open transaction for this connection.
 * Call this when the user rejects the preview.
 */
export async function rejectPreview(connectionString: string): Promise<void> {
  const { mcpClient } = await getMCPClient(connectionString);
  await mcpClient.callTool({
    name: 'execute_query',
    arguments: { sql: 'ROLLBACK' },
  });
}
