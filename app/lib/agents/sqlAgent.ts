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
  const messages: Anthropic.MessageParam[] = chatHistory
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: `You are a SQL expert. Given the SQL schema Return ONLY a SQL query, nothing else. 
    If you cannot answer the question with sql, set sql to NULL`,
    messages: [
      {
        role: 'user',
        content: `Answer the users question: ${question} based on the database ${schema} and take into account previous messages: ${messages}`,
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
