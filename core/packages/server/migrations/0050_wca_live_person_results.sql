-- 选手页「直播·非官方成绩」per-person 索引表。
-- runner 自动包事务,勿写 BEGIN/COMMIT。
--
-- 背景:选手个人主页「全部成绩」只读 WCA 官方 API(/persons/:id/results),官方成绩要等
-- 代表提交 + WRT 处理,通常比赛结束后几天~几周才上线。这段空窗里,成绩其实已经在 cubing.com
-- (中国比赛)/ WCA Live(国外比赛)直播过了 —— 而 core-api 的 prewarm cron 早就把最近 30 天
-- 的每场比赛 loadComp(auto) 进 comp_snapshots(整份 CompData)。
--
-- 本表把那些「非官方源(cubing / wca_live)、官方尚未收录」的近期比赛成绩炸成 per-person 行,
-- 由 cubing_live.ts 的 syncPersonLiveResults() 在写快照时写穿(DELETE+INSERT per comp;比赛转
-- 官方源 wca/wca_db 时删除该 comp 全部行)。选手页 /v1/wca/person-live-results?wcaId= 走 wca_id
-- 索引秒查,客户端按「比赛粒度」与官方成绩去重后内联进「全部成绩」,标「直播·非官方」。
--
-- 仅作展示缓存,可随时重建/清空,不进任何权威口径(PR 表 / 名次和 / 纪录一律不读本表)。

CREATE TABLE wca_live_person_results (
  wca_id        VARCHAR(20)  NOT NULL,           -- 选手 WCA id
  comp_id       VARCHAR(80)  NOT NULL,           -- 比赛 WCA id(无横杠规范形态)
  comp_name     TEXT         NOT NULL DEFAULT '',
  comp_date     DATE,                            -- 比赛 start_date(可空:刚公示未入 dump)
  event_id      VARCHAR(12)  NOT NULL,
  round_type_id VARCHAR(4)   NOT NULL,           -- '1'/'2'/'3'/'f'/'d'/'e'/'g'/'c'/'b'/'h'
  format_id     VARCHAR(4)   NOT NULL DEFAULT '',
  pos           INT          NOT NULL DEFAULT 0, -- 轮内名次(本地按成绩比较器算,非官方)
  best          INT          NOT NULL DEFAULT 0, -- centiseconds(FMC/MBLD 同 WCA 编码)
  average       INT          NOT NULL DEFAULT 0,
  attempts      JSONB        NOT NULL DEFAULT '[]'::jsonb,
  source        VARCHAR(12)  NOT NULL,           -- 'cubing' | 'wca_live'
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (wca_id, comp_id, event_id, round_type_id)
);

CREATE INDEX idx_wlpr_wca  ON wca_live_person_results (wca_id);
CREATE INDEX idx_wlpr_comp ON wca_live_person_results (comp_id);
CREATE INDEX idx_wlpr_date ON wca_live_person_results (comp_date);
