import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';

/** What we store in the client cache for each connection string. */
interface CacheEntry {
  mcpClient: Client; // The active MCP client (wraps the child process)
  tools: Tool[]; // Anthropic-formatted tool definitions from the MCP server
}

/** Shape of content blocks returned by MCP tool calls (e.g. list_tables). */
interface MCPTextBlock {
  type?: string;
  text?: string;
}

/**
 * Store caches on globalThis so they survive Next.js hot-module reloading (HMR).
 * Without this, every HMR cycle recreates the Maps, orphaning MCP child
 * processes (and their open PG transactions), so COMMIT/ROLLBACK from a later
 * request hits a brand-new connection that has no open transaction.
 */
const globalForMcp = globalThis as typeof globalThis & {
  __mcpCache?: Map<string, CacheEntry>;
  __mcpSchemaCache?: Map<string, { tables: string[]; details: string }>;
  __mcpKnownTables?: Map<string, Set<string>>;
};

const cache = (globalForMcp.__mcpCache ??= new Map<string, CacheEntry>());
const schemaCache = (globalForMcp.__mcpSchemaCache ??= new Map<
  string,
  { tables: string[]; details: string }
>());
const knownTablesByConnection = (globalForMcp.__mcpKnownTables ??= new Map<
  string,
  Set<string>
>());

export async function getMCPClient(
  connectionString: string,
): Promise<CacheEntry> {
  const cached = cache.get(connectionString);
  if (cached) return cached;

  // Spawn the MCP Postgres server as a child process communicating over stdio
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['-y', 'mcp-postgres-full-access', connectionString],
    env: {
      ...process.env,
      TRANSACTION_TIMEOUT_MS: '60000', // Max time for a single transaction
      PG_STATEMENT_TIMEOUT_MS: '30000', // Max time for a single SQL statement
    },
  });
  // Create and connect the MCP client
  const mcpClient = new Client({ name: 'nl-to-sql', version: '1.0.0' });
  await mcpClient.connect(transport);

  // Fetch available tools from the MCP server and convert to Anthropic format
  const { tools: rawTools } = await mcpClient.listTools();
  const tools: Tool[] = rawTools.map((t) => ({
    name: t.name,
    description: t.description ?? '',
    input_schema: t.inputSchema as Tool['input_schema'],
  }));

  const entry: CacheEntry = { mcpClient, tools };
  cache.set(connectionString, entry);
  return entry;
}

export async function initializeSchema(connectionString: string) {
  // Check cache first
  const cached = schemaCache.get(connectionString);
  if (cached) {
    return cached;
  }

  const { mcpClient } = await getMCPClient(connectionString);

  // Step 1: Get the raw list of tables from the MCP server
  const result = await mcpClient.callTool({
    name: 'list_tables',
    arguments: {},
  });

  // Step 2: The MCP response is an array of content blocks; extract the text
  const blocks = result.content as MCPTextBlock[];
  const rawText = blocks
    .filter((b) => b?.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text!)
    .join('\n');

  // Step 3: Parse table names from the JSON text
  const tableNames = extractTableNames(rawText);
  knownTablesByConnection.set(
    connectionString,
    new Set(tableNames.map((t) => t.toLowerCase())),
  );

  // Step 4: Fetch detailed schema for up to 10 tables
  const details: string[] = [];
  for (const name of tableNames.slice(0, 10)) {
    try {
      const res = await mcpClient.callTool({
        name: 'describe_table_schema',
        arguments: { table_name: name },
      });
      const text = (res.content as MCPTextBlock[]).find(
        (c) => c.type === 'text',
      )?.text;
      if (text) details.push(`Table: ${name}\n${text}`);
    } catch {
      // Schema details are optional — the table still counts even if describe fails
    }
  }

  const schemaResult = { tables: tableNames, details: details.join('\n\n') };
  schemaCache.set(connectionString, schemaResult);
  return schemaResult;
}

function extractTableNames(raw: string): string[] {
  /** Check if a string looks like a valid SQL identifier. */
  const validName = (s: string) => /^[A-Za-z_]\w*$/.test(s);

  /** Strip the "public." schema prefix if present. */
  const clean = (s: string) => s.replace(/^public\./, '').trim();

  // Primary path: try to parse the whole thing as a JSON array
  try {
    const parsed = JSON.parse(raw) as Array<{ table_name?: string }>;
    if (Array.isArray(parsed)) {
      return parsed.map((r) => clean(r.table_name ?? '')).filter(validName);
    }
  } catch {
    // Not valid JSON — fall through to regex
  }

  // Fallback: use regex to extract "table_name": "xxx" pairs from malformed text
  return [...raw.matchAll(/"table_name"\s*:\s*"([A-Za-z_]\w*)"/g)]
    .map((m) => clean(m[1]))
    .filter(validName);
}
