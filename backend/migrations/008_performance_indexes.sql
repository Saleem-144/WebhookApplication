-- Performance indexes for dialpad_messages and dialpad_calls.

-- dialpad_messages: composite for thread-scoped pagination (contact_id + updated_at)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dm_contact_updated
  ON dialpad_messages (contact_id, updated_at DESC);

-- dialpad_messages: direction for filtering inbound/outbound
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dm_direction
  ON dialpad_messages (direction);

-- dialpad_messages: from_number extraction for line-user filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dm_from_number
  ON dialpad_messages ((raw_payload->>'from_number'));

-- dialpad_calls: composite for thread-scoped pagination
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dc_thread_updated
  ON dialpad_calls (thread_key, updated_at DESC);

-- dialpad_calls: external_e164 + updated for peer lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dc_ext_e164_updated
  ON dialpad_calls (external_e164, updated_at DESC);

-- dialpad_calls: direction for filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dc_direction
  ON dialpad_calls (direction);
