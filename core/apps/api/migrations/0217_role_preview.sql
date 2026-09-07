CREATE TABLE role_preview_profiles (
  actor_user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member', 'user')),
  user_id BIGINT NOT NULL UNIQUE REFERENCES app_users(id) ON DELETE CASCADE,
  PRIMARY KEY (actor_user_id, role)
);
CREATE TABLE role_preview_sessions (
  id UUID PRIMARY KEY,
  actor_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member', 'user', 'guest')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ
);
CREATE TABLE role_preview_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES role_preview_sessions(id),
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
