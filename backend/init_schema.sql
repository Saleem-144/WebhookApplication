-- DIALPAD SUPER ADMIN DASHBOARD Database Schema

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'admin' CHECK (role IN ('superadmin', 'admin')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE offices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dialpad_id VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50),
    timezone VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dialpad_id VARCHAR(100) NOT NULL UNIQUE,
    office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_departments_office_id ON departments(office_id);

CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dialpad_id VARCHAR(100) NOT NULL UNIQUE,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    office_id UUID REFERENCES offices(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone_number VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_agents_department_id ON agents(department_id);
CREATE INDEX idx_agents_office_id ON agents(office_id);

CREATE TABLE agent_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL CHECK (status IN ('available', 'busy', 'dnd', 'offline')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_agent_status_agent_id ON agent_status(agent_id);

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dialpad_id VARCHAR(100) UNIQUE,
    phone_number VARCHAR(50) NOT NULL,
    name VARCHAR(255),
    email VARCHAR(255),
    company_name VARCHAR(255),
    job_title VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    first_contact_at TIMESTAMPTZ,
    last_contact_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_customers_phone ON customers(phone_number);

CREATE TABLE message_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_type VARCHAR(50) NOT NULL CHECK (thread_type IN ('customer', 'internal')),
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    agent_a_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    agent_b_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_threads_customer_id ON message_threads(customer_id);
CREATE INDEX idx_threads_department_id ON message_threads(department_id);
CREATE INDEX idx_threads_last_message ON message_threads(last_message_at DESC);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dialpad_id VARCHAR(100) UNIQUE,
    thread_id UUID NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
    sender_type VARCHAR(50) NOT NULL CHECK (sender_type IN ('agent', 'customer', 'system')),
    sender_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    sender_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound', 'outbound', 'internal')),
    delivery_status VARCHAR(50) DEFAULT 'delivered' CHECK (delivery_status IN ('sending', 'delivered', 'failed', 'undelivered')),
    is_internal BOOLEAN NOT NULL DEFAULT FALSE,
    sent_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_messages_thread_id ON messages(thread_id);
CREATE INDEX idx_messages_sent_at ON messages(sent_at DESC);
CREATE INDEX idx_messages_sender_agent ON messages(sender_agent_id);
CREATE INDEX idx_messages_sender_customer ON messages(sender_customer_id);

CREATE TABLE message_read_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    reader_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    read_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_read_log_unique ON message_read_log(message_id, reader_user_id);
CREATE INDEX idx_read_log_message_id ON message_read_log(message_id);
CREATE INDEX idx_read_log_user_id ON message_read_log(reader_user_id);

CREATE TABLE calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dialpad_call_id VARCHAR(100) NOT NULL UNIQUE,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    status VARCHAR(30) NOT NULL CHECK (status IN ('ringing', 'connected', 'ended', 'missed', 'voicemail')),
    started_at TIMESTAMPTZ,
    connected_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    recording_url TEXT,
    transcript_url TEXT,
    ai_summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_calls_agent_id ON calls(agent_id);
CREATE INDEX idx_calls_customer_id ON calls(customer_id);
CREATE INDEX idx_calls_started_at ON calls(started_at DESC);
CREATE INDEX idx_calls_status ON calls(status);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('sms_inbound', 'missed_call', 'voicemail', 'internal_message')),
    source_type VARCHAR(30) NOT NULL CHECK (source_type IN ('customer', 'agent')),
    source_id UUID,
    thread_id UUID REFERENCES message_threads(id) ON DELETE SET NULL,
    call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
    preview_text TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    dialpad_event_id VARCHAR(100),
    raw_payload JSONB NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    error_message TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);
CREATE INDEX idx_webhook_events_type ON webhook_events(event_type);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX idx_webhook_events_received ON webhook_events(received_at DESC);

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id UUID,
    details JSONB,
    performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_log_performed_by ON audit_log(performed_by);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_performed_at ON audit_log(performed_at DESC);
