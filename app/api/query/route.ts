/**
 * api/query/route.ts — Streaming LLM query endpoint.
 *
 * POST /api/query
 *   Body: { connectionString: string, messages: ChatMessage[] }
 *   Response: text/plain stream of LLM output chunks
 *
 * The frontend reads this stream with `res.body.getReader()` and pipes
 * chunks into the assistant message in real time (see `send()` in chat.tsx).
 *
 * HOW TO EDIT:
 *  - To add authentication, add a check before the validation block.
 *  - To change the streaming format (e.g. to SSE), update the ReadableStream
 *    and the Content-Type header.
 *  - To add rate limiting, wrap the handler or add middleware.
 */

import { NextRequest } from 'next/server';
import { queryDatabaseStream, type ChatMessage } from '@/app/lib/ai';

/** Helper to return a JSON error response with a given status code. */
function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  const { messages, connectionString } = await req.json();

  // ── Input validation ──────────────────────────────────────────────────
  if (!Array.isArray(messages) || messages.length === 0)
    return jsonError('Messages array is required');
  if (!connectionString)
    return jsonError('Connection string is required');

  const encoder = new TextEncoder();

  // ── Build a ReadableStream from the async generator ───────────────────
  // Each chunk from `queryDatabaseStream` is a string of LLM output text.
  // We encode it to bytes and enqueue it into the stream controller.
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of queryDatabaseStream(messages as ChatMessage[], connectionString)) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (err) {
        // If the LLM or MCP throws, send the error as text in the stream
        // (the frontend will display it as part of the assistant message)
        const msg = err instanceof Error ? err.message : 'Unknown error';
        controller.enqueue(encoder.encode(`\n\nError: ${msg}`));
      } finally {
        controller.close();
      }
    },
  });

  // Return the stream as plain text with chunked transfer encoding
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  });
}
