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

export async function queryDatabase(
  userMessage: string,
  connectionString: string,
) {
  const { mcpClient, anthropicTools } = await getMCPClient(connectionString);

  const messages: any[] = [{ role: 'user', content: userMessage }];

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
