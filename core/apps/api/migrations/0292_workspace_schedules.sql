-- Reusable team schedules. A schedule belongs to one fixed access scope.
CREATE TABLE workspace_schedules (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES workspace_projects(id),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  tasks JSONB NOT NULL CHECK (jsonb_typeof(tasks) = 'array'),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX workspace_schedules_project ON workspace_schedules(project_id);
