-- Planned working time belongs to an account and is removed on account deletion.
CREATE TABLE workspace_work_calendars (
  user_id BIGINT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0)
);
CREATE TABLE workspace_work_periods (
  id UUID PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES workspace_work_calendars(user_id) ON DELETE CASCADE,
  effective_from DATE NOT NULL,
  effective_until DATE,
  tz TEXT NOT NULL,
  slots JSONB NOT NULL CHECK (jsonb_typeof(slots) = 'array'),
  UNIQUE (user_id, effective_from),
  CHECK (effective_until IS NULL OR effective_until > effective_from)
);
CREATE TABLE workspace_work_exceptions (
  period_id UUID NOT NULL REFERENCES workspace_work_periods(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  slots JSONB NOT NULL CHECK (jsonb_typeof(slots) = 'array'),
  PRIMARY KEY (period_id, work_date)
);
