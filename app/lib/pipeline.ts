import { initializeSchema } from './mcp';
import { sqlAgent } from './agents/sqlAgent';
import { riskAgent } from './agents/riskAgent';
import { tableAgent } from './agents/tableAgent';
import { explainAgent } from './agents/explainAgent';
import type { ChatMessage } from './ai';

export async function pipeline(
  question: string,
  connectionString: string,
  chatHistory: ChatMessage[],
) {
  const schema = await initializeSchema(connectionString); // cached after first call

  const sql = await sqlAgent(question, schema.details, chatHistory);
//   if (!sql) return { error: 'Could not generate SQL' };

  const explanation = await explainAgent(
    sql,
    chatHistory,
    connectionString,
    question,
  );

  const risk = await riskAgent(sql);
  if (risk.risk >= 2) return { requiresConfirmation: true, sql, risk };

  const results = await tableAgent(sql, connectionString, schema.details);

  return { sql, results, explanation, risk };
}
