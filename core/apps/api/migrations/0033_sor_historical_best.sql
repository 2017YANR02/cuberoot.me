-- SOR 历史最高名次:每人在 17 现役项目 SOR 上到过的最好(最小)世界/国家名次 + 发生年份.
-- 供 /wca/sum-of-ranks 主榜「历史最高」徽标(LEFT JOIN,按 wca_id+is_avg+scope 查).
-- 数据由 stats-build/src/bin/sor_over_time_build.ts 算出 → sor_historical_best.copy.tsv,
-- 走 historical_ranks 同一 scp+apply_load 通道灌库(load.sql 内 CREATE IF NOT EXISTS + TRUNCATE + \copy).
-- 此 migration 仅保证空表先存在,server JOIN 在数据灌入前返回 NULL(不报错).
CREATE TABLE IF NOT EXISTS sor_historical_best (
  wca_id    VARCHAR(20) NOT NULL,
  is_avg    BOOLEAN     NOT NULL,
  scope     VARCHAR(10) NOT NULL,  -- 'world' | 'country'
  best_rank INTEGER     NOT NULL,
  best_year SMALLINT    NOT NULL,
  PRIMARY KEY (wca_id, is_avg, scope)
);
