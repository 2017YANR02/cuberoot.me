CREATE TABLE mcp_oauth_grants (
  id UUID PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,
  code_hash CHAR(64) UNIQUE,
  code_challenge VARCHAR(43) NOT NULL,
  code_expires_at TIMESTAMPTZ NOT NULL,
  access_hash CHAR(64) UNIQUE,
  access_expires_at TIMESTAMPTZ,
  refresh_hash CHAR(64) UNIQUE,
  previous_refresh_hash CHAR(64),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);
CREATE INDEX mcp_oauth_grants_user ON mcp_oauth_grants(user_id);
