CREATE TABLE platform_competition_device_reports (
  registration_id UUID NOT NULL,
  attempt_number SMALLINT NOT NULL,
  run_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  report JSONB CHECK (jsonb_typeof(report) = 'object'),
  reported_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  reported_at TIMESTAMPTZ,
  CHECK ((report IS NULL) = (reported_at IS NULL)),
  PRIMARY KEY (registration_id, attempt_number),
  FOREIGN KEY (registration_id, attempt_number) REFERENCES platform_competition_attempts(registration_id, attempt_number) ON DELETE RESTRICT
);
