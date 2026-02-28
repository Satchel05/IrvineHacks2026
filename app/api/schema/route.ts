/**
 * api/schema/route.ts — Database schema initialization endpoint.
 *
 * POST /api/schema
 *   Body: { connectionString: string }
 *   Response: { schema: { tables: string[], details: string } }
 *
 * Called once when a chat session first connects to a database.
 * The response is used by `chat.tsx` to display a "Schema learned!" message.
 *
 * HOW TO EDIT:
 *  - To cache schema results, add a Map keyed by connectionString.
 *  - To add authentication, add a check before the validation block.
 */

import { NextRequest } from 'next/server';
import { initializeSchema } from '@/app/lib/ai';

export async function POST(req: NextRequest) {
  const { connectionString } = await req.json();

  if (!connectionString)
    return Response.json({ error: 'Connection string is required' }, { status: 400 });

  try {
    // Calls MCP's list_tables + describe_table_schema (see ai.ts)
    const schema = await initializeSchema(connectionString);
    return Response.json({ schema });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch schema';
    return Response.json({ error: msg }, { status: 500 });
  }
}
