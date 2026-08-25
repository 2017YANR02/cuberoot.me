-- 选手名录(/wca/all-results 排名页空态:未选任何项目时的「名录」A-Z 视图)。
-- 支持按 名字首字母 / 名字长度 分页排序。wca_persons ~25 万行小表。
--   - 首字母:走 (name) btree。
--   - 名字长度:剥掉 "Latin (本地名)" 末尾的本地名注释后取拉丁名长度(语言无关,与 displayCuberName 口径一致),
--     建表达式索引;ORDER BY 表达式须与此处逐字一致才能命中。
-- 普通 CREATE INDEX(非 CONCURRENTLY,runner 每个 migration 包事务),25 万行秒级。
CREATE INDEX IF NOT EXISTS wca_persons_name ON wca_persons (name);
CREATE INDEX IF NOT EXISTS wca_persons_name_len
  ON wca_persons ((char_length(regexp_replace(name, '\s*\([^)]*\)\s*$', ''))));
