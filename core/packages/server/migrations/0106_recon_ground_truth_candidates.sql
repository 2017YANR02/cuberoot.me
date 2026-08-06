-- 0106_recon_ground_truth_candidates.sql — 持久化候选来源的完整复原校验。
-- 只有快照仍一致且 eligible=true 的记录才出现在管理员候选池；来源变化后自动重算。

CREATE TABLE IF NOT EXISTS recon_ground_truth_candidate_checks (
  recon_id             INTEGER PRIMARY KEY REFERENCES recons(id) ON DELETE CASCADE,
  source_event         VARCHAR(20) NOT NULL,
  source_added_by_id   VARCHAR(20) NOT NULL,
  source_value         TEXT NOT NULL,
  source_raw_time      NUMERIC(8,3),
  source_scramble      TEXT NOT NULL,
  source_solution      TEXT NOT NULL,
  eligible             BOOLEAN NOT NULL,
  blockers_json        TEXT NOT NULL DEFAULT '[]',
  checked_at           TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recon_ground_truth_candidate_eligible
  ON recon_ground_truth_candidate_checks(eligible, recon_id);
