import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const seedData = async () => {
  try {
    console.log('Seeding data...');

    // 1. Offices
    const officeRes = await pool.query(`
      INSERT INTO offices (dialpad_id, name, timezone) 
      VALUES 
        ('office_1', 'New York HQ', 'America/New_York'),
        ('office_2', 'San Francisco Branch', 'America/Los_Angeles')
      ON CONFLICT (dialpad_id) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, name
    `);
    const offices = officeRes.rows;
    console.log(`Seeded ${offices.length} offices.`);

    // 2. Departments
    const nyOfficeId = offices.find(o => o.name === 'New York HQ').id;
    const deptRes = await pool.query(`
      INSERT INTO departments (dialpad_id, office_id, name) 
      VALUES 
        ('dept_1', $1, 'Sales'),
        ('dept_2', $1, 'Support')
      ON CONFLICT (dialpad_id) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, name
    `, [nyOfficeId]);
    const depts = deptRes.rows;
    console.log(`Seeded ${depts.length} departments.`);

    // 3. Agents
    const salesDeptId = depts.find(d => d.name === 'Sales').id;
    const agentRes = await pool.query(`
      INSERT INTO agents (dialpad_id, department_id, office_id, name, email, phone_number) 
      VALUES 
        ('agent_1', $1, $2, 'John Smith', 'john@example.com', '+15550001111'),
        ('agent_2', $1, $2, 'Sarah Jenkins', 'sarah@example.com', '+15550002222')
      ON CONFLICT (dialpad_id) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, name
    `, [salesDeptId, nyOfficeId]);
    const agents = agentRes.rows;
    console.log(`Seeded ${agents.length} agents.`);

    // 4. Agent Status
    for (const agent of agents) {
      await pool.query(`
        INSERT INTO agent_status (agent_id, status) 
        VALUES ($1, 'available')
        ON CONFLICT (agent_id) DO UPDATE SET status = EXCLUDED.status
      `, [agent.id]);
    }
    console.log('Seeded agent statuses.');

    console.log('Database seeding completed successfully!');
  } catch (err) {
    console.error('Error seeding database:', err);
  } finally {
    await pool.end();
  }
};

seedData();
