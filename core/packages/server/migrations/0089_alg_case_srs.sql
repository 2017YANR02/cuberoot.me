-- 公式记忆(间隔重复)per-case 调度状态 + 每日复习日志。
--
-- case 身份与 alg_case_marks 同构:(wca_id, puzzle, set_slug, case_key),case_key 是客户端
-- trainer 全链路的 `subgroup|name`(lib/trainer-case-key.ts)。两张表故意分开:
-- 标记(学习中/已掌握/搁置/星标)是**用户手动的判断**,记忆调度是**系统算出来的状态**,
-- 清标记不该抹掉记忆曲线,反过来也一样。
--
-- reviewed_at 同时充当多设备 last-write-wins 的版本号(PUT 只接受不比现有旧的写)。
CREATE TABLE IF NOT EXISTS alg_case_srs (
  wca_id      VARCHAR(20)  NOT NULL,
  puzzle      VARCHAR(16)  NOT NULL,
  set_slug    VARCHAR(32)  NOT NULL,
  case_key    VARCHAR(128) NOT NULL,
  due         BIGINT       NOT NULL,           -- 下次到期(epoch ms)
  ivl         REAL         NOT NULL,           -- 当前间隔(天;0 = 重学中)
  ease        REAL         NOT NULL,           -- 难度因子
  reps        INTEGER      NOT NULL DEFAULT 0, -- 累计复习次数
  lapses      INTEGER      NOT NULL DEFAULT 0, -- 遗忘次数
  streak      INTEGER      NOT NULL DEFAULT 0, -- 连续答对
  hist        INTEGER      NOT NULL DEFAULT 0, -- 最近 12 次评分(2bit/次,最新在低位)
  reviewed_at BIGINT       NOT NULL,           -- 上次复习(= LWW 版本号)
  PRIMARY KEY (wca_id, puzzle, set_slug, case_key)
);
-- 拉某用户某 set 的全部记录(GET /v1/alg/srs/:puzzle/:set)。
CREATE INDEX IF NOT EXISTS idx_alg_case_srs_user_set ON alg_case_srs(wca_id, puzzle, set_slug);

-- 每日复习量(热力图 / 连续天数)。多设备离线各刷各的 ⟹ 合并取每天较大值,
-- 所以这里存的是「某设备见过的当天最大计数」,不是严格总和。
CREATE TABLE IF NOT EXISTS alg_srs_daily (
  wca_id   VARCHAR(20) NOT NULL,
  day      DATE        NOT NULL,
  reviews  INTEGER     NOT NULL DEFAULT 0,
  again    INTEGER     NOT NULL DEFAULT 0,   -- 其中评「忘了」的次数
  PRIMARY KEY (wca_id, day)
);
