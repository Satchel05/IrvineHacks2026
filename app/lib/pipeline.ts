import { initializeSchema } from './mcp';
import { sqlAgent } from './agents/sqlAgent';
import { riskAgent } from './agents/riskAgent';
import { tableAgent } from './agents/tableAgent';
import { explainAgent } from './agents/explainAgent';
import type { ChatMessage } from './utils/types';

export async function pipeline(
  question: string,
  connectionString: string,
  chatHistory: ChatMessage[],
) {
  const schema = await initializeSchema(connectionString); // cached after first call

  const sql = await sqlAgent(question, schema.details, chatHistory);

  if (sql) {
    const risk = await riskAgent(sql);
    // Run tableAgent BEFORE explainAgent for write queries so that
    // explainAgent's EXPLAIN doesn't interfere with the open transaction.
    let results: Awaited<ReturnType<typeof tableAgent>> | null = null;
    let sqlError: string | null = null;

    try {
      results = await tableAgent(sql, connectionString, schema.details);
    } catch (err) {
      // SQL execution failed (e.g. wrong column name). Capture the error so
      // the explainAgent can describe it to the user instead of crashing.
      sqlError = err instanceof Error ? err.message : String(err);
    }

    const explanation = await explainAgent(
      sql,
      chatHistory,
      connectionString,
      question,
      sqlError,
    );
    return { sql, results, explanation, risk };
  } else {
    const explanation = await explainAgent(
      sql,
      chatHistory,
      connectionString,
      question,
    );
    const risk = null;
    const results = null;
    return { sql, results, explanation, risk };
  }
}
