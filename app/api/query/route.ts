// app/api/query/route.ts
import { queryDatabaseStream, ChatMessage } from '../../lib/ai';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const { messages, connectionString } = await req.json();

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return new Response(
      JSON.stringify({ error: 'Messages array is required' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  if (!connectionString) {
    return new Response(
      JSON.stringify({ error: 'Connection string is required' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of queryDatabaseStream(
          messages as ChatMessage[],
          connectionString,
        )) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            `\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}`,
          ),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  });
}
