CREATE TABLE IF NOT EXISTS dev_preview_requests (
  id UUID PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  owner_slug TEXT NOT NULL,
  device_slug TEXT NOT NULL,
  os TEXT NOT NULL CHECK(os IN ('mac','windows')),
  ticket_hash TEXT NOT NULL UNIQUE,
  public_key TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'preparing' CHECK(status IN ('preparing','pending','approved','provisioning','ready','failed','rejected')),
  profile JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  UNIQUE(owner_slug,device_slug)
);
CREATE TABLE IF NOT EXISTS dev_preview_events (
  id BIGSERIAL PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES dev_preview_requests(id) ON DELETE CASCADE,
  actor_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
