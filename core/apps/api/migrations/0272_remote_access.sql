CREATE TABLE remote_access_requests (
  id UUID PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  user_name VARCHAR(200) NOT NULL,
  device VARCHAR(80) NOT NULL,
  public_key VARCHAR(100) NOT NULL UNIQUE,
  fingerprint VARCHAR(80) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','active','rejected','revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_at TIMESTAMPTZ,
  removed_at TIMESTAMPTZ
);
CREATE INDEX remote_access_owner ON remote_access_requests(user_id, created_at DESC);
CREATE TABLE remote_access_events (
  id BIGSERIAL PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES remote_access_requests(id) ON DELETE CASCADE,
  actor_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  action VARCHAR(24) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE remote_access_host (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK(singleton),
  seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
