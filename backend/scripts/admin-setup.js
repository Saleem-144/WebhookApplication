import bcrypt from 'bcrypt';
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

const createAdmin = async () => {
  const email = 'admin@example.com';
  const password = 'admin123'; // User should change this on first login
  const name = 'Super Admin';
  const role = 'superadmin';

  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const res = await pool.query(
      'INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING RETURNING id',
      [email, hash, name, role]
    );

    if (res.rows.length > 0) {
      console.log('Super Admin user created successfully!');
      console.log('Email:', email);
      console.log('Password:', password);
      console.log('IMPORTANT: Log in and change this password immediately.');
    } else {
      console.log('User with this email already exists.');
    }
  } catch (err) {
    console.error('Error creating admin user:', err);
  } finally {
    await pool.end();
  }
};

createAdmin();
