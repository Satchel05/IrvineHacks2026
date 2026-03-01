import Anthropic from '@anthropic-ai/sdk';
import { getMCPClient } from '@/app/lib/mcp';
import type { ChatMessage, MCPTextBlock } from '@/app/lib/utils/types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SUMMARIZE_EXPLAIN_DESCRIPTION = `
You are a SQL performance expert. You have been given the raw output of a PostgreSQL EXPLAIN ANALYZE query plan.
Summarize it in plain English:
- What the query does
- How Postgres is executing it (seq scan, index scan, joins, etc.)
- Any notable costs, row estimates, or actual times
- Any potential performance concerns

Keep it concise and accessible to someone with basic SQL knowledge.
`;

const NO_QUERY_EXPLANATION_DESCRIPTION = `
You are a SQL expert with FULL read AND write access to the user's database.
You CAN execute SELECT, INSERT, UPDATE, DELETE, and any other SQL operations.
Read through the chat history and provide detailed answers to the user's questions about the database schema and SQL queries, or any friendly conversation they may have.
If the user asks to add, update, or delete data, let them know you can do that — do NOT say you are limited to read-only or SELECT queries.
If the question truly cannot be answered with SQL, provide a clear and concise explanation or guidance based on your expertise.
The explanation should be clear and concise, suitable for someone with basic to no SQL knowledge.

CRITICAL: You are the EXPLANATION agent, not the execution agent. You do NOT execute SQL yourself.
If no SQL query was generated or executed for this request, you MUST NOT claim that data was added, updated, or deleted.
Instead, say something like: "I wasn't able to generate the SQL for this request. Could you try rephrasing it?"
NEVER fabricate or hallucinate that an operation was performed when no SQL was provided to you.
`;

const SQL_ERROR_DESCRIPTION = `
You are a SQL expert. The user asked a question, an SQL query was generated, but it failed to execute.
Explain what went wrong in plain English:
- What the query was trying to do
- Why it failed (e.g. wrong column name, missing table, syntax error)
- Suggest how the user could rephrase their request to get the correct result

Keep it concise, friendly, and accessible to someone with basic to no SQL knowledge.
`;

const OUTPUT_SCHEMA = {
  format: {
    type: 'json_schema',
    schema: {
      type: 'object',
      properties: { explanation: { type: 'string' } },
      required: ['explanation'],
      additionalProperties: false,
    },
  },
} as const;

// Step 2 in pipeline: explain SQL via MCP's EXPLAIN ANALYZE, then summarize with Claude
export async function explainAgent(
  tentativeSql: string | null,
  chatHistory: ChatMessage[],
  connectionString?: string,
  question: string = '',
  sqlError?: string | null,
): Promise<string> {
  const questionPrefix: Anthropic.MessageParam[] =
    question ?
      [
        {
          role: 'user',
          content: `CURRENT QUESTION (answer this above all else):\n${question}`,
        },
      ]
    : [];

  // SQL execution failed — explain the error to the user
  if (tentativeSql && sqlError) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SQL_ERROR_DESCRIPTION,
      messages: [
        ...questionPrefix,
        {
          role: 'user',
          content: `SQL attempted:\n${tentativeSql}\n\nError:\n${sqlError}`,
        },
      ],
      output_config: OUTPUT_SCHEMA,
    });
    const block = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === 'text',
    );
    if (!block?.text)
      throw new Error('explainAgent: empty response from model');
    return (JSON.parse(block.text) as { explanation: string }).explanation;
  }

  // No SQL — conversational fallback using chat history only
  if (!tentativeSql) {
    const history: Anthropic.MessageParam[] = chatHistory
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));
    const messages: Anthropic.MessageParam[] = [...questionPrefix, ...history];
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: NO_QUERY_EXPLANATION_DESCRIPTION,
      messages,
      output_config: OUTPUT_SCHEMA,
    });
    const block = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === 'text',
    );
    if (!block?.text)
      throw new Error('explainAgent: empty response from model');
    return (JSON.parse(block.text) as { explanation: string }).explanation;
  }

  // SQL provided + connection available — get real query plan from Postgres via MCP
  if (connectionString) {
    const isSelect = /^\s*SELECT\b/i.test(tentativeSql.trim());

    try {
      // EXPLAIN ANALYZE is safe for SELECTs; plain EXPLAIN for DML (no execution)
      const explainSql =
        isSelect ?
          `EXPLAIN ANALYZE ${tentativeSql}`
        : `EXPLAIN ${tentativeSql}`;

      // SELECT-based EXPLAIN goes through execute_query;
      // DML-based EXPLAIN must go through execute_dml_ddl_dcl_tcl
      const toolName = isSelect ? 'execute_query' : 'execute_dml_ddl_dcl_tcl';

      const { mcpClient } = await getMCPClient(connectionString);
      const mcpResult = await mcpClient.callTool({
        name: toolName,
        arguments: { sql: explainSql },
      });

      const rawPlan = (mcpResult.content as MCPTextBlock[])
        .filter((b) => b?.type === 'text' && typeof b.text === 'string')
        .map((b) => b.text!)
        .join('\n');

      // If MCP returned an error, fall through to static analysis below
      if (mcpResult.isError || /\berror\b/i.test(rawPlan)) {
        throw new Error(rawPlan);
      }

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: SUMMARIZE_EXPLAIN_DESCRIPTION,
        messages: [
          ...questionPrefix,
          {
            role: 'user',
            content: `SQL:\n${tentativeSql}\n\nPostgres EXPLAIN ANALYZE output:\n${rawPlan}`,
          },
        ],
        output_config: OUTPUT_SCHEMA,
      });
      const block = response.content.find(
        (b): b is Anthropic.TextBlock => b.type === 'text',
      );
      if (!block?.text)
        throw new Error('explainAgent: empty response from model');
      return (JSON.parse(block.text) as { explanation: string }).explanation;
    } catch {
      // EXPLAIN failed (e.g. invalid column) — fall through to static analysis
    }
  }

  // SQL provided but no connection — fall back to Claude's static analysis
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SUMMARIZE_EXPLAIN_DESCRIPTION,
    messages: [
      ...questionPrefix,
      { role: 'user', content: `Explain this SQL query:\n${tentativeSql}` },
    ],
    output_config: OUTPUT_SCHEMA,
  });
  const block = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === 'text',
  );
  if (!block?.text) throw new Error('explainAgent: empty response from model');
  return (JSON.parse(block.text) as { explanation: string }).explanation;
}
