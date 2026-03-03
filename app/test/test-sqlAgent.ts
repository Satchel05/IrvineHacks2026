// test-sqlAgent.ts
import { sqlAgent } from '../lib/agents/sqlAgent';

async function test() {
  const schema = `
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      name TEXT,
      email TEXT
    );
  `;
  const question = 'Show all users';

  const result = await sqlAgent(question, schema, []);
  console.log('SQL:', result);
}

test();
