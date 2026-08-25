-- 一次性 backfill:把非官方 333mbo Mo3 平均行(is_avg=true)灌进 wca_results_flat。
--
-- 背景:WCA 不追踪多盲平均。wca_stats_extra_build.ts 给每条「3 次全成功」的多盲结果补一行 is_avg=true
-- (value=非官方 Mo3),供 /wca/results?type=average 单项平均排名。333mbo(旧多盲)是废止项(不再有新比赛),
-- 历史上恰好 2 条结果满足「3 次有效尝试」,均为 Constantin Ceausu(2006CEAU01):Euro2006 与 DutchOpen2006。
--
-- 为何要手动 backfill:wca_results_flat 走增量 build(只重写指纹变动的比赛),而这 2 场是 2006 年老赛,
-- 不会进 changedComps。直接 push builder 改动 → 增量行数守卫(实际 count == fullTopTotal)必红
-- (fullTopTotal 多了这 2 行,但增量不回填历史比赛)。故须先在生产 PG 跑此脚本插入这 2 行,使 count 对上,
-- 再 push wca_stats_extra_build.ts(eventId === '333mbo' 分支)。
--
-- Mo3 值由 computeMbfMo3(core/mbf_average.ts)对该结果的 3 把 attempts 算出(按数值大小分流解码旧/新/混合
-- 编码,DD/TTTTT/MM 各取均值再拼回):
--   Euro2006      [969999900, 1950599999, 1970499999]  (3/3 ?:??, 4/5 ?:??, 2/4 ?:??) → 979999901 = 3/4 ?:??
--   DutchOpen2006 [940360000, 1960706900, 1970605100]  (5/5 1:00:00, 3/7 1:55:00, 2/6 1:25:00) → 980520003 = 4/7 1:26:40
--
-- 其余列(wca_id / 国家 / comp / 日期 / attempts / round_type / format)直接复制该场的 is_avg=false 行,
-- 与 builder 输出逐列一致;record_tag 留空(无官方纪录)。NOT EXISTS 保证幂等(重复跑不会重插)。
-- 运行:在生产 PG 上 `psql <conn> -f backfill_mbo_mo3.sql`(单事务,失败回滚)。

BEGIN;

INSERT INTO wca_results_flat
  (event_id, is_avg, value, wca_id, person_country_id, comp_id, comp_date, attempts, round_type_id, format_id, record_tag)
SELECT s.event_id, true, 979999901, s.wca_id, s.person_country_id, s.comp_id, s.comp_date, s.attempts, s.round_type_id, s.format_id, ''
FROM wca_results_flat s
WHERE s.event_id = '333mbo' AND s.is_avg = false AND s.comp_id = 'Euro2006' AND s.wca_id = '2006CEAU01'
  AND NOT EXISTS (
    SELECT 1 FROM wca_results_flat a
    WHERE a.event_id = '333mbo' AND a.is_avg = true AND a.comp_id = s.comp_id AND a.wca_id = s.wca_id
  );

INSERT INTO wca_results_flat
  (event_id, is_avg, value, wca_id, person_country_id, comp_id, comp_date, attempts, round_type_id, format_id, record_tag)
SELECT s.event_id, true, 980520003, s.wca_id, s.person_country_id, s.comp_id, s.comp_date, s.attempts, s.round_type_id, s.format_id, ''
FROM wca_results_flat s
WHERE s.event_id = '333mbo' AND s.is_avg = false AND s.comp_id = 'DutchOpen2006' AND s.wca_id = '2006CEAU01'
  AND NOT EXISTS (
    SELECT 1 FROM wca_results_flat a
    WHERE a.event_id = '333mbo' AND a.is_avg = true AND a.comp_id = s.comp_id AND a.wca_id = s.wca_id
  );

-- 校验:应恰好有 2 行 is_avg=true 的 333mbo（重复跑保持 2）。
SELECT comp_id, wca_id, value FROM wca_results_flat WHERE event_id = '333mbo' AND is_avg = true ORDER BY comp_id;

COMMIT;
