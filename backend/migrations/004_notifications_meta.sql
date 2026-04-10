-- Deep link + UI labels for in-app notifications (SMS thread keys, etc.)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}';
