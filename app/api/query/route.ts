// app/api/query/route.ts
import { queryDatabase } from '../../lib/ai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { message, connectionString } = await req.json();

  if (!message) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  if (!connectionString) {
    return NextResponse.json(
      { error: 'Connection string is required' },
      { status: 400 },
    );
  }

  const result = await queryDatabase(message, connectionString);
  return NextResponse.json({ result });
}
