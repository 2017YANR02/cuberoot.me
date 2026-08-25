-- 每条 3x3-family 真实打乱的「逐 (方法,阶段,底色) 最优步数」紧凑索引,供:
--   1) /scramble/stats 难度页「列举某步数的全部真题」+ 按比赛名/日期筛选 + 分页
--   2) /timer WCA 真题来源「按难度(配色×方法×阶段×步数)出题」(复用飞镖采样)
--
-- 紧凑表示:steps SMALLINT[] —— 一条打乱一行,数组每个槽 = 某 (方法,阶段,底色) 的最优步数,
-- 槽位偏移由离线生成器随 VARIANTS 单源产出的 steps_layout.json 决定(append-only,std 永远在前)。
-- 子集(白底/双色/六色…)的 bin = 对所选底色槽位取 LEAST,查询时现算 —— 省掉 ~13× 子集物化膨胀。
-- 全 14 方法灌满约 0.75GB(~1.3M 行 × ~258 个 smallint 槽),NULL 槽 = 该 (方法,阶段) 未回填。
--
-- 按自然键主键(与 wca_scrambles / wca_scramble_optimal 同口径);rnd 从 wca_scrambles 拷入供飞镖采样。
-- gm_cross6 / gm_xcross6 = std 六色十字/xcross 最优(最常用难度,生成器预算)+ 索引走 ~1ms 飞镖;
-- 冷门 (方法,阶段,子集) 组合查询退化为分区扫描(对计时器出题/缓存列表均可接受)。
--
-- 数据不入 migration(量大,可再生):离线 build_scramble_steps.ts 产 wca_scramble_steps.csv +
-- steps_layout.json → scp → \copy 进 staging → INSERT JOIN wca_scrambles 补 rnd。
-- 备份脚本对本表用 --exclude-table-data(可再生,不需备)。
CREATE TABLE IF NOT EXISTS wca_scramble_steps (
  competition_id VARCHAR(32) NOT NULL,
  event_id       VARCHAR(6)  NOT NULL,
  round_type_id  VARCHAR(1)  NOT NULL,
  group_id       VARCHAR(3)  NOT NULL,
  is_extra       SMALLINT    NOT NULL DEFAULT 0,
  scramble_num   INT         NOT NULL,
  rnd            DOUBLE PRECISION NOT NULL,
  steps          SMALLINT[]  NOT NULL,
  gm_cross6      SMALLINT,   -- 预算:std 六色十字最优(热路径飞镖)
  gm_xcross6     SMALLINT,   -- 预算:std 六色 xcross 最优(热路径飞镖)
  PRIMARY KEY (competition_id, event_id, round_type_id, group_id, is_extra, scramble_num)
);

-- 热路径飞镖采样索引:WHERE event_id=? AND gm_*=? AND rnd>=dart ORDER BY rnd LIMIT n
CREATE INDEX IF NOT EXISTS idx_wss_cross6  ON wca_scramble_steps (event_id, gm_cross6, rnd);
CREATE INDEX IF NOT EXISTS idx_wss_xcross6 ON wca_scramble_steps (event_id, gm_xcross6, rnd);

-- steps[] 槽位布局(单行):离线生成器随 VARIANTS 单源产出,与数据同批灌入 → server 端点据此
-- 把 (方法,阶段,底色) → 数组槽位(1-based)。结构 layout.variants[variant][stage][color] = slot。
-- 与步数数据同批 \copy/UPSERT,保证 layout 与表内 steps[] 槽位一致。
CREATE TABLE IF NOT EXISTS wca_scramble_steps_meta (
  id           SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  layout       JSONB NOT NULL,
  generated_at TEXT
);
