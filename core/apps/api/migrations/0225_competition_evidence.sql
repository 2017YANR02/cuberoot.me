CREATE TABLE platform_competition_evidence (
  id UUID PRIMARY KEY,
  registration_id UUID NOT NULL REFERENCES platform_event_registrations(id) ON DELETE RESTRICT,
  uploaded_by BIGINT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  mime TEXT NOT NULL CHECK (mime IN ('video/mp4','video/webm','video/quicktime')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes BETWEEN 1 AND 67108864),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days'
);
CREATE INDEX idx_competition_evidence_registration ON platform_competition_evidence(registration_id);
CREATE INDEX idx_competition_evidence_expiry ON platform_competition_evidence(expires_at);
