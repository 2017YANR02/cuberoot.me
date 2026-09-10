ALTER TABLE organizations ADD COLUMN competition_organizer_approved_at TIMESTAMPTZ;

CREATE TABLE platform_organizer_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  organization_id UUID REFERENCES organizations(id) ON DELETE RESTRICT,
  name VARCHAR(160) NOT NULL CHECK (length(trim(name)) > 0),
  slug VARCHAR(64) NOT NULL CHECK (slug ~ '^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$'),
  contact VARCHAR(500) NOT NULL CHECK (length(trim(contact)) > 0),
  description VARCHAR(4000) NOT NULL CHECK (length(trim(description)) > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  review_note VARCHAR(4000),
  reviewed_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((status='pending' AND reviewed_at IS NULL) OR (status<>'pending' AND reviewed_at IS NOT NULL)),
  CHECK (status<>'approved' OR organization_id IS NOT NULL)
);
CREATE UNIQUE INDEX platform_organizer_one_pending_user ON platform_organizer_applications(applicant_user_id) WHERE status='pending';
CREATE UNIQUE INDEX platform_organizer_one_pending_org ON platform_organizer_applications(organization_id) WHERE status='pending' AND organization_id IS NOT NULL;
CREATE INDEX platform_organizer_review_queue ON platform_organizer_applications(status,created_at);
