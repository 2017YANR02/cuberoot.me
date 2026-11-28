-- Contains only a random signed session identifier and its distinct competition reads.
CREATE TABLE competition_result_sessions (
  session_id uuid PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  reads jsonb NOT NULL,
  last_limited_at timestamptz,
  revoked boolean NOT NULL DEFAULT false
);
CREATE INDEX idx_competition_result_sessions_expires ON competition_result_sessions (expires_at);
