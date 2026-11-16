-- A single renewable lease serializes infrastructure changes across operator Macs.
CREATE TABLE dev_preview_worker (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  lease_hash TEXT,
  worker_name TEXT,
  expires_at TIMESTAMPTZ,
  checkpoint JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO dev_preview_worker(singleton) VALUES (TRUE);
