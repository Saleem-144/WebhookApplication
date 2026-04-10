import { query } from './src/db/index.js';

async function checkSchema() {
  try {
    console.log('--- dialpad_calls ---');
    const calls = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'dialpad_calls'
    `);
    console.table(calls.rows);

    console.log('--- dialpad_messages ---');
    const messages = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'dialpad_messages'
    `);
    console.table(messages.rows);

    console.log('--- contacts ---');
    const contacts = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'contacts'
    `);
    console.table(contacts.rows);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkSchema();
