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
    const isSelect = /^\s*SELECT\b/i.test(sql.trim());

    if (isSelect) {
      // SELECT queries: all three agents are independent — run in parallel
      const [risk, tableResult, explanation] = await Promise.all([
        riskAgent(sql),
        tableAgent(sql, connectionString, schema.details).catch((err) => {
          console.error('[pipeline] tableAgent error:', err);
          return null;
        }),
        explainAgent(sql, chatHistory, connectionString, question),
      ]);
      console.log('[pipeline] riskAgent returned:', JSON.stringify(risk));
      console.log(
        '[pipeline] tableAgent returned, transactionId:',
        tableResult?.transactionId,
      );
      return {
        sql,
        results: tableResult,
        explanation,
        risk,
        transactionId: tableResult?.transactionId ?? null,
      };
    } else {
      // Write queries: run riskAgent in parallel with (tableAgent → explainAgent)
      const [risk, { results, sqlError }] = await Promise.all([
        riskAgent(sql),
        (async () => {
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
          return { results, sqlError };
        })(),
      ]);
      console.log('[pipeline] riskAgent returned:', JSON.stringify(risk));

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
    }
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
