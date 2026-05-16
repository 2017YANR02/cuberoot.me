-- 0006_historical_ranks_pb_context.sql
-- 为 persons 模式排名表(/wca/all-results?show=persons)补 PB 上下文:
-- 单次 / 平均 PB 各自来自哪场比赛、哪天、那一组 5 把分别多少。
-- 跟 wca_competitions 一起 join 出 comp 名字给前端;wca_competitions 也是新表(参考 wca_stats_extra 那条管道).
--
-- 新增 6 列(各 nullable,因为有人没 single 或没 average,或历史项目无 5 attempts):
--   best_single_comp_id      VARCHAR(40)   -- WCA competition id, e.g. 'GLSBigCubesGdansk2026'
--   best_single_date         DATE          -- 比赛 start_date(年级 snapshot 用)
--   best_single_attempts     INTEGER[]     -- value1..value5,缺位 NULL
--   best_average_comp_id     VARCHAR(40)
--   best_average_date        DATE
--   best_average_attempts    INTEGER[]

ALTER TABLE historical_ranks_snapshot
  ADD COLUMN IF NOT EXISTS best_single_comp_id    VARCHAR(40),
  ADD COLUMN IF NOT EXISTS best_single_date       DATE,
  ADD COLUMN IF NOT EXISTS best_single_attempts   INTEGER[],
  ADD COLUMN IF NOT EXISTS best_average_comp_id   VARCHAR(40),
  ADD COLUMN IF NOT EXISTS best_average_date      DATE,
  ADD COLUMN IF NOT EXISTS best_average_attempts  INTEGER[];

-- 月级表暂不加(选手页 PR 时间序列不需要,数据量翻倍 ROI 低,以后要再补).
-- 注:wca_competitions 已由 wca_stats_extra 那条管道维护(schema_wca_stats_extra.pg.sql),
-- 此 migration 不需重复 CREATE;runtime 直接 JOIN.

-- 顺手清掉 wca_year_results_top:/year-results 页已合并到 /all-results?year=YYYY,表/路由都已删.
DROP INDEX IF EXISTS yrt_month;
DROP TABLE IF EXISTS wca_year_results_top;
