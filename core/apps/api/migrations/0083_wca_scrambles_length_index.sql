-- /timer 真题「按难度出题」再加一个「打乱」方法:按**原始 WCA 打乱的招式数**筛(首页「近期打乱」
-- 的长度视图同口径)。3x3 打乱是随机态生成的,长度 12–23 不等,分布极偏:19 步 31.3 万条、
-- 12 步全库只有 2 条 —— 客户端抓几批再过滤必然误报「无匹配」,只能在库里按长度直接取。
--
-- 长度不落列、只建表达式索引:generated column 要重写整张 wca_scrambles(全项目几百万行),
-- 而表达式索引只多一份索引,且查询谓词写成同形表达式即可命中。
-- ⚠️ 表达式必须与 routes/wca_scrambles.ts 的 LEN_EXPR 逐字符一致,改一处必须同步改另一处,
--    否则 planner 认不出、退化成整分区扫描。
--
-- partial index:长度筛只对 3x3 族开放(其余项目要么定长、要么没这个玩法),索引也就只覆盖这几个
-- event —— 与 server 的 FAMILY_333 一致。查询谓词是 event_id = '333' 这种等值,planner 能证明
-- 它落在 partial 条件内。
CREATE INDEX IF NOT EXISTS idx_wca_scr_ev_len_rnd
  ON wca_scrambles (event_id, cardinality(regexp_split_to_array(btrim(scramble), '\s+')), rnd)
  WHERE event_id IN ('333', '333oh', '333bf', '333ft', '333fm');
