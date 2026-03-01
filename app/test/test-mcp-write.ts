/**
 * Direct test: call MCP execute_dml_ddl_dcl_tcl and check if data persists.
 */
import { getMCPClient } from '../lib/mcp';

const CONN =
  'postgresql://neondb_owner:npg_f3N0vrgtYelE@ep-snowy-shadow-adcq04lw-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function main() {
  const { mcpClient, tools } = await getMCPClient(CONN);

  console.log('=== Available tools ===');
  for (const t of tools) {
    console.log(`  ${t.name}: ${t.description?.slice(0, 80)}`);
  }

  // Try 1: Simple INSERT via execute_dml_ddl_dcl_tcl
  console.log('\n=== Test 1: INSERT via execute_dml_ddl_dcl_tcl ===');
  const insertResult = await mcpClient.callTool({
    name: 'execute_dml_ddl_dcl_tcl',
    arguments: {
      sql: "INSERT INTO tags (category_id, tag_value) VALUES (1, 'MCPTest1') RETURNING *",
    },
  });
  console.log('Insert result:', JSON.stringify(insertResult, null, 2));

  // Check if it persisted by reading
  console.log('\n=== Verify with SELECT ===');
  const selectResult = await mcpClient.callTool({
    name: 'execute_query',
    arguments: { sql: "SELECT * FROM tags WHERE tag_value = 'MCPTest1'" },
  });
  console.log('Select result:', JSON.stringify(selectResult, null, 2));

  // Try 2: Explicit BEGIN + INSERT + COMMIT as 3 separate calls
  console.log('\n=== Test 2: Explicit BEGIN/INSERT/COMMIT ===');
  const beginRes = await mcpClient.callTool({
    name: 'execute_dml_ddl_dcl_tcl',
    arguments: { sql: 'BEGIN' },
  });
  console.log('BEGIN result:', JSON.stringify(beginRes, null, 2));

  const insert2Res = await mcpClient.callTool({
    name: 'execute_dml_ddl_dcl_tcl',
    arguments: {
      sql: "INSERT INTO tags (category_id, tag_value) VALUES (1, 'MCPTest2') RETURNING *",
    },
  });
  console.log('INSERT result:', JSON.stringify(insert2Res, null, 2));

  const commitRes = await mcpClient.callTool({
    name: 'execute_dml_ddl_dcl_tcl',
    arguments: { sql: 'COMMIT' },
  });
  console.log('COMMIT result:', JSON.stringify(commitRes, null, 2));

  // Verify
  console.log('\n=== Verify both ===');
  const select2 = await mcpClient.callTool({
    name: 'execute_query',
    arguments: {
      sql: "SELECT * FROM tags WHERE tag_value IN ('MCPTest1', 'MCPTest2')",
    },
  });
  console.log('Final select:', JSON.stringify(select2, null, 2));

  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
