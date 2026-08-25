-- 0042_rename_wca_results_top_to_flat.sql
-- wca_results_top 是历史名:最初只存 top 5000 ww + top 500/country(故叫 top),
-- 后去掉 cap 扩成全量(~1223 万行,展平 single+average 成一张去规范化表),名实不符。
-- 改名 wca_results_flat;索引前缀 wrt_ → wrf_。纯 rename,不动数据。
--
-- IF EXISTS 守卫:已改名 / fresh-DB builder 直接建新名 → 此 migration 整体变 no-op,apply_migrations 重跑安全。
-- 注:旧 migration 0007(建 wrt_prior_pr)/0017(注释)仍引用旧名,sha 锁死不能改;它们已 applied 不会重跑,无碍。
--   builder(wca_stats_extra_build.ts)全量分支 DROP+CREATE 已同步用新名+wrf_ 索引;增量分支不重建索引,本 rename 后即一致。

ALTER TABLE    IF EXISTS wca_results_top          RENAME TO wca_results_flat;

ALTER INDEX    IF EXISTS wrt_main                 RENAME TO wrf_main;
ALTER INDEX    IF EXISTS wrt_country              RENAME TO wrf_country;
ALTER INDEX    IF EXISTS wrt_wca_id               RENAME TO wrf_wca_id;
ALTER INDEX    IF EXISTS wrt_comp_id              RENAME TO wrf_comp_id;
ALTER INDEX    IF EXISTS wrt_comp_lookup          RENAME TO wrf_comp_lookup;
ALTER INDEX    IF EXISTS wrt_prior_pr             RENAME TO wrf_prior_pr;
ALTER INDEX    IF EXISTS wrt_year                 RENAME TO wrf_year;
ALTER INDEX    IF EXISTS wrt_month                RENAME TO wrf_month;

-- PK 索引 + BIGSERIAL 序列(rename 表不会自动改这两个的名字;序列默认值按 OID 绑定,改名不破坏 default)。
ALTER INDEX    IF EXISTS wca_results_top_pkey     RENAME TO wca_results_flat_pkey;
ALTER SEQUENCE IF EXISTS wca_results_top_id_seq   RENAME TO wca_results_flat_id_seq;
