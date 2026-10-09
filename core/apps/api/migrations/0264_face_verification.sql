-- Separate from WCA ownership and login credentials. No name, raw ID or biometrics.
CREATE TABLE account_face_attempts (
  id UUID PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  session_hash TEXT NOT NULL,
  identity_digest TEXT NOT NULL,
  id_last4 TEXT NOT NULL,
  scene_id TEXT NOT NULL,
  certify_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('initializing', 'pending', 'passed', 'failed', 'expired')),
  consent_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  checked_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ
);
CREATE INDEX account_face_attempts_user_created ON account_face_attempts(user_id, created_at DESC);
CREATE INDEX account_face_attempts_created ON account_face_attempts(created_at);
CREATE UNIQUE INDEX account_face_verified_identity ON account_face_attempts(identity_digest) WHERE status = 'passed';
CREATE UNIQUE INDEX account_face_verified_user ON account_face_attempts(user_id) WHERE status = 'passed';
