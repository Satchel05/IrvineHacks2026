import { NextRequest } from 'next/server';
import { approvePreview, rejectPreview } from '@/app/lib/agents/tableAgent';

export async function POST(req: NextRequest) {
  const { connectionString, action, transactionId } = await req.json();
  console.log(
    '[/api/confirm] action:',
    action,
    '| transactionId:',
    transactionId,
    '| connStr:',
    connectionString?.slice(0, 50),
  );

  if (!connectionString)
    return Response.json(
      { error: 'Connection string is required' },
      { status: 400 },
    );
  if (action !== 'approve' && action !== 'reject')
    return Response.json(
      { error: 'action must be "approve" or "reject"' },
      { status: 400 },
    );
  if (action === 'approve' && !transactionId) {
    console.error(
      '[/api/confirm] REJECTED: transactionId is missing for approve action',
    );
    return Response.json(
      { error: 'transactionId is required for approval' },
      { status: 400 },
    );
  }

  try {
    if (action === 'approve') {
      await approvePreview(connectionString, transactionId);
      console.log('[/api/confirm] Transaction committed successfully');
    } else {
      await rejectPreview(connectionString, transactionId);
      console.log('[/api/confirm] Transaction rolled back');
    }
    return Response.json({ ok: true, action });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[/api/confirm] Error:', msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
