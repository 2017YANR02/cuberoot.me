-- 0105_recon_ground_truth.sql — 管理员维护的智能魔方复盘回归样本。
-- 候选池仍来自 recons；这里只存人工决定和确认时的不可变快照。

CREATE TABLE IF NOT EXISTS recon_ground_truth_cases (
  recon_id             INTEGER PRIMARY KEY,
  status               VARCHAR(16) NOT NULL
                         CHECK (status IN ('confirmed', 'discussion', 'rejected')),
  replay               TEXT,
  truth                TEXT NOT NULL,
  truth_mode           VARCHAR(32) NOT NULL DEFAULT 'normalize_cross'
                         CHECK (truth_mode = 'normalize_cross'),
  current_wrong        TEXT NOT NULL DEFAULT '',
  note                 TEXT NOT NULL DEFAULT '',
  source_event         VARCHAR(20) NOT NULL,
  source_added_by_id   VARCHAR(20) NOT NULL,
  source_scramble      TEXT NOT NULL,
  source_solution      TEXT NOT NULL,
  created_by_id        VARCHAR(20) NOT NULL,
  updated_by_id        VARCHAR(20) NOT NULL,
  created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMP NOT NULL DEFAULT NOW(),
  CHECK (status <> 'confirmed' OR (replay IS NOT NULL AND replay <> ''))
);

CREATE INDEX IF NOT EXISTS idx_recon_ground_truth_status
  ON recon_ground_truth_cases(status, recon_id);
