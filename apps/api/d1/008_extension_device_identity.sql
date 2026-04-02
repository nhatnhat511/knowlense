ALTER TABLE extension_sessions ADD COLUMN device_id TEXT;
ALTER TABLE extension_connection_requests ADD COLUMN device_id TEXT;

CREATE INDEX IF NOT EXISTS idx_extension_sessions_user_device ON extension_sessions(user_id, device_id);
