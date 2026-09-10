CREATE TABLE platform_competitions (
  event_id UUID PRIMARY KEY REFERENCES platform_events(id) ON DELETE RESTRICT,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  registration_opens_at TIMESTAMPTZ NOT NULL,
  registration_closes_at TIMESTAMPTZ NOT NULL,
  commission_bps INTEGER CHECK (commission_bps BETWEEN 0 AND 10000),
  settlement_days INTEGER CHECK (settlement_days BETWEEN 0 AND 3650),
  settlement_anchor TEXT CHECK (settlement_anchor IN ('ended','finalized')),
  refund_policy TEXT NOT NULL DEFAULT '',
  recording_policy TEXT NOT NULL DEFAULT '',
  submitted_at TIMESTAMPTZ,
  finalized_at TIMESTAMPTZ,
  CHECK (registration_closes_at > registration_opens_at)
);
ALTER TABLE platform_event_ticket_types ADD COLUMN competition_project TEXT CHECK (competition_project IN ('222','333','444','555'));
ALTER TABLE platform_event_ticket_types ADD COLUMN competition_device TEXT CHECK (competition_device IN ('ordinary','smart'));
ALTER TABLE platform_event_ticket_types ADD CONSTRAINT competition_ticket_device CHECK ((competition_project IS NULL) = (competition_device IS NULL) AND (competition_device <> 'smart' OR competition_project = '333'));
CREATE TABLE platform_competition_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES platform_competitions(event_id) ON DELETE RESTRICT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity BETWEEN 1 AND 1000),
  supervisor_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  assistance_requested BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(event_id,id),
  CHECK (ends_at > starts_at)
);
ALTER TABLE platform_event_registrations ADD COLUMN competition_session_id UUID;
ALTER TABLE platform_event_registrations ADD COLUMN competition_project TEXT;
ALTER TABLE platform_event_registrations ADD COLUMN checked_in_at TIMESTAMPTZ;
ALTER TABLE platform_event_registrations ADD COLUMN competition_video_generation UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE platform_payment_attempts ADD COLUMN checkout_payload JSONB;
ALTER TABLE platform_event_registrations ADD COLUMN competition_attempts JSONB;
ALTER TABLE platform_event_registrations ADD COLUMN result_recorded_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL;
ALTER TABLE platform_event_registrations ADD COLUMN result_recorded_at TIMESTAMPTZ;
ALTER TABLE platform_event_registrations ADD CONSTRAINT competition_registration_session_fk FOREIGN KEY(event_id,competition_session_id) REFERENCES platform_competition_sessions(event_id,id) ON DELETE RESTRICT;
ALTER TABLE platform_event_registrations ADD CONSTRAINT competition_registration_single CHECK ((competition_session_id IS NULL) = (competition_project IS NULL) AND (competition_session_id IS NULL OR quantity=1));
CREATE UNIQUE INDEX idx_competition_registration_active ON platform_event_registrations(event_id,user_id,competition_project) WHERE competition_project IS NOT NULL AND status IN ('reserved','confirmed','attended');
CREATE INDEX idx_competition_registration_session ON platform_event_registrations(competition_session_id,status);
CREATE TABLE platform_competition_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES platform_event_registrations(id) ON DELETE RESTRICT,
  user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 4000),
  resolution TEXT,
  original_attempts JSONB,
  corrected_attempts JSONB,
  resolved_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  CHECK ((resolved_at IS NULL) = (resolution IS NULL))
);
CREATE UNIQUE INDEX idx_competition_dispute_open ON platform_competition_disputes(registration_id) WHERE resolved_at IS NULL;
CREATE TABLE platform_competition_attempts (
  registration_id UUID NOT NULL REFERENCES platform_event_registrations(id) ON DELETE RESTRICT,
  attempt_number SMALLINT NOT NULL CHECK(attempt_number BETWEEN 1 AND 5),
  scramble TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  centiseconds INTEGER CHECK(centiseconds BETWEEN 1 AND 8640000),
  penalty TEXT CHECK(penalty IN ('none','+2','DNF','DNS')),
  recorded_at TIMESTAMPTZ,
  recorded_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  PRIMARY KEY(registration_id,attempt_number),
  CHECK ((recorded_at IS NULL) = (penalty IS NULL)),
  CHECK (penalty IS NULL OR ((penalty IN ('DNF','DNS')) = (centiseconds IS NULL)))
);
