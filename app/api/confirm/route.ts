import { NextRequest } from 'next/server';
import { executeAndCommit, rejectPreview } from '@/app/lib/agents/tableAgent';

export async function POST(req: NextRequest) {
  const { connectionString, action, transactionId, sql } = await req.json();
  console.log(
    '[/api/confirm] action:',
    action,
    '| sql:',
    sql?.slice(0, 80),
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
  if (action === 'approve' && !sql) {
    return Response.json(
      { error: 'sql is required for approval' },
      { status: 400 },
    );
  }

  try {
    if (action === 'approve') {
      // Execute the write and immediately commit — no long-lived pending transaction
      await executeAndCommit(sql, connectionString);
      console.log('[/api/confirm] Write executed and committed');
    } else {
      // Reject: if there's a legacy transactionId still in flight, roll it back
      await rejectPreview(connectionString, transactionId);
      console.log('[/api/confirm] Operation rejected');
    }
    return Response.json({ ok: true, action });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[/api/confirm] Error:', msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
