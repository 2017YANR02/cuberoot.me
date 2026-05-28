-- ③b PR 涟漪追踪:某选手成绩被订正 → 其参加过的所有比赛里「当时是否 PR」标记会变,
-- 但那些比赛自身成绩行没动(content_hash 不变),content 增量抓不到。故按选手追踪 PR 指纹。
-- dump 脚本每次默认跑前 reconcile:从 wca_results_top 算 per-person PR 指纹
--   (sum(hashtextextended(event_id|is_avg|value)),PG 13 无 bit_xor/crc32 故用此),
--   指纹变了的选手 → 把其所有比赛的 comp_dump_state.dumped_content_hash 置 NULL,
--   令 content picker 重烤这些比赛。dumped_pr_hash 用 NUMERIC 容纳 sum(bigint)。
CREATE TABLE IF NOT EXISTS person_dump_state (
  person_id      VARCHAR(50)  PRIMARY KEY,
  dumped_pr_hash NUMERIC      NOT NULL,
  reconciled_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
