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

export async function* queryDatabaseStream(
  chatHistory: ChatMessage[],
  connectionString: string,
): AsyncGenerator<string, void, unknown> {
  const { mcpClient, anthropicTools } = await getMCPClient(connectionString);

  // Convert chat history to Anthropic message format
  const messages: any[] = chatHistory
    .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
    .map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

  while (true) {
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      tools: anthropicTools,
      system:
        "You are a helpful assistant that translates natural language to SQL and queries a PostgreSQL database. Always show the SQL you're running and return results in a clear format.",
      messages,
    });

    let fullContent: any[] = [];
    let currentText = '';

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        const delta = event.delta as any;
        if (delta.type === 'text_delta') {
          currentText += delta.text;
          yield delta.text;
        }
      } else if (event.type === 'content_block_start') {
        const block = event.content_block as any;
        if (block.type === 'tool_use') {
          fullContent.push({ ...block, input: '' });
        } else if (block.type === 'text') {
          fullContent.push({ type: 'text', text: '' });
        }
      } else if (event.type === 'content_block_stop') {
        // Update the last content block with accumulated text
        if (fullContent.length > 0) {
          const lastBlock = fullContent[fullContent.length - 1];
          if (lastBlock.type === 'text') {
            lastBlock.text = currentText;
          }
        }
      }
    }

    const finalMessage = await stream.finalMessage();
    fullContent = finalMessage.content;
    messages.push({ role: 'assistant', content: fullContent });

    if (finalMessage.stop_reason === 'end_turn') {
      return;
    }

    // Handle tool calls
    const toolResults = [];
    for (const block of fullContent) {
      if (block.type === 'tool_use') {
        yield `\n\n🔧 *Executing tool: ${block.name}...*\n\n`;
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

export async function queryDatabase(
  chatHistory: ChatMessage[],
  connectionString: string,
) {
  let result = '';
  for await (const chunk of queryDatabaseStream(
    chatHistory,
    connectionString,
  )) {
    result += chunk;
  }
  return result;
}

export async function initializeSchema(connectionString: string) {
  const { mcpClient } = await getMCPClient(connectionString);

  // Call the describe_table_schema tool to get the schema
  const result = await mcpClient.callTool({
    name: 'list_tables',
    arguments: {},
  });

  // Extract candidate table names from list_tables output
  const candidates = new Set<string>();

  const addCandidate = (value: string) => {
    const normalized = value.replace(/^public\./, '').trim();
    if (!normalized) return;
    if (!/^[A-Za-z_][A-Za-z0-9_$]*$/.test(normalized)) return;
    candidates.add(normalized);
  };

  const tablesContent = result.content as Array<{ type?: string; text?: string }>;
  const tablesText = tablesContent
    .filter((entry) => entry?.type === 'text' && typeof entry.text === 'string')
    .map((entry) => entry.text as string)
    .join('\n');

  try {
    const parsed = JSON.parse(tablesText) as Array<{ table_name?: string }>;
    if (Array.isArray(parsed)) {
      for (const row of parsed) {
        if (typeof row?.table_name === 'string') {
          addCandidate(row.table_name);
        }
      }
    }
  } catch {
    for (const match of tablesText.matchAll(
      /"table_name"\s*:\s*"([A-Za-z_][A-Za-z0-9_$]*)"/g,
    )) {
      if (match[1]) addCandidate(match[1]);
    }
  }

  // Use list_tables as source of truth for table names/count
  const tableNames = Array.from(candidates);
  const schemaDetails: string[] = [];

  for (const tableName of tableNames.slice(0, 10)) {
    try {
      const schemaResult = await mcpClient.callTool({
        name: 'describe_table_schema',
        arguments: { table_name: tableName },
      });
      const schemaContent = schemaResult.content as Array<{
        type: string;
        text: string;
      }>;
      const schemaText =
        schemaContent.find((c) => c.type === 'text')?.text || '';
      if (schemaText) {
        schemaDetails.push(`Table: ${tableName}\n${schemaText}`);
      }
    } catch {
      // Keep table in count even if schema details fail for this table
    }
  }

  return {
    tables: tableNames,
    details: schemaDetails.join('\n\n'),
  };
}
