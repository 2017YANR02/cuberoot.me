-- Explicit source identity prevents collecting the same reconstruction twice.
-- Existing records remain unlinked; identical scrambles do not prove identity.
ALTER TABLE recon_intake ADD COLUMN source_recon_id INTEGER;
ALTER TABLE recon_intake ADD COLUMN source_snapshot JSONB;
CREATE UNIQUE INDEX idx_recon_intake_source_recon ON recon_intake (source_recon_id) WHERE source_recon_id IS NOT NULL;
