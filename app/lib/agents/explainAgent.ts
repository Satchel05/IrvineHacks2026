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
You are a SQL expert who understands the schema and can explain SQL queries.
Read through the chat history and provide detailed answers to the user's questions about the database schema and SQL queries, or any friendly conversation they may have. If the user asks a question that cannot be answered with SQL, provide a clear and concise explanation or guidance based on your expertise.
The explanation should be clear and concise, suitable for someone with basic to no SQL knowledge.
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
): Promise<string> {

  const questionPrefix: Anthropic.MessageParam[] = question
    ? [{ role: 'user', content: `CURRENT QUESTION (answer this above all else):\n${question}` }]
    : [];

  // No SQL — conversational fallback using chat history only
  if (!tentativeSql) {
    const history: Anthropic.MessageParam[] = chatHistory
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    const messages: Anthropic.MessageParam[] = [...questionPrefix, ...history];
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: NO_QUERY_EXPLANATION_DESCRIPTION,
      messages,
      output_config: OUTPUT_SCHEMA,
    });
    const block = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    if (!block?.text) throw new Error('explainAgent: empty response from model');
    return (JSON.parse(block.text) as { explanation: string }).explanation;
  }

  // SQL provided + connection available — get real query plan from Postgres via MCP
  if (connectionString) {
    const isSelect = /^\s*SELECT\b/i.test(tentativeSql.trim());
    // Use EXPLAIN ANALYZE only for SELECT — DML with ANALYZE executes and auto-commits
    const explainSql = isSelect
      ? `EXPLAIN ANALYZE ${tentativeSql}`
      : `EXPLAIN ${tentativeSql}`;
    const { mcpClient } = await getMCPClient(connectionString);
    const mcpResult = await mcpClient.callTool({
      name: 'execute_query',
      arguments: { sql: explainSql },
    });

    const rawPlan = (mcpResult.content as MCPTextBlock[])
      .filter((b) => b?.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text!)
      .join('\n');

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
    const block = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    if (!block?.text) throw new Error('explainAgent: empty response from model');
    return (JSON.parse(block.text) as { explanation: string }).explanation;
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
  const block = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
  if (!block?.text) throw new Error('explainAgent: empty response from model');
  return (JSON.parse(block.text) as { explanation: string }).explanation;
}
