-- 0060_wca_championship_podiums.sql
-- 选手页「锦标赛领奖台」预计算表。一行 = 某选手在某锦标赛(world / 洲际 / 国家 / 多国类型)
-- 某项目决赛、在「该锦标赛资格内重排」后名次 ≤3 的领奖台成绩。
-- 由 stats-build/wca_stats_extra_build.ts 全量灌(TRUNCATE+COPY,随 wca_stats_extra 同一 apply)。
-- level: 'world' | 大洲 id('_North America') | 国家 iso2('US') | 多国类型('greater_china')。
CREATE TABLE IF NOT EXISTS wca_championship_podiums (
  wca_id          VARCHAR(20) NOT NULL,
  comp_id         VARCHAR(50) NOT NULL,
  event_id        VARCHAR(20) NOT NULL,
  level           VARCHAR(30) NOT NULL,
  place           SMALLINT NOT NULL,
  best            INTEGER NOT NULL,
  average         INTEGER NOT NULL DEFAULT 0,
  attempts        INTEGER[],
  single_record   VARCHAR(3) NOT NULL DEFAULT '',
  average_record  VARCHAR(3) NOT NULL DEFAULT '',
  PRIMARY KEY (wca_id, comp_id, event_id, level)
);
CREATE INDEX IF NOT EXISTS wcp_wca ON wca_championship_podiums (wca_id);
