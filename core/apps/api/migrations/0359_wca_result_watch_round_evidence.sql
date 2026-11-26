-- Keep official standings before and after an import changes a watched placement.
CREATE TABLE wca_result_watch_round_revisions (
  id BIGSERIAL PRIMARY KEY,
  comp_id VARCHAR(50) NOT NULL,
  event_id VARCHAR(20) NOT NULL,
  round_type_id VARCHAR(4) NOT NULL,
  before_rows JSONB NOT NULL,
  after_rows JSONB NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX wca_result_watch_round_revisions_lookup
  ON wca_result_watch_round_revisions (comp_id, event_id, round_type_id, archived_at DESC);

ALTER TABLE wca_result_changes
  ADD COLUMN placement_reason JSONB,
  ADD COLUMN placement_reason_checked_at TIMESTAMPTZ;
