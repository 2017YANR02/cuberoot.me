-- Durable per-actor write-attempt windows. This table is deliberately updated
-- outside the business transaction so rejected and rolled-back attempts count.
CREATE TABLE teaching_mutation_rate_limits (
  actor_user_id    BIGINT       NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  operation        VARCHAR(100) NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempts         INTEGER      NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (actor_user_id, operation),
  CHECK (length(trim(operation)) > 0)
);

CREATE INDEX idx_teaching_mutation_rate_limits_updated
  ON teaching_mutation_rate_limits(updated_at);
