import { query } from './src/db/index.js';

async function checkMoreSchema() {
  try {
    console.log('--- agent_activity_logs ---');
    const logs = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'agent_activity_logs'
    `);
    console.table(logs.rows);

    console.log('--- users ---');
    const users = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `);
    console.table(users.rows);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkMoreSchema();
