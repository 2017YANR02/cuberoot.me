-- Originals stay immutable; completed derivatives are ordinary Drive files.
CREATE TABLE IF NOT EXISTS drive_compressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_node_id UUID NOT NULL REFERENCES drive_nodes(id) ON DELETE CASCADE,
  requested_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  resolution TEXT NOT NULL CHECK (resolution IN ('original', '1080p')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'encoding', 'validating', 'ready', 'failed')),
  reserved_bytes BIGINT NOT NULL CHECK (reserved_bytes > 0),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  output_node_id UUID UNIQUE REFERENCES drive_nodes(id) ON DELETE SET NULL,
  error TEXT,
  report JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_node_id, resolution)
);
CREATE INDEX IF NOT EXISTS idx_drive_compressions_pending ON drive_compressions (created_at)
  WHERE status IN ('queued', 'encoding', 'validating');
