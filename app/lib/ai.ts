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

import Anthropic from "@anthropic-ai/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Tool, ToolUseBlock } from "@anthropic-ai/sdk/resources/messages";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Shape of messages passed between the frontend and this module. */
export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

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
const SYSTEM_PROMPT = `You are a professional PostgreSQL translator that translates natural language to SQL and queries a PostgreSQL database.

RULES:
- Always show the SQL you're running and return results in a clear format.
- For SELECT queries: Execute and return the SQL along with the results.
- For INSERT/UPDATE/DELETE operations: Ask for confirmation BEFORE executing.
  - CRITICAL: When confirming an INSERT, you MUST include the exact row(s) that will be inserted in the result field as a JSON array. Show all column values that will be written.
  - For UPDATE/DELETE, show the affected rows or describe what will change.
- Always display affected rows in JSON format for any data manipulation.
- Be concise and clear in your explanations.
- When ENUM values are involved, show the possible values automatically.`;

/** Extra instruction when strict output is OFF (conversational mode). */
const CONVERSATIONAL_PROMPT_SUFFIX =
  "If the user is making small talk or asking a general conversational question, reply naturally in plain text and do not use JSON output formatting.";

/**
 * Strict structured output schema for DB/task responses.
 *
 * This is intentionally conservative (all primitive string fields) to avoid
 * Anthropic JSON-schema validation pitfalls.
 */
const STRICT_OUTPUT_CONFIG = {
  format: {
    type: "json_schema",
    schema: {
      type: "object",
      properties: {
        sql: { type: "string" },
        explanation: { type: "string" },
        result: {
          type: "string",
          description:
            'JSON-stringified result payload. For SELECT queries: the returned rows. For INSERT operations awaiting confirmation: a JSON array containing the exact row(s) that WILL BE inserted (e.g. [{"name": "John", "email": "john@example.com"}]). For UPDATE/DELETE: the rows that will be affected. CRITICAL: Never leave this empty for INSERT confirmations - always show the data that will be written.',
        },
        confirmation: {
          type: "string",
          description:
            "Confirmation message for the user with number of rows returned or affected describing what quite simply will change and what the user should expect. Do not include the raw SQL or data in this field.",
        },
        confirmation_required: {
          type: "boolean",
          description: `
Whether this operation requires user confirmation BEFORE execution.

Rules:
- TRUE only for Medium (1), High (2), or Critical (3) risk operations on first response.
- FALSE for Low (0) risk operations.
- Once the user explicitly confirms execution, this MUST be set to FALSE permanently for that operation.
- Never ask for confirmation more than once for the same operation.
- If user_confirmed is TRUE, this MUST be FALSE.
`,
        },
        user_confirmed: {
          type: "boolean",
          description: `
Indicates whether the user has explicitly approved execution.

Rules:
- Default value is ALWAYS FALSE.
- Set to TRUE only after the user clearly confirms execution (e.g., "yes", "confirm", "proceed").
- When TRUE, confirmation_required MUST be FALSE.
- Do NOT reset back to FALSE after confirmation.
- Do NOT request confirmation again once this is TRUE.
`,
        },
        risk: {
          type: "integer",
          description: `
Integer risk level of the SQL statement.

Classify strictly using the highest applicable rule below. Do NOT infer intent. Do NOT average risk. If multiple statements exist, assign the highest applicable risk level.

0 = Low (Read-only, safe)
- SELECT statements only
- No data modification
- No locking or side effects
- Safe to auto-approve

1 = Moderate (Scoped write, controlled impact)
- INSERT
- UPDATE with a WHERE clause restricting affected rows
- Changes are targeted and predictable
- Requires approval prompt before execution

2 = High (Broad or potentially destructive write)
- UPDATE without a WHERE clause
- DELETE (with or without WHERE)
- Any write that could affect many or all rows
- Must show row-count estimate and require explicit confirmation

3 = Extreme (Schema or irreversible destructive change)
- DROP, TRUNCATE
- Any DDL statement (ALTER, CREATE, RENAME, etc.)
- Permission or role changes
- Blocked at database role level

Always choose the highest matching category.
`,
        },
      },
      required: ["sql", "explanation", "result", "confirmation"],
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
      if (m.role === "user" && typeof m.content === "string") {
        return m.content.trim();
      }
    }
    return "";
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
      .replace(/[^a-z0-9_\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    for (const token of tokens) {
      // Exact match OR strip trailing 's'/'es' to handle common plurals
      const singular = token.replace(/(?:es|s)$/, "");
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
    command: "npx",
    args: ["-y", "mcp-postgres-full-access", connectionString],
    env: {
      ...process.env,
      TRANSACTION_TIMEOUT_MS: "60000", // Max time for a single transaction
      PG_STATEMENT_TIMEOUT_MS: "30000", // Max time for a single SQL statement
    },
  });

  // Create and connect the MCP client
  const mcpClient = new Client({ name: "nl-to-sql", version: "1.0.0" });
  await mcpClient.connect(transport);

  // Fetch available tools from the MCP server and convert to Anthropic format
  const { tools: rawTools } = await mcpClient.listTools();
  const tools: Tool[] = rawTools.map((t) => ({
    name: t.name,
    description: t.description ?? "",
    input_schema: t.inputSchema as Tool["input_schema"],
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
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  // Tool-use loop: keeps going until Claude says "end_turn"
  while (true) {
    // Start a streaming request to Claude
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      tools,
      system: systemPrompt,
      messages,
      output_config: STRICT_OUTPUT_CONFIG,
    });

    // Yield text chunks as they arrive from the stream
    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }

    // Get the complete final message (includes all content blocks)
    const final = await stream.finalMessage();
    messages.push({ role: "assistant", content: final.content });

    // If Claude ended its turn naturally (no tool calls), we're done
    if (final.stop_reason === "end_turn") return;

    // Otherwise, Claude requested tool calls — execute them via MCP
    const toolBlocks = final.content.filter(
      (b): b is ToolUseBlock => b.type === "tool_use",
    );

    const results: Anthropic.ToolResultBlockParam[] = [];

    for (const block of toolBlocks) {
      const toolInput = block.input as {
        confirmation_required?: boolean;
        user_confirmed?: boolean;
        confirmation?: string;
        sql?: string;
      };

      // If the tool requires confirmation but the user hasn't confirmed yet
      if (toolInput.confirmation_required && !toolInput.user_confirmed) {
        // Yield a confirmation prompt to the user
        yield `⚠️ *Confirmation required for ${block.name}:*\n${toolInput.confirmation || "Are you sure you want to execute this operation?"}\nPlease confirm to proceed.`;

        // Skip execution until the user responds with user_confirmed: true
        continue;
      }

      // Otherwise, execute the tool normally
      yield `\n\n🔧 *Executing tool: ${block.name}...*\n\n`;
      const result = await mcpClient.callTool({
        name: block.name,
        arguments: block.input as Record<string, unknown>,
      });

      results.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result.content),
      });
    }

    // Feed tool results back as a "user" message (Anthropic's convention)
    messages.push({ role: "user", content: results });
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
  let result = "";
  for await (const chunk of queryDatabaseStream(
    chatHistory,
    connectionString,
  )) {
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
  const result = await mcpClient.callTool({
    name: "list_tables",
    arguments: {},
  });

  // Step 2: The MCP response is an array of content blocks; extract the text
  const blocks = result.content as MCPTextBlock[];
  const rawText = blocks
    .filter((b) => b?.type === "text" && typeof b.text === "string")
    .map((b) => b.text!)
    .join("\n");

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
        name: "describe_table_schema",
        arguments: { table_name: name },
      });
      const text = (res.content as MCPTextBlock[]).find(
        (c) => c.type === "text",
      )?.text;
      if (text) details.push(`Table: ${name}\n${text}`);
    } catch {
      // Schema details are optional — the table still counts even if describe fails
    }
  }

  return { tables: tableNames, details: details.join("\n\n") };
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
  const clean = (s: string) => s.replace(/^public\./, "").trim();

  // Primary path: try to parse the whole thing as a JSON array
  try {
    const parsed = JSON.parse(raw) as Array<{ table_name?: string }>;
    if (Array.isArray(parsed)) {
      return parsed.map((r) => clean(r.table_name ?? "")).filter(validName);
    }
  } catch {
    // Not valid JSON — fall through to regex
  }

  // Fallback: use regex to extract "table_name": "xxx" pairs from malformed text
  return [...raw.matchAll(/"table_name"\s*:\s*"([A-Za-z_]\w*)"/g)]
    .map((m) => clean(m[1]))
    .filter(validName);
}
