import Anthropic from '@anthropic-ai/sdk';
import { getMCPClient } from '@/app/lib/mcp';
import type { TableAgentResult, MCPTextBlock } from '@/app/lib/utils/types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

// Step 3 in pipeline: execute SQL via MCP, then format result with LLM
export async function tableAgent(
  sql: string,
  connectionString: string,
  userApproval = false,
  schema: string,
): Promise<TableAgentResult> {
  const isSelect = /^\s*SELECT\b/i.test(sql.trim());
  const needsApproval = !isSelect && !userApproval;

  // ── Branch A: write op without approval — preview only, no DB execution ──
  if (needsApproval) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: `You are a SQL change previewer. The user has NOT yet approved this write operation. Based solely on the SQL statement, describe what rows WOULD be inserted, updated, or deleted if this were executed. Do NOT execute anything — only predict the impact.\n\n${TABLE_REQUIREMENTS}`,
      messages: [
        {
          role: 'user',
          content: `Preview the impact of this SQL (not yet approved):\n${sql}\n\nSchema:\n${schema}`,
        },
      ],
      output_config: {
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              result: {
                type: 'string',
                description: TABLE_REQUIREMENTS,
              },
            },
            required: ['result'],
            additionalProperties: false,
          },
        },
      },
    });

    const block = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    const text = block?.text;
    if (!text) throw new Error('tableAgent: empty response from model');

    try {
      const parsed = JSON.parse(text) as { result: string };
      return { result: parsed.result, requiresApproval: true };
    } catch {
      throw new Error(`tableAgent: failed to parse preview response — ${text}`);
    }
  }

  // ── Branch B: SELECT or approved write — execute via MCP then format ──
  const { mcpClient } = await getMCPClient(connectionString);
  const mcpResult = await mcpClient.callTool({
    name: 'execute_query',
    arguments: { sql },
  });

  const rawText = (mcpResult.content as MCPTextBlock[])
    .filter((b) => b?.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text!)
    .join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: `You are a SQL result formatter. Given a raw database result, return the rows or affected records as a clean JSON-stringified value.\n\n${TABLE_REQUIREMENTS}`,
    messages: [
      {
        role: 'user',
        content: `SQL executed:\n${sql}\n\nRaw database result:\n${rawText}\n\nSchema:\n${schema}`,
      },
    ],
    output_config: {
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            result: {
              type: 'string',
              description: TABLE_REQUIREMENTS,
            },
          },
          required: ['result'],
          additionalProperties: false,
        },
      },
    },
  });

  const block = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
  const text = block?.text;
  if (!text) throw new Error('tableAgent: empty response from model');

  try {
    const parsed = JSON.parse(text) as { result: string };
    return { result: parsed.result, requiresApproval: false };
  } catch {
    throw new Error(`tableAgent: failed to parse response — ${text}`);
  }
}
