CREATE TABLE IF NOT EXISTS recon_test_runs (
  id UUID PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL,
  uploaded_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS recon_test_runs_started ON recon_test_runs (started_at DESC);
