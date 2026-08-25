-- 公式训练器「过遍」进度:哪些范围整轮过完了 + 现在停在哪。每用户每 set 一行。
--
-- 为什么要它(背景见 client `lib/alg-sweep.ts` 文件头):标记 alg_case_marks 与记忆
-- alg_case_srs 都是一 case 一行。库内集最大的 1LLL 3915 个,怎么存都行;LSLL 是 149,188 个,
-- 练满 29.8 万行 / ~52 MB 一个人 —— 两条路由的 20,000 条上限按 302 个/天算第 66 天就撞墙。
--
-- 但「这一轮 302 个过完了」一整轮只要一个数。记在这里之后,那一轮里没有手动标记的
-- per-case 记忆记录就可以折叠掉(POST /alg/sweep/:p/:s/fold),存量掉到几千行。
--
-- sweeps = { "<scope>": 过完几遍 },scope 就是 `?scope=` 的值(整集用 "")。
--          合并语义取每个 scope 的 max —— 多设备离线各刷各的,取 max 不会重复计。
-- cursor = { "scope": "zbls-r67", "pos": 128, "total": 302 },给「继续第 67 轮」用;
--          按 updated_at 做 last-write-wins。
-- folded_at = 最后一次折叠的时刻,**多设备收敛的关键**:折叠是真删行,而另一台设备本地
--          还留着那 302 条,下次合并会把它们当「本地独有」原样传回云端,折叠就白做了。
--          有了这个时刻,客户端可以判定「上次复习早于最后一次折叠、且没有手动标记」的
--          本地记录属于已折叠的轮,直接丢弃、不回传。
CREATE TABLE IF NOT EXISTS alg_set_progress (
  wca_id     VARCHAR(20) NOT NULL,
  puzzle     VARCHAR(16) NOT NULL,
  set_slug   VARCHAR(32) NOT NULL,
  sweeps     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  cursor     JSONB,
  folded_at  BIGINT      NOT NULL DEFAULT 0,
  updated_at BIGINT      NOT NULL,
  PRIMARY KEY (wca_id, puzzle, set_slug)
);

-- 进度总览页要一次拿到某用户全部 set 的行;PK 前缀已经覆盖,不另建索引
-- (alg_case_marks 那条 (wca_id,puzzle,set_slug) 辅助索引其实也是冗余的,不在这里动它)。
