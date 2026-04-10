import pg from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, './.env') });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function reset() {
  const email = 'admin@dialpad.com';
  const password = 'Dev$#54784';
  const rounds = 12;

  try {
    const hash = await bcrypt.hash(password, rounds);
    const res = await pool.query(
      'UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING id',
      [hash, email]
    );

    if (res.rows.length > 0) {
      console.log(`Password reset for ${email} successfully.`);
    } else {
      console.log(`User ${email} not found.`);
    }
  } catch (err) {
    console.error('Error resetting password:', err);
  } finally {
    await pool.end();
  }
}

reset();
