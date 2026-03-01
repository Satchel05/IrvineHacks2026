import { initializeSchema } from './mcp';
import { sqlAgent } from './agents/sqlAgent';
import { riskAgent } from './agents/riskAgent';
import { tableAgent } from './agents/tableAgent';
import { explainAgent } from './agents/explainAgent';
import type { ChatMessage } from './ai';

export async function pipeline(question: string, connectionString: string, chatHistory: ChatMessage[]) {
    const schema = await initializeSchema(connectionString); // cached after first call  
    const sql = await sqlAgent(question, schema.details, chatHistory);
    const explanation = await explainAgent(sql, chatHistory, connectionString, question);


    if(sql){
        const risk = await riskAgent(sql);
        const result = await tableAgent(sql, connectionString, )
        
        return { sql, result, explanation, risk };
    }
   
    return { sql, undefined, explanation, null:null };
}