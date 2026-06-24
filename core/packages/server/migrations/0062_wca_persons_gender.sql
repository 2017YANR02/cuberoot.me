-- wca_persons 加 gender 列,支撑 /wca/results 排名页「性别」下拉(所有/男/女)。
-- gender 是每人恒定值('m'/'f'/'' 未公开),来自 WCA Public persons 导出的 gender 字段。
-- 排名查询 JOIN wca_persons 过滤 p.gender 即可,无需把 gender 灌进 wca_results_flat /
-- historical_ranks_snapshot 等大事实表(那会逼一次全表重建);位置派生名次自动重排,
-- 全球累积口径(historical-ranks)在 gender≠all 时走 RANK() OVER 重排。
--
-- 灌数:historical_ranks_build.ts 的 load.sql 会 TRUNCATE+\copy wca_persons (..., gender) 全量重灌;
-- 本 ALTER 只为已存在的线上表补列(stats 管道不 DROP 该表,故需 migration 补)。
ALTER TABLE wca_persons ADD COLUMN IF NOT EXISTS gender VARCHAR(1) NOT NULL DEFAULT '';

-- 性别 + 国家联合分桶:排名页按性别(可叠加国家)过滤选手时走它。
CREATE INDEX IF NOT EXISTS wca_persons_gender ON wca_persons (gender);
