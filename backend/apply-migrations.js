import fs from 'fs';
import pg from 'pg';
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

async function migrate() {
  try {
    console.log('Applying migration 001: Role update...');
    await pool.query(`
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
      ALTER TABLE users
        ADD CONSTRAINT users_role_check
        CHECK (role IN ('superadmin', 'admin', 'agent'));
    `);

    console.log('Applying migration 002: Add avatar_url column...');
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(2048);
    `);

    console.log('Applying migration 003: dialpad_messages table...');
    const sql003Path = path.join(__dirname, 'migrations', '003_dialpad_messages.sql');
    const sql003 = fs.readFileSync(sql003Path, 'utf8');
    await pool.query(sql003);

    console.log('Applying migration 004: notifications.meta...');
    const sql004Path = path.join(__dirname, 'migrations', '004_notifications_meta.sql');
    const sql004 = fs.readFileSync(sql004Path, 'utf8');
    await pool.query(sql004);

    console.log('Applying migration 005: notifications.dismissed_from_popup_at...');
    const sql005Path = path.join(__dirname, 'migrations', '005_notifications_dismissed_popup.sql');
    const sql005 = fs.readFileSync(sql005Path, 'utf8');
    await pool.query(sql005);

    console.log('Applying migration 006: dialpad_calls table...');
    const sql006Path = path.join(__dirname, 'migrations', '006_dialpad_calls.sql');
    const sql006 = fs.readFileSync(sql006Path, 'utf8');
    await pool.query(sql006);

    console.log('Applying migration 007: supervision_logs tables...');
    const sql007Path = path.join(__dirname, 'migrations', '007_supervision_logs.sql');
    const sql007 = fs.readFileSync(sql007Path, 'utf8');
    await pool.query(sql007);

    console.log('Applying migration 008: performance indexes...');
    const sql008Path = path.join(__dirname, 'migrations', '008_performance_indexes.sql');
    const sql008 = fs.readFileSync(sql008Path, 'utf8');
    const stmts = sql008.split(/;\s*\n/).filter(s => s.trim());
    for (const stmt of stmts) {
      const clean = stmt.trim().replace(/CONCURRENTLY\s+/gi, '');
      if (clean) await pool.query(clean);
    }

    console.log('Migrations applied successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();
