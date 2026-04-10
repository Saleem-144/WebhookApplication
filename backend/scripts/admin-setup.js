import bcrypt from 'bcrypt';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const { Pool } = pg;

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;

const createAdmin = async () => {
  const email = (process.env.INITIAL_ADMIN_EMAIL || '').trim();
  const password = process.env.INITIAL_ADMIN_PASSWORD || '';
  const name = (process.env.INITIAL_ADMIN_NAME || 'Super Admin').trim() || 'Super Admin';
  const role = 'superadmin';

  if (!email) {
    console.error(
      'Missing INITIAL_ADMIN_EMAIL in backend/.env. Set it to the superadmin email, then run this script again.'
    );
    process.exit(1);
  }

  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    console.error(
      `Missing or weak INITIAL_ADMIN_PASSWORD in backend/.env. Use at least ${MIN_PASSWORD_LENGTH} characters.`
    );
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('Missing DATABASE_URL in backend/.env.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
    const hash = await bcrypt.hash(password, salt);

    const res = await pool.query(
      'INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING RETURNING id',
      [email, hash, name, role]
    );

    if (res.rows.length > 0) {
      console.log('Super Admin user created in the database.');
      console.log('Email:', email);
      console.log(
        'Sign in with that email and the password you set as INITIAL_ADMIN_PASSWORD (it is not shown here).'
      );
      console.log('Change the password after first login.');
    } else {
      console.log('A user with this email already exists. No changes were made.');
    }
  } catch (err) {
    console.error('Error creating admin user:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

createAdmin();
