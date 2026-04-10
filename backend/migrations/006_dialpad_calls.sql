-- Call legs ingested from Dialpad call webhooks (connected, hangup, missed, call_transcription, etc.)

CREATE TABLE IF NOT EXISTS dialpad_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dialpad_call_id TEXT NOT NULL UNIQUE,
    state TEXT,
    direction TEXT,
    duration_ms DOUBLE PRECISION,
    total_duration_ms DOUBLE PRECISION,
    date_started BIGINT,
    date_connected BIGINT,
    date_ended BIGINT,
    date_rang BIGINT,
    event_timestamp BIGINT,
    external_number TEXT,
    external_e164 TEXT,
    internal_number TEXT,
    contact JSONB NOT NULL DEFAULT '{}',
    target JSONB NOT NULL DEFAULT '{}',
    contact_id_text TEXT,
    thread_key TEXT,
    transcription_text TEXT,
    recap_summary TEXT,
    raw_payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dialpad_calls_updated_at ON dialpad_calls (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_dialpad_calls_thread_key ON dialpad_calls (thread_key);
CREATE INDEX IF NOT EXISTS idx_dialpad_calls_external_e164 ON dialpad_calls (external_e164);
CREATE INDEX IF NOT EXISTS idx_dialpad_calls_state ON dialpad_calls (state);
