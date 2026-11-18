CREATE TABLE workspace_member_requests (
  user_id BIGINT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  id UUID NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX workspace_member_requests_pending ON workspace_member_requests(requested_at, id) WHERE status = 'pending';
