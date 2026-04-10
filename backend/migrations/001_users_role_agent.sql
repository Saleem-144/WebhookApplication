-- Run once on existing databases (pgAdmin / psql) after pulling this change.
-- Allows `agent` role on app users (Dialpad agents are separate `agents` table).

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('superadmin', 'admin', 'agent'));
