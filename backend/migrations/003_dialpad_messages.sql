-- Raw Dialpad SMS / message events keyed by Dialpad's own id (dedup + upsert target).

CREATE TABLE IF NOT EXISTS dialpad_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dialpad_id TEXT NOT NULL UNIQUE,
  call_id TEXT,
  contact_id TEXT,
  direction TEXT,
  body TEXT,
  status TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dialpad_messages_contact_id ON dialpad_messages (contact_id);
CREATE INDEX IF NOT EXISTS idx_dialpad_messages_updated_at ON dialpad_messages (updated_at DESC);
