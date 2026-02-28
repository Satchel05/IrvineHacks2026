// app/api/query/route.ts
import { queryDatabase } from '../../lib/ai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { message } = await req.json();

  if (!message) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  const result = await queryDatabase(message);
  return NextResponse.json({ result });
}
