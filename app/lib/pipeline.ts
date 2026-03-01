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
    // riskAgent is now synchronous (pure keyword analysis) — instant, no LLM call
    const risk = riskAgent(sql);
    console.log('[pipeline] riskAgent returned:', JSON.stringify(risk));

    const isReadQuery = /^\s*(SELECT|WITH|EXPLAIN)\b/i.test(sql);

    let results: Awaited<ReturnType<typeof tableAgent>> | null = null;
    let sqlError: string | null = null;
    let explanation: string;

    if (isReadQuery) {
      // For SELECT queries, run table execution and EXPLAIN in parallel — saves ~3-5s
      const [tableOutcome, explainOutcome] = await Promise.allSettled([
        tableAgent(sql, connectionString, schema.details),
        explainAgent(sql, chatHistory, connectionString, question, null),
      ]);

      if (tableOutcome.status === 'fulfilled') {
        results = tableOutcome.value;
        console.log('[pipeline] tableAgent returned, transactionId:', results.transactionId);
      } else {
        sqlError = tableOutcome.reason instanceof Error ? tableOutcome.reason.message : String(tableOutcome.reason);
        console.error('[pipeline] tableAgent error:', sqlError);
      }

      explanation =
        explainOutcome.status === 'fulfilled' ?
          explainOutcome.value
        : await explainAgent(sql, chatHistory, connectionString, question, sqlError);
    } else {
      // For writes: do NOT open a transaction here.
      // The transaction is opened and immediately committed only when the user
      // clicks confirm — this prevents the 60-second timeout from hitting while
      // the explanation is being streamed and the user is reading it.
      explanation = await explainAgent(sql, chatHistory, connectionString, question, null);
      console.log('[pipeline] skipped tableAgent for write — will execute on confirm');
    }

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
