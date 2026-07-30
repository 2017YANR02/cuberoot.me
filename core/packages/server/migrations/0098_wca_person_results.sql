-- 选手页(/wca/persons/:id)专用的全量成绩表 + 比赛表补 city / iso2。
--
-- 背景:选手页首屏三个源(profile / results / competitions)一直直连 WCA 官网,
-- 国内网络打不通官网时整页卡在「加载中…」。这张表让首屏改由自家库供数。
--
-- 为什么不复用 wca_results_flat:那张表是**排行榜口径** —— 只写 value>0(整轮 DNF 的
-- 成绩被丢掉)、单次/平均拆成两行、且没有轮次名次 pos。选手页要的恰好是它扔掉的部分:
--   * DNF 轮次(实测 2017YANR02 官方 736 条里有 7 条,含 3 条盲拧)
--   * pos —— 里程碑「首金/首银/首铜」、成绩表名次列与排序都要它
-- 而负值绝不能混进 flat:全站排行榜都是 ORDER BY value ASC,-1 会排到世界第一。
-- 故另开一张「一条成绩一行」的表,flat 一个字节不动。
--
-- 灌数据:stats.yml 的 wca_stats_extra_build.ts,与 flat 共用 per-comp 指纹增量
-- (只重灌指纹变动的比赛)。首次上线需手动跑一次 workflow_dispatch + person_results_full=true。
CREATE TABLE IF NOT EXISTS wca_person_results (
  wca_id         VARCHAR(20) NOT NULL,
  comp_id        VARCHAR(50) NOT NULL,
  comp_date      DATE        NOT NULL,
  event_id       VARCHAR(20) NOT NULL,
  round_type_id  VARCHAR(2)  NOT NULL DEFAULT '',
  format_id      VARCHAR(2)  NOT NULL DEFAULT '',
  pos            SMALLINT    NOT NULL DEFAULT 0,
  best           INTEGER     NOT NULL,      -- WCA 编码:>0 有效 / -1 DNF / -2 DNS / 0 无
  average        INTEGER     NOT NULL DEFAULT 0,
  attempts       INTEGER[],
  single_record  VARCHAR(3)  NOT NULL DEFAULT '',
  average_record VARCHAR(3)  NOT NULL DEFAULT ''
);
-- 选手页查询:WHERE wca_id = ?(约 1400 行/人,回表拿全列)
CREATE INDEX IF NOT EXISTS wpr_person ON wca_person_results (wca_id);
-- 增量 apply:DELETE ... WHERE comp_id IN (变动比赛)
CREATE INDEX IF NOT EXISTS wpr_comp ON wca_person_results (comp_id);

-- 比赛表补两列:city 喂选手页「点亮城市」/「去过的省份」,country_iso2 喂国旗。
-- 都由同一份 builder 全量 TRUNCATE+COPY 重灌,无需回填。
ALTER TABLE wca_competitions ADD COLUMN IF NOT EXISTS city         VARCHAR(120) NOT NULL DEFAULT '';
ALTER TABLE wca_competitions ADD COLUMN IF NOT EXISTS country_iso2 VARCHAR(2)   NOT NULL DEFAULT '';

-- 头像是唯一一样官方 dump 里没有的东西(只存在于 WCA 网站的 API 响应)。整页不该为一张图
-- 卡住,故单独一张懒缓存表:/v1/wca/person-avatar 命中直接返,未命中才由服务器回源一次
-- (5KB profile)并写进来。url 为 NULL = 该选手没传头像(官方占位图不存)。
CREATE TABLE IF NOT EXISTS wca_person_avatar (
  wca_id     VARCHAR(20) PRIMARY KEY,
  url        TEXT,
  thumb_url  TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
