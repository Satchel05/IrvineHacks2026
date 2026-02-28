// app/api/query/route.ts
import { queryDatabase, ChatMessage } from '../../lib/ai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { messages, connectionString } = await req.json();

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
  }

  if (!connectionString) {
    return NextResponse.json(
      { error: 'Connection string is required' },
      { status: 400 },
    );
  }

  const result = await queryDatabase(messages as ChatMessage[], connectionString);
  return NextResponse.json({ result });
}
