import Anthropic from '@anthropic-ai/sdk';
import { extractSqlFromContentBlocks } from '@/app/lib/utils/extractSqlFromContentBlocks';
import type { ChatMessage } from '@/app/lib/utils/types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const WRITE_INTENT_KEYWORDS = [
  'add',
  'insert',
  'create',
  'update',
  'set',
  'change',
  'modify',
  'delete',
  'remove',
  'drop',
  'alter',
  'rename',
  'truncate',
];

/** Detect if the user's question is asking for a write operation */
function isWriteIntent(question: string): boolean {
  const lower = question.toLowerCase();
  return WRITE_INTENT_KEYWORDS.some((kw) => lower.includes(kw));
}

/** Detect if the SQL is a read-only query */
function isSelectOnly(sql: string): boolean {
  const trimmed = sql.trim().toUpperCase();
  return (
    trimmed.startsWith('SELECT') ||
    trimmed.startsWith('WITH') ||
    trimmed.startsWith('EXPLAIN')
  );
}

const SYSTEM_PROMPT = (
  schema: string,
) => `You are a SQL expert with FULL read AND write access to the database. Given the COMPLETE database schema below, return a valid SQL query that fulfills the user's request.
You can and SHOULD generate SELECT, INSERT, UPDATE, DELETE, and any other valid SQL statements as needed.
Only set sql to NULL if the question truly asks for information or knowledge that does not require querying the database. Additionally, set SQL to NULL if the prompt requests a sort of insertion or update that does not provide all of the necessary information.
IF NOT ENOUGH INFORMATION IS PROVIDED FOR AN INSERTION, NEVER CREATE YOUR OWN INFORMATION

CRITICAL RULES:
1. INTENT MATCHING (MOST IMPORTANT):
   - If the user asks to "add", "insert", "create" → generate INSERT.
   - If the user asks to "update", "change", "set", "modify" → generate UPDATE.
   - If the user asks to "delete", "remove" → generate DELETE.
   - NEVER fall back to a SELECT when the user clearly wants a write operation.
   - Even if previous attempts failed, ALWAYS try the correct SQL type matching the user's intent.

2. COLUMN NAMES:
   - The DATABASE SCHEMA section below lists EVERY table with its EXACT column names and data types.
   - You MUST reference ONLY the column names shown in the schema.
   - ABSOLUTELY NEVER query information_schema, pg_catalog, or any system catalog tables.
   - ABSOLUTELY NEVER query information or insert based on columns that do not exist in the given schema. CHECK EVERY TIME.

3. INSERT RULES:
   - Skip auto-increment/serial columns (like "id" with nextval default).
   - Include ALL other NOT NULL columns. If the user doesn't specify a value for a required column, pick a reasonable default (e.g. 1 for an integer FK).
   - For JSONB columns: use '{"key": "value"}'::jsonb syntax.

4. VERIFICATION:
   - Double-check your generated SQL against the schema before returning.
   - Every column name in your SQL MUST appear in the schema.

=== DATABASE SCHEMA (EXACT column names — use these and ONLY these) ===
${schema}
=== END SCHEMA ===`;

/** Prepare a sanitized, limited chat history string */
function formatChatHistory(chatHistory: ChatMessage[]): string {
  // Only keep last 4 messages to avoid history poisoning from failed attempts
  const recent = chatHistory.filter((m) => m.role !== 'system').slice(-4);

  return recent
    .map((m) => {
      if (m.role === 'assistant') {
        try {
          const parsed = JSON.parse(m.content);
          return `assistant: ${parsed.explanation || '(previous response)'}`;
        } catch {
          return `assistant: ${m.content.slice(0, 200)}`;
        }
      }
      return `${m.role}: ${m.content}`;
    })
    .join('\n');
}

async function callSqlLLM(
  question: string,
  schema: string,
  chatHistory: ChatMessage[],
  extraInstruction?: string,
): Promise<string | null> {
  const historyStr = formatChatHistory(chatHistory);
  const userContent =
    extraInstruction ?
      `${extraInstruction}\n\nUser question: ${question}\n\nPrevious conversation for context:\n${historyStr}`
    : `User question: ${question}\n\nPrevious conversation for context:\n${historyStr}`;

  console.log(
    '[sqlAgent] Calling LLM with schema length:',
    schema.length,
    'chars',
  );
  console.log('[sqlAgent] Schema preview:', schema.slice(0, 500));

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: SYSTEM_PROMPT(schema),
    messages: [{ role: 'user', content: userContent }],
    output_config: {
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            sql: {
              type: ['string', 'null'],
              description:
                'The SQL query to execute. NEVER return NULL if the user is asking for a data operation (add, insert, update, delete). Only return NULL for completely non-database questions.',
            },
          },
          required: ['sql'],
          additionalProperties: false,
        },
      },
    },
  });

  const rawBlock = response.content.find(
    (b: any) => b?.type === 'text' && typeof b.text === 'string',
  );
  console.log('[sqlAgent] Raw LLM response:', rawBlock?.text?.slice(0, 200));

  const sql = extractSqlFromContentBlocks(response.content);
  console.log('[sqlAgent] Extracted SQL:', sql?.slice(0, 120) ?? 'NULL');
  return sql;
}

// Step 1 in pipeline: NL to SQL
export async function sqlAgent(
  question: string,
  schema: string,
  chatHistory: ChatMessage[],
): Promise<string | null> {
  const sql = await callSqlLLM(question, schema, chatHistory);

  // Intent-mismatch retry: user asked for a write but we got NULL or a SELECT
  if (isWriteIntent(question) && (!sql || isSelectOnly(sql))) {
    console.warn(
      `[sqlAgent] Intent mismatch! User wants a write operation but got: ${sql?.slice(0, 80) ?? 'NULL'}. Retrying with forceful prompt.`,
    );
    const retrySql = await callSqlLLM(
      question,
      schema,
      chatHistory,
      `CRITICAL OVERRIDE: The user is asking you to WRITE data (add/insert/update/delete). You MUST generate an INSERT, UPDATE, or DELETE statement. Do NOT return null. Do NOT return a SELECT. Generate the correct write SQL using ONLY the column names from the schema above.`,
    );
    if (retrySql && !isSelectOnly(retrySql)) {
      console.log(`[sqlAgent] Retry succeeded: ${retrySql.slice(0, 120)}`);
      return retrySql;
    }
    // Even if retry gave us a SELECT, return it rather than nothing
    if (retrySql) {
      console.warn(`[sqlAgent] Retry still produced a read query. Using it.`);
      return retrySql;
    }
    console.warn(`[sqlAgent] Retry also returned NULL. Giving up.`);
  }

  return sql;
}
