import { NextRequest } from 'next/server';
import { pipeline } from '@/app/lib/pipeline';
import type { ChatMessage } from '@/app/lib/utils/types';

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  const { messages, connectionString } = await req.json();

  if (!Array.isArray(messages) || messages.length === 0)
    return jsonError('Messages array is required');
  if (!connectionString) return jsonError('Connection string is required');

  // Extract the latest user message as the question for the pipeline
  const question = [...messages].reverse().find((m: ChatMessage) => m.role === 'user')?.content ?? '';

  try {
    const pipelineResult = await pipeline(question, connectionString, messages as ChatMessage[]);

    const riskLevel = pipelineResult.risk?.risk ?? 0;
    const needsConfirmation = riskLevel >= 1;

    // Map to StructuredResponse shape expected by AssistantMessage / extractStructured
    const structured = {
      sql: pipelineResult.sql ?? '',
      explanation: pipelineResult.explanation,
      result: pipelineResult.results?.result ?? '',
      rowCount: pipelineResult.risk?.rowEstimate ?? null,
      confirmation: needsConfirmation
        ? `This operation has risk level ${riskLevel} and will affect approximately ${pipelineResult.risk?.rowEstimate ?? '?'} rows. Please confirm to proceed.`
        : '',
      confirmation_required: needsConfirmation,
      user_confirmed: false,
      risk: riskLevel,
    };

    return Response.json(structured);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return jsonError(msg, 500);
  }
}
