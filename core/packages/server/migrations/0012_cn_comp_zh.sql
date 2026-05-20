-- 中国大陆比赛 cubing.com 抓的中文地点 + 退赛/重开报名时间,DB 缓存以秒级返回。
-- 现状:每次 GET /v1/cubing-zh/:id miss 都 scrape 1-3s,新比赛首次访问慢且依赖 cubing.com.
-- 改:走 DB 写穿,启动 + 每日批量预热 upcoming CN 比赛。
CREATE TABLE cn_comp_zh (
  wca_id            VARCHAR(80) PRIMARY KEY,
  location_zh       TEXT,
  withdraw_deadline VARCHAR(32),
  reopen_at         VARCHAR(32),
  fetched_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
