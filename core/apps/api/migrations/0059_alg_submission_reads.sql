-- Per-admin "last seen alg submissions" watermark, for the in-site new-submission
-- notification badge. Unread = submissions created after this admin's read_at.
CREATE TABLE IF NOT EXISTS alg_submission_reads (
  wca_id  TEXT PRIMARY KEY,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
