-- Private video capture references. Drive owns the upload and the original bytes.
CREATE TABLE recon_captures (
  id UUID PRIMARY KEY,
  owner_user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  source_solve_id TEXT NOT NULL,
  drive_node_id UUID REFERENCES drive_nodes(id) ON DELETE SET NULL,
  submission_hash TEXT NOT NULL CHECK (submission_hash ~ '^[a-f0-9]{64}$'),
  recording_hash TEXT NOT NULL CHECK (recording_hash ~ '^[a-f0-9]{64}$'),
  input JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'needs-review')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  video_sha256 TEXT CHECK (video_sha256 ~ '^[a-f0-9]{64}$'),
  video_mime TEXT,
  video_duration_ms DOUBLE PRECISION,
  sync JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_user_id, submission_hash),
  CHECK (status = 'uploading' OR (video_sha256 IS NOT NULL AND video_mime IS NOT NULL))
);
CREATE INDEX idx_recon_captures_source ON recon_captures (owner_user_id, source_solve_id, created_at DESC);
CREATE INDEX idx_recon_captures_queue ON recon_captures (status, created_at, id);
CREATE INDEX idx_recon_captures_drive ON recon_captures (drive_node_id) WHERE drive_node_id IS NOT NULL;

-- Alignment changes retain the original inputs and prior human anchors.
CREATE TABLE recon_capture_revisions (
  capture_id UUID NOT NULL REFERENCES recon_captures(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  sync JSONB NOT NULL,
  actor_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (capture_id, revision)
);
