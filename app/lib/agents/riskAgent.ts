import Anthropic from '@anthropic-ai/sdk';
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const RISK_DESCRIPTION = `
Integer risk level of the SQL statement.

Classify strictly using the highest applicable rule below. Do NOT infer intent. Do NOT average risk. If multiple statements exist, assign the highest applicable risk level.

0 = Low (Read-only, safe)
- SELECT statements only
- No data modification
- No locking or side effects
- Safe to auto-approve

1 = Moderate (Scoped write, controlled impact)
- INSERT
- UPDATE with a WHERE clause restricting affected rows
- Changes are targeted and predictable
- Requires approval prompt before execution

2 = High (Broad or potentially destructive write)
- UPDATE without a WHERE clause
- DELETE (with or without WHERE)
- Any write that could affect many or all rows
- Must show row-count estimate and require explicit confirmation

3 = Extreme (Schema or irreversible destructive change)
- DROP, TRUNCATE
- Any DDL statement (ALTER, CREATE, RENAME, etc.)
- Permission or role changes
- Blocked at database role level

Always choose the highest matching category.
`;

const ROW_ESTIMATE_DESCRIPTION =
  'Number of rows returned (SELECT) or affected (INSERT/UPDATE/DELETE).';

interface RiskAgentResult {
  risk: number;
  rowEstimate: number;
}

// Step 2 in pipeline: NL to SQL
export async function riskAgent(
  tentativeSql: string,
): Promise<RiskAgentResult> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: `You are a SQL risk assessor. Analyze the SQL query and return a risk assessment and row estimate.`,
    messages: [
      { role: 'user', content: `Assess this SQL query:\n${tentativeSql}` },
    ],
    output_config: {
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            risk: {
              type: 'integer',
              description: RISK_DESCRIPTION,
            },
            rowEstimate: {
              type: 'integer',
              description: ROW_ESTIMATE_DESCRIPTION,
            },
          },
          required: ['risk', 'rowEstimate'],
          additionalProperties: false,
        },
      },
    },
  });

  const text = response.content[0]?.text;
  if (!text) throw new Error('riskAgent: empty response from model');

  try {
    return JSON.parse(text) as RiskAgentResult;
  } catch {
    throw new Error(`riskAgent: failed to parse response — ${text}`);
  }
}
