import { NextRequest } from 'next/server';
import { approvePreview, rejectPreview } from '@/app/lib/agents/tableAgent';

export async function POST(req: NextRequest) {
  const { connectionString, action } = await req.json();

  if (!connectionString) return Response.json({ error: 'Connection string is required' }, { status: 400 });
  if (action !== 'approve' && action !== 'reject') return Response.json({ error: 'action must be "approve" or "reject"' }, { status: 400 });

  try {
    if (action === 'approve') {
      await approvePreview(connectionString);
    } else {
      await rejectPreview(connectionString);
    }
    return Response.json({ ok: true, action });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: msg }, { status: 500 });
  }
}
