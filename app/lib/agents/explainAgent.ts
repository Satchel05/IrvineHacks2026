import Anthropic from '@anthropic-ai/sdk';
import {ChatMessage} from '@/app/lib/utils/types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const QUERY_EXPLANATION_DESCRIPTION = `
You are a SQL expert who understands the schema and can explain SQL queries.
Return a detailed explanation of the SQL query, including:
- Purpose of the query
- Key operations performed (SELECT, INSERT, UPDATE, DELETE)
- Tables and columns involved
- Any conditions or filters applied
- Expected results or effects

The explanation should be clear and concise, suitable for someone with basic SQL knowledge.
`;

const NO_QUERY_EXPLANATION_DESCRIPTION = `
You are a SQL expert who understands the schema and can explain SQL queries.
Read through the chat history and provide detailed answers to the user's questions about the database schema and SQL queries, or any friendly conversation they may have. If the user asks a question that cannot be answered with SQL, provide a clear and concise explanation or guidance based on your expertise.
The explanation should be clear and concise, suitable for someone with basic to no SQL knowledge.
`;



// Step 2 in pipeline: NL to SQL
export async function explainAgent(
  tentativeSql: string,
  chatHistory: ChatMessage[],
): Promise<string> {
    if(!tentativeSql) {
        const messages: Anthropic.MessageParam[] = chatHistory
            .filter((m) => m.role !== 'system')
            .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 1024,
            system: NO_QUERY_EXPLANATION_DESCRIPTION,
            messages,
            output_config: {
                format: {
                    type: 'json_schema',
                    schema: {
                        type: 'object',
                        properties: {
                            explanation: {
                                type: 'string',
                            },
                        },
                        required: ['explanation'],
                        additionalProperties: false,
                    },
                },
            },
        });

    const block = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    const text = block?.text;
    if (!text) throw new Error('explainAgent: empty response from model');
    return text;
    
    
    }else {
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 1024,
            system: QUERY_EXPLANATION_DESCRIPTION,
            messages: [
                { role: 'user', content: `Explain this SQL query:\n${tentativeSql}` },
            ],
            output_config: {
                format: {
                    type: 'json_schema',
                    schema: {
                        type: 'object',
                        properties: {
                            explanation: {
                                type: 'string',
                            },
                        },
                        required: ['explanation'],
                        additionalProperties: false,
                    },
                },
            },
        });
        const block = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
        const text = block?.text;
        if (!text) throw new Error('explainAgent: empty response from model');
        return text;
    }

    


}
