-- timer_backups: per-user single-snapshot cloud backup of the whole solo-timer DB.
-- One row per WCA user; `blob` is the verbatim exportJson() string (DbShapeV3 JSON,
-- all sessions + events) — the same payload a user can already download to a file.
-- Restore feeds it back to importJson() client-side (full replace). Mirrors the
-- timer_sessions per-user-blob pattern but keyed by wca_id alone (single snapshot).
-- No FK to wca_users: requireAuth does not guarantee a wca_users row, matching
-- timer_sessions / train_results which also store wca_id without a FK.
CREATE TABLE IF NOT EXISTS timer_backups (
  wca_id      VARCHAR(20) PRIMARY KEY,
  blob        TEXT        NOT NULL,
  byte_size   INTEGER     NOT NULL,
  solve_count INTEGER     NOT NULL DEFAULT 0,
  updated_at  BIGINT      NOT NULL
);
