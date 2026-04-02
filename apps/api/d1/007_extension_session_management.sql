CREATE TABLE IF NOT EXISTS extension_connection_attempts (
  id TEXT PRIMARY KEY,
  fingerprint_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_extension_connection_attempts_fingerprint_expires
ON extension_connection_attempts(fingerprint_hash, expires_at DESC);
