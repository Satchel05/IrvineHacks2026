/**
 * ai.ts — Server-side AI + MCP integration layer.
 *
 * This file handles:
 *  1. Spawning & caching MCP (Model Context Protocol) client connections to Postgres
 *  2. Streaming LLM queries through Anthropic's Claude with tool-use (MCP tools)
 *  3. Fetching database schema on first connection
 *
 * ARCHITECTURE:
 *  - Each unique connectionString gets ONE cached MCP child process (via StdioClientTransport).
 *  - The Anthropic SDK handles the chat loop: text streaming + tool calls.
 *  - Tool calls are forwarded to the MCP client which runs them against Postgres.
 *
 * HOW TO EDIT:
 *  - To change the LLM model, update the `model` field in `queryDatabaseStream`.
 *  - To change the system prompt, edit `SYSTEM_PROMPT`.
 *  - To add MCP connection options (SSL, timeouts), update the `env` in `getMCPClient`.
 *  - To change how schema is parsed, edit `extractTableNames`.
 *  - To add a new MCP tool call pattern, add logic in the tool-call loop inside `queryDatabaseStream`.
 */

import Anthropic from '@anthropic-ai/sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Tool, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Shape of messages passed between the frontend and this module. */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/** What we store in the client cache for each connection string. */
interface CacheEntry {
  mcpClient: Client;  // The active MCP client (wraps the child process)
  tools: Tool[];       // Anthropic-formatted tool definitions from the MCP server
}

/** Shape of content blocks returned by MCP tool calls (e.g. list_tables). */
interface MCPTextBlock {
  type?: string;
  text?: string;
}

// ─── Clients & Config ─────────────────────────────────────────────────────────

/** Singleton Anthropic SDK client. Uses ANTHROPIC_API_KEY from env. */
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Cache of MCP clients keyed by connection string.
 * Prevents spawning a new child process on every request.
 *
 * ⚠️  This cache lives in the Node.js server process memory.
 *     It resets on server restart (next dev / deploy).
 */
const cache = new Map<string, CacheEntry>();
const knownTablesByConnection = new Map<string, Set<string>>();

/** The system prompt sent to Claude on every query. Edit this to change the LLM's behavior. */
const SYSTEM_PROMPT =
  "You are a helpful assistant that translates natural language to SQL and queries a PostgreSQL database. Always show the SQL you're running and return results in a clear format.";

/** Extra instruction when strict output is OFF (conversational mode). */
const CONVERSATIONAL_PROMPT_SUFFIX =
  'If the user is making small talk or asking a general conversational question, reply naturally in plain text and do not use JSON output formatting.';

/**
 * Strict structured output schema for DB/task responses.
 *
 * This is intentionally conservative (all primitive string fields) to avoid
 * Anthropic JSON-schema validation pitfalls.
 */
const STRICT_OUTPUT_CONFIG = {
  format: {
    type: 'json_schema',
    schema: {
      type: 'object',
      properties: {
        sql: { type: 'string' },
        explanation: { type: 'string' },
        result: {
          type: 'string',
          description: 'JSON-stringified query result payload of table data.',
        },
        confirmation: {
          type: 'string',
          description:
            'Confirmation message for the user with number of rows returned or affected describing what they\'d need to know to proceed. Do not include the raw SQL or result data in this field.',
        },
      },
      required: ['sql', 'explanation', 'result', 'confirmation'],
      additionalProperties: false,
    },
  },
} as const;

/**
 * Decide whether strict structured output should be enforced for this turn.
 *
 * Heuristic:
 *  - Enable for likely DB/task prompts (query, select, rows, schema, etc.)
 *  - Disable for small talk / conversational prompts
 */
function shouldUseStrictOutput(
  chatHistory: ChatMessage[],
  knownTables?: Set<string>,
): boolean {
  const lastUser = (() => {
    for (let i = chatHistory.length - 1; i >= 0; i -= 1) {
      const m = chatHistory[i];
      if (m.role === 'user' && typeof m.content === 'string') {
        return m.content.trim();
      }
    }
    return '';
  })();

  if (!lastUser) return false;

  // Strong override for greeting/small-talk turns.
  // If this matches, we never enforce strict output for the turn.
  const conversationalOnly =
    /^(hi|hello|hey|yo|sup|howdy|good\s+(morning|afternoon|evening)|how are you|what'?s up|thanks|thank you|cool|nice|ok|okay)[!.?\s]*$/i;
  if (conversationalOnly.test(lastUser)) return false;

  // If the user mentions a known table name (including naive plural with 's'),
  // force strict mode regardless of other heuristics.
  // Example: "providers please", "give me 5 quotas" both match table names.
  if (knownTables?.size) {
    const tokens = lastUser
      .toLowerCase()
      .replace(/[^a-z0-9_\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
    for (const token of tokens) {
      // Exact match OR strip trailing 's'/'es' to handle common plurals
      const singular = token.replace(/(?:es|s)$/, '');
      if (knownTables.has(token) || knownTables.has(singular)) return true;
    }
  }

  const taskLike =
    /\b(sql|query|select|insert|update|delete|table|tables|rows|column|columns|schema|database|db|count|join|where|group\s+by|order\s+by|limit|show|list|find|get|give|fetch|pull|retrieve|return|display|how\s+many|what\s+is|what\s+are|tell\s+me)\b/i;
  const conversational =
    /\b(hi|hello|hey|how are you|thanks|thank you|good morning|good evening|who are you|what can you do|help me understand)\b/i;

  return taskLike.test(lastUser) && !conversational.test(lastUser);
}

/**
 * Get (or create) an MCP client for the given Postgres connection string.
 *
 * On first call for a connection string:
 *   1. Spawns `npx mcp-postgres-full-access <connectionString>` as a child process
 *   2. Connects an MCP Client to the child process via stdio
 *   3. Fetches the list of available tools (list_tables, query, etc.)
 *   4. Converts tools to Anthropic's Tool format and caches everything
 *
 * Subsequent calls for the same connection string return the cached entry.
 */
async function getMCPClient(connectionString: string): Promise<CacheEntry> {
  const cached = cache.get(connectionString);
  if (cached) return cached;

  // Spawn the MCP Postgres server as a child process communicating over stdio
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['-y', 'mcp-postgres-full-access', connectionString],
    env: {
      ...process.env,
      TRANSACTION_TIMEOUT_MS: '60000',   // Max time for a single transaction
      PG_STATEMENT_TIMEOUT_MS: '30000',  // Max time for a single SQL statement
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

// ─── Streaming query ──────────────────────────────────────────────────────────

/**
 * Stream an LLM response for the given chat history + connection.
 *
 * This is an async generator that yields text chunks as they arrive.
 * It handles the full Anthropic tool-use loop:
 *   1. Send messages to Claude → stream text back to the caller
 *   2. If Claude requests tool calls, execute them via MCP
 *   3. Feed tool results back to Claude and continue streaming
 *   4. Repeat until Claude sends `end_turn` (no more tool calls)
 *
 * The caller (API route) pipes these yielded strings into a ReadableStream.
 */
export async function* queryDatabaseStream(
  chatHistory: ChatMessage[],
  connectionString: string,
): AsyncGenerator<string> {
  const { mcpClient, tools } = await getMCPClient(connectionString);
  const useStrictOutput = shouldUseStrictOutput(
    chatHistory,
    knownTablesByConnection.get(connectionString),
  );
  const systemPrompt = useStrictOutput
    ? SYSTEM_PROMPT
    : `${SYSTEM_PROMPT} ${CONVERSATIONAL_PROMPT_SUFFIX}`;

  // Convert our ChatMessage[] to Anthropic's MessageParam[] (strip 'system' role)
  const messages: Anthropic.MessageParam[] = chatHistory
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  // Tool-use loop: keeps going until Claude says "end_turn"
  while (true) {
    // Start a streaming request to Claude
    const stream = anthropic.messages.stream({
      model: 'claude-haiku-4-5',
      max_tokens: 4096,
      tools,
      system: systemPrompt,
      messages,
      ...(useStrictOutput ? { output_config: STRICT_OUTPUT_CONFIG } : {}),
    });

    // Yield text chunks as they arrive from the stream
    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text;
      }
    }

    // Get the complete final message (includes all content blocks)
    const final = await stream.finalMessage();
    messages.push({ role: 'assistant', content: final.content });

    // If Claude ended its turn naturally (no tool calls), we're done
    if (final.stop_reason === 'end_turn') return;

    // Otherwise, Claude requested tool calls — execute them via MCP
    const toolBlocks = final.content.filter(
      (b): b is ToolUseBlock => b.type === 'tool_use',
    );

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolBlocks) {
      // Show the user which tool is being called
      yield `\n\n🔧 *Executing tool: ${block.name}...*\n\n`;

      // Forward the tool call to the MCP Postgres server
      const result = await mcpClient.callTool({
        name: block.name,
        arguments: block.input as Record<string, unknown>,
      });

      // Package the result for Claude's next turn
      results.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(result.content),
      });
    }

    // Feed tool results back as a "user" message (Anthropic's convention)
    messages.push({ role: 'user', content: results });
    // Loop continues — Claude will process the tool results and respond
  }
}

/**
 * Non-streaming convenience wrapper. Collects all chunks into a single string.
 * Useful for testing or one-shot calls where you don't need streaming.
 */
export async function queryDatabase(
  chatHistory: ChatMessage[],
  connectionString: string,
): Promise<string> {
  let result = '';
  for await (const chunk of queryDatabaseStream(chatHistory, connectionString)) {
    result += chunk;
  }
  return result;
}

// ─── Schema initialization ────────────────────────────────────────────────────

/**
 * Fetch the database schema for a connection. Called once when a tab first connects.
 *
 * Steps:
 *   1. Call MCP's `list_tables` tool to get all table names
 *   2. Parse the JSON response to extract table names
 *   3. For up to 10 tables, call `describe_table_schema` to get column details
 *   4. Return { tables: string[], details: string }
 *
 * The `tables` array is used in the UI to show "Found N tables: x, y, z".
 * The `details` string is the raw schema text (not currently shown to the user,
 * but available for future use like passing to the LLM as context).
 */
export async function initializeSchema(connectionString: string) {
  const { mcpClient } = await getMCPClient(connectionString);

  // Step 1: Get the raw list of tables from the MCP server
  const result = await mcpClient.callTool({ name: 'list_tables', arguments: {} });

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
      const text = (res.content as MCPTextBlock[]).find((c) => c.type === 'text')?.text;
      if (text) details.push(`Table: ${name}\n${text}`);
    } catch {
      // Schema details are optional — the table still counts even if describe fails
    }
  }

  return { tables: tableNames, details: details.join('\n\n') };
}

/**
 * Parse table names from the raw text response of MCP's `list_tables` tool.
 *
 * The MCP server returns JSON like: [{"table_name": "users", ...}, ...]
 * We try JSON.parse first, then fall back to regex if the text isn't valid JSON.
 *
 * Each name is cleaned (strip "public." prefix) and validated against a simple
 * identifier regex to filter out garbage.
 */
function extractTableNames(raw: string): string[] {
  /** Check if a string looks like a valid SQL identifier. */
  const validName = (s: string) => /^[A-Za-z_]\w*$/.test(s);

  /** Strip the "public." schema prefix if present. */
  const clean = (s: string) => s.replace(/^public\./, '').trim();

  // Primary path: try to parse the whole thing as a JSON array
  try {
    const parsed = JSON.parse(raw) as Array<{ table_name?: string }>;
    if (Array.isArray(parsed)) {
      return parsed
        .map((r) => clean(r.table_name ?? ''))
        .filter(validName);
    }
  } catch {
    // Not valid JSON — fall through to regex
  }

  // Fallback: use regex to extract "table_name": "xxx" pairs from malformed text
  return [...raw.matchAll(/"table_name"\s*:\s*"([A-Za-z_]\w*)"/g)]
    .map((m) => clean(m[1]))
    .filter(validName);
}
