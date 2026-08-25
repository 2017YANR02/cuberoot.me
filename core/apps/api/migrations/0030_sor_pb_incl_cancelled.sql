-- sor_player_best: 给「查选手最优组合」加废止项二态, 与名人堂(sor_census_yearly)/主榜单口径统一.
-- 原表恒 21 项(含 4 废止项 333ft/magic/mmagic/333mbo) → 现存行视作 incl_cancelled=true;
-- 另补一套 incl_cancelled=false(仅 17 活跃项). PK 加 incl_cancelled 维度.
-- 表由 load_sor.sql 手动管道创建/灌库(不在 schema.pg.sql), 这里幂等补列+改键, 与 load 模板同步.
ALTER TABLE sor_player_best ADD COLUMN IF NOT EXISTS incl_cancelled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE sor_player_best DROP CONSTRAINT IF EXISTS sor_player_best_pkey;
ALTER TABLE sor_player_best ADD PRIMARY KEY (wca_id, is_avg, scope, incl_cancelled);
