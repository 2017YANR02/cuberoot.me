CREATE TABLE recon_intake (
  id UUID PRIMARY KEY,
  submission_hash TEXT NOT NULL UNIQUE,
  recording_hash TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  input JSONB NOT NULL,
  expected JSONB,
  status TEXT NOT NULL CHECK (status IN ('pending-test', 'needs-fix', 'needs-review', 'active')),
  created_by TEXT NOT NULL,
  approved_by TEXT,
  latest_run JSONB,
  lease_token UUID,
  claimed_by TEXT,
  lease_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_recon_intake_queue ON recon_intake (status, created_at);
CREATE TABLE recon_intake_runs (
  id UUID PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES recon_intake(id),
  revision INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  actor TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_recon_intake_runs ON recon_intake_runs(case_id, created_at DESC);
CREATE TABLE recon_intake_revisions (
  case_id UUID NOT NULL REFERENCES recon_intake(id),
  revision INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  input JSONB NOT NULL,
  expected JSONB,
  actor TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (case_id, revision)
);
