-- Shared company/project checklists; archived lists remain readable.
CREATE TABLE workspace_checklists (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES workspace_projects(id),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  category TEXT NOT NULL CHECK (length(category) BETWEEN 1 AND 60),
  items JSONB NOT NULL CHECK (jsonb_typeof(items) = 'array'),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX workspace_checklists_project ON workspace_checklists(project_id);
