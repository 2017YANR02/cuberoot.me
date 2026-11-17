CREATE TABLE IF NOT EXISTS workspace_announcement (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  lines JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(lines) = 'array'),
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  updated_at BIGINT NOT NULL DEFAULT 0
);
INSERT INTO workspace_announcement (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
