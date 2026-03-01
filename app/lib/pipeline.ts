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
  console.log('[pipeline] sqlAgent returned:', sql?.slice(0, 120));

  if (sql) {
    const risk = await riskAgent(sql);
    console.log('[pipeline] riskAgent returned:', JSON.stringify(risk));

    let results: Awaited<ReturnType<typeof tableAgent>> | null = null;
    let sqlError: string | null = null;

    try {
      results = await tableAgent(sql, connectionString, schema.details);
      console.log(
        '[pipeline] tableAgent returned, transactionId:',
        results.transactionId,
      );
    } catch (err) {
      sqlError = err instanceof Error ? err.message : String(err);
      console.error('[pipeline] tableAgent error:', sqlError);
    }

    const explanation = await explainAgent(
      sql,
      chatHistory,
      connectionString,
      question,
      sqlError,
    );
    return {
      sql,
      results,
      explanation,
      risk,
      transactionId: results?.transactionId ?? null,
    };
  } else {
    const explanation = await explainAgent(
      sql,
      chatHistory,
      connectionString,
      question,
    );
    return { sql, results: null, explanation, risk: null, transactionId: null };
  }
}
