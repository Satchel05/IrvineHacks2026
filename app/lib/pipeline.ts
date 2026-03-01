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

  const explanation = await explainAgent(
    sql,
    chatHistory,
    connectionString,
    question,
  );

  


  if(sql){
    const risk = await riskAgent(sql);
    const results = await tableAgent(sql, connectionString, schema.details);
    return { sql, results, explanation, risk };
  }else{
    const risk = null;
    const results = null;
    return { sql, results, explanation, risk };
  }
  



  
}
