-- Connectivity is worker-verified evidence, separate from infrastructure readiness.
ALTER TABLE dev_preview_requests ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE dev_preview_requests ADD COLUMN IF NOT EXISTS health_checked_at TIMESTAMPTZ;
