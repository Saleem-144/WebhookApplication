-- Activity logs for agents
CREATE TABLE IF NOT EXISTS agent_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  action_type TEXT NOT NULL, -- 'login', 'message_sent', 'message_seen', 'call_started'
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Specific tracking for who has seen which Dialpad message
CREATE TABLE IF NOT EXISTS message_seen_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_dialpad_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_dialpad_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_activity_logs_user_id ON agent_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_activity_logs_type ON agent_activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_message_seen_logs_msg_id ON message_seen_logs(message_dialpad_id);
