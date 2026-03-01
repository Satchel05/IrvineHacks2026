import Anthropic from '@anthropic-ai/sdk';
import { extractSqlFromContentBlocks } from '@/app/lib/utils/extractSqlFromContentBlocks';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Step 1 in pipeline: NL to SQL
export async function sqlAgent(
  question: string,
  schema: string,
): Promise<string | null> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    // does this force
    system: `You are a SQL expert. Given this schema:\n${schema}\nReturn ONLY a SQL query, nothing else. 
    If you cannot answer the question with sql, set sql to NULL`,
    messages: [{ role: 'user', content: question }],
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
