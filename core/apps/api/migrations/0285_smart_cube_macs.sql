CREATE TABLE IF NOT EXISTS smart_cube_macs (
  user_id BIGINT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  items JSONB NOT NULL DEFAULT '{}'::jsonb
);
