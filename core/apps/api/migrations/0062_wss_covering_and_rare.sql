-- 难度出题查询提速(配套 server routes/wca_scrambles.ts 的 rare/live 分流):
--
--   1) 覆盖索引替换 0061 的通用 (event_id, rnd) 飞镖索引:难度谓词只引用 steps/gm 列、
--      SELECT 只需自然键 → 加 INCLUDE 后 s 扫描变 index-only,消灭「按 rnd 序随机回堆」
--      (606MB 表实测回堆 2.1GB IO / 8.2s;index-only 顺序读索引页,常见 bin LIMIT 提前停
--      只读几十页,冷缓存也是 ms 级)。依赖可见性地图:管道灌完必须 VACUUM ANALYZE
--      (update_cross_stats.ps1 Load-StepsToPg 已带),否则静默退化回堆探测。
--   2) 稀有档侧表 wca_scramble_steps_rare:离线 builder 把「单槽位值计数 ≤ K」的尾部行
--      逐 (slot, val) 导出(K/尾部值表在 wca_scramble_steps_meta.layout.tails,与本表同
--      事务替换,保证路由元数据与行集一致)。子集稀有 bin 按色拆分支直查本表(PK 前缀
--      (slot,val) 直达,候选 ≤ 6×K),把「全表扫只捞 2 条」的最坏路径(实测 8s)打到 ms。
--      stage6 = 该槽所属阶段的 6 底色步数快照(B,G,O,R,W,Y 序),分支的兄弟色判据行内可判,
--      不回大表;只有最终 LIMIT 后的行才按自然键 join wca_scrambles 取打乱文本。
--   3) 既有 gm_cross6/gm_xcross6 列索引 + std 深阶段 LEAST 表达式索引(0057/0061)保留,
--      六色查询仍走原最优路径。
--
-- CREATE INDEX 无 CONCURRENTLY(migration runner 包事务);只锁写不锁读,本表仅离线管道写,
-- 部署时建 ~1 分钟安全。
CREATE INDEX IF NOT EXISTS idx_wss_event_rnd_cov ON wca_scramble_steps
  (event_id, rnd)
  INCLUDE (competition_id, round_type_id, group_id, is_extra, scramble_num,
           gm_cross6, gm_xcross6, steps);
DROP INDEX IF EXISTS idx_wss_event_rnd;

CREATE TABLE IF NOT EXISTS wca_scramble_steps_rare (
  slot           SMALLINT    NOT NULL,  -- steps[] 1-based 槽位(见 meta.layout.variants)
  val            SMALLINT    NOT NULL,  -- 该槽步数值(仅尾部值入表,见 meta.layout.tails)
  competition_id VARCHAR(32) NOT NULL,
  event_id       VARCHAR(6)  NOT NULL,
  round_type_id  VARCHAR(1)  NOT NULL,
  group_id       VARCHAR(3)  NOT NULL,
  is_extra       SMALLINT    NOT NULL DEFAULT 0,
  scramble_num   INT         NOT NULL,
  stage6         SMALLINT[]  NOT NULL,  -- 同阶段 6 底色步数(B,G,O,R,W,Y;缺数据槽为 NULL)
  PRIMARY KEY (slot, val, competition_id, event_id, round_type_id, group_id, is_extra, scramble_num)
);
