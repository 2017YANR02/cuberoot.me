-- dump_comps.yml 增量决策表:跟踪每场比赛的 .json 最后 dump 时基于的源 watermark。
-- 与 wca_comp_updated_at(stats.yml 每天 drop+reload 的 manifest)配对使用:
--   pick 列表 = wca_comp_updated_at u LEFT JOIN comp_dump_state s
--              WHERE s.comp_id IS NULL OR u.src_max_updated_at > s.dumped_max_updated_at
-- dump 完每场 UPSERT 此表 → 下次只 dump 真变了的。
CREATE TABLE comp_dump_state (
  comp_id                VARCHAR(50)  PRIMARY KEY,
  dumped_max_updated_at  TIMESTAMP    NOT NULL,
  dumped_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
