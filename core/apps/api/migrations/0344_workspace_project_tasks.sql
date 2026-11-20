CREATE TABLE workspace_project_tasks (
  id UUID PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  due_date DATE NOT NULL,
  criteria TEXT NOT NULL CHECK (length(criteria) BETWEEN 1 AND 3000),
  amount_cents INTEGER NOT NULL CHECK (amount_cents BETWEEN 1 AND 100000000),
  bonus_cents INTEGER NOT NULL CHECK (bonus_cents BETWEEN 0 AND 100000000),
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'in_progress', 'submitted', 'accepted')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  accepted_at TIMESTAMPTZ,
  CHECK ((status = 'accepted') = (accepted_at IS NOT NULL))
);
CREATE INDEX workspace_project_tasks_owner ON workspace_project_tasks(user_id);
