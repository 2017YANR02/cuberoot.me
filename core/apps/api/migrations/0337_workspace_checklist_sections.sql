-- Explicit sections; existing task text and completion states remain untouched.
ALTER TABLE workspace_checklists ADD COLUMN categories JSONB NOT NULL DEFAULT '[]'::jsonb
  CHECK (jsonb_typeof(categories) = 'array');
