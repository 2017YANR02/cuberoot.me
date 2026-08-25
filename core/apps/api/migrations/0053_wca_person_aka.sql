-- 名录(/wca/all-results 排名页空态 A-Z 视图)四口径:英文名 / 全名 / 本地名 / 含曾用名。
-- 英文名长度已有 wca_persons_name_len(migration 0052),这里补：
--
-- 1. 全名长度排序索引(全名 = 完整 WCA 名,含括号本地名)。ORDER BY 表达式须与此逐字一致才命中。
CREATE INDEX IF NOT EXISTS wca_persons_full_len ON wca_persons ((char_length(name)));

-- 2. 含曾用名小表:曾用名(WCA persons 表 sub_id>1 的历史记录)PG 主库里没有
--    (wca_persons 只灌 sub_id=1),全站仅 ~400 人有曾用名,单列小表承载即可。
--    former_names: 去重后的曾用名数组(剔除与现名相同的纯改国籍行),供前端显示「曾用名」标签;
--    aka_len:      现名(全名)+ 各曾用名拼成一个整体后的字符长度,供「名字长度」排序,
--                  口径与姓名分布 name_stats 的 _aka 面板完全一致。
--    由 stats-build 的 gen_person_aka.ts 从 WCA dump 生成,psql 灌入(近静态,极少刷新)。
CREATE TABLE IF NOT EXISTS wca_person_aka (
  wca_id       VARCHAR(20) PRIMARY KEY,
  former_names JSONB   NOT NULL,
  aka_len      INTEGER NOT NULL
);
