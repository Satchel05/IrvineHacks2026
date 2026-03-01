// Utility to safely extract SQL from Anthropic content blocks
// Adapted from ai.ts logic
export function extractSqlFromContentBlocks(
  contentBlocks: any[],
): string | null {
  const block = contentBlocks.find(
    (b: any) => b?.type === 'text' && typeof b.text === 'string',
  );
  if (!block) return null;
  try {
    const parsed = JSON.parse(block.text);
    return typeof parsed.sql === 'string' ? parsed.sql : null;
  } catch {
    return null;
  }
}
