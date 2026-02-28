import Anthropic from '@anthropic-ai/sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Cache clients by connection string
const clientCache = new Map<
  string,
  { mcpClient: Client; anthropicTools: any[] }
>();

async function getMCPClient(connectionString: string) {
  if (clientCache.has(connectionString)) {
    return clientCache.get(connectionString)!;
  }

  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['-y', 'mcp-postgres-full-access', connectionString],
    env: {
      ...process.env,
      TRANSACTION_TIMEOUT_MS: '60000',
      PG_STATEMENT_TIMEOUT_MS: '30000',
    },
  });

  const mcpClient = new Client({ name: 'nl-to-sql', version: '1.0.0' });
  await mcpClient.connect(transport);

  const { tools } = await mcpClient.listTools();
  const anthropicTools = tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  }));

  clientCache.set(connectionString, { mcpClient, anthropicTools });
  return { mcpClient, anthropicTools };
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function queryDatabase(
  chatHistory: ChatMessage[],
  connectionString: string,
) {
  const { mcpClient, anthropicTools } = await getMCPClient(connectionString);

  // Convert chat history to Anthropic message format
  // Filter out 'system' messages as Anthropic handles system prompt separately
  const messages: any[] = chatHistory
    .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
    .map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

  while (true) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      tools: anthropicTools,
      system:
        "You are a helpful assistant that translates natural language to SQL and queries a PostgreSQL database. Always show the SQL you're running and return results in a clear format.",
      messages,
    });

    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason === 'end_turn') {
      return response.content.find((b: any) => b.type === 'text')?.text;
    }

    const toolResults = [];
    for (const block of response.content) {
      if (block.type === 'tool_use') {
        const result = await mcpClient.callTool({
          name: block.name,
          arguments: block.input,
        });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result.content),
        });
      }
    }

    messages.push({ role: 'user', content: toolResults });
  }
}

export async function initializeSchema(connectionString: string) {
  const { mcpClient } = await getMCPClient(connectionString);

  // Call the describe_table_schema tool to get the schema
  const result = await mcpClient.callTool({
    name: 'list_tables',
    arguments: {},
  });

  // Parse the tables list
  const tablesContent = result.content as Array<{ type: string; text: string }>;
  const tablesText = tablesContent.find((c) => c.type === 'text')?.text || '';
  
  // Get detailed schema for each table
  const tableNames = tablesText
    .split('\n')
    .filter((line: string) => line.trim() && !line.includes('Tables in'))
    .map((line: string) => line.replace(/^[\s-]*/, '').trim())
    .filter(Boolean);

  const schemaDetails: string[] = [];
  
  for (const tableName of tableNames.slice(0, 10)) { // Limit to first 10 tables
    try {
      const schemaResult = await mcpClient.callTool({
        name: 'describe_table_schema',
        arguments: { table_name: tableName },
      });
      const schemaContent = schemaResult.content as Array<{ type: string; text: string }>;
      const schemaText = schemaContent.find((c) => c.type === 'text')?.text || '';
      schemaDetails.push(`Table: ${tableName}\n${schemaText}`);
    } catch {
      // Skip tables that can't be described
    }
  }

  return {
    tables: tableNames,
    details: schemaDetails.join('\n\n'),
  };
}
