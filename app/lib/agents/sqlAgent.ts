import Anthropic from '@anthropic-ai/sdk';
import { extractSqlFromContentBlocks } from '@/app/lib/utils/extractSqlFromContentBlocks';
import type { ChatMessage } from '@/app/lib/utils/types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Step 1 in pipeline: NL to SQL
export async function sqlAgent(
  question: string,
  schema: string,
  chatHistory: ChatMessage[],
): Promise<string | null> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: `You are a SQL expert. Given the COMPLETE database schema below, return a valid SQL query that answers the user's question.
If the question truly cannot be answered with SQL, set sql to NULL.

CRITICAL RULES:
- The DATABASE SCHEMA below contains ALL tables and their exact column names and types. This is the ONLY source of truth.
- Use ONLY the exact table names and column names from the schema. NEVER guess or invent column names.
- NEVER query information_schema, pg_catalog, or any other metadata tables — you already have all the schema information you need.
- For INSERT statements: use the exact columns from the schema. If a column is an auto-increment/serial primary key (like "id"), omit it from the INSERT — the database will generate it.
- For JSONB columns: store structured data as a JSON object, e.g. '{"key": "value"}'::jsonb
- If the user's request is ambiguous about which column to use, pick the most reasonable column from the schema and proceed — do NOT return NULL just because you're slightly unsure.

DATABASE SCHEMA:
${schema}`,
    messages: [
      {
        role: 'user',
        content: `User question: ${question}\n\nPrevious conversation for context:\n${chatHistory
          .filter((m) => m.role !== 'system')
          .map((m) => `${m.role}: ${m.content}`)
          .join('\n')}`,
      },
    ],
    output_config: {
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            sql: {
              type: ['string', 'null'],
              description:
                'The SQL query to execute. If no valid SQL query can be generated, return NULL.',
            },
          },
          required: ['sql'],
          additionalProperties: false,
        },
      },
    },
  });

  const sql = extractSqlFromContentBlocks(response.content);
  return sql;
}
