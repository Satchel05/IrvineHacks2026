// app/api/schema/route.ts
import { initializeSchema } from '../../lib/ai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { connectionString } = await req.json();

  if (!connectionString) {
    return NextResponse.json(
      { error: 'Connection string is required' },
      { status: 400 },
    );
  }

  try {
    const schema = await initializeSchema(connectionString);
    return NextResponse.json({ schema });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch schema' },
      { status: 500 },
    );
  }
}
