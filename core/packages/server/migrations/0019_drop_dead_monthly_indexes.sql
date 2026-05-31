-- 0019_drop_dead_monthly_indexes.sql
-- 给 historical_ranks_monthly_snapshot 瘦身:删 3 个查询从不走的索引/约束,回收 ~455 MB
-- (实测删前 1051 MB:堆 378 + 索引 673;删后索引仅剩 hrms_person 219 → 总 ~597 MB)。
--
-- 该表唯一读者是 /v1/wca/person-rank-history 月级分支,只按 WHERE wca_id=? AND event_id=? 查,
-- 走 hrms_person (wca_id,event_id,year,month)。其余索引/约束全是历史遗留:
--   - hrms_single_wr / hrms_avg_wr: 当初照搬年级表给"按月世界榜"建的,但全站无该功能,
--     从无任何查询走过(纯死索引)。
--   - pkey (event_id,year,month,wca_id): 查询从不走(末位 wca_id,过滤不到),只在灌库时保唯一;
--     该表是 stats.yml 全量 TRUNCATE + \copy 重灌的派生表,唯一性由 builder 确定性 emit 保证,
--     无需 PK 约束。无 FK 引用它,load.sql 也无 ON CONFLICT 依赖。
--
-- 删索引/约束是瞬时操作,立即释放磁盘;日更 load.sql 只 TRUNCATE+\copy+ANALYZE、不建索引,
-- 故一次删完永久生效,不会被重灌刷回来。
DROP INDEX IF EXISTS hrms_single_wr;
DROP INDEX IF EXISTS hrms_avg_wr;
ALTER TABLE historical_ranks_monthly_snapshot DROP CONSTRAINT IF EXISTS historical_ranks_monthly_snapshot_pkey;
