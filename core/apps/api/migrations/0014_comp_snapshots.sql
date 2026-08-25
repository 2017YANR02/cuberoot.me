-- /v1/cubing-live 持久化 L2 缓存。
-- 原:in-process Map 60s/12h,pm2 重启清空、首次冷启 3-5s (probe + cubing.com scrape + enrichPersonalRecords)。
-- 改:loadComp 走 PG 读穿。命中 + 未过期秒返回;SWR 后台刷新。
-- schema_version 用于 enrich 逻辑改动后整体失效旧缓存(读时 WHERE schema_version=<当前 const>)。
CREATE TABLE comp_snapshots (
  wca_id         VARCHAR(80)    NOT NULL,
  source         VARCHAR(16)    NOT NULL,  -- 'wca' / 'wca_db' / 'wca_live' / 'cubing'
  schema_version SMALLINT       NOT NULL,
  payload        JSONB          NOT NULL,
  fetched_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  expires_at     TIMESTAMPTZ    NOT NULL,
  PRIMARY KEY (wca_id, source, schema_version)
);
CREATE INDEX comp_snapshots_expires_idx ON comp_snapshots(expires_at);
