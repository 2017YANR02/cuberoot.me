-- 管理员手动录入「成绩变更链」支持:同一条成绩可经历多次更改,带原因 / 真实发生日期 / 来源。
-- 复用 wca_result_changes(append-only):每行 = 一次变更事件(可一次改多个字段),
-- 同一 (wca_id, competition_id, event_id, round_type_id) 的多行按 effective_at 串成变更链。
ALTER TABLE wca_result_changes
  ADD COLUMN note         TEXT,                                -- 管理员填写的变更原因(展示给用户)
  ADD COLUMN effective_at TIMESTAMPTZ,                         -- 变更真实发生日期(排序 / 展示;可空,空则退化用 detected_at)
  ADD COLUMN source       VARCHAR(12) NOT NULL DEFAULT 'auto', -- 'auto'(监控检出)| 'manual'(管理员录入)
  ADD COLUMN created_by   VARCHAR(12),                         -- 录入管理员 WCA ID(API key 录入为 __api_key__)
  ADD COLUMN edited_at    TIMESTAMPTZ;                         -- 最后一次被管理员编辑的时间

-- comp 直播页按比赛拉全场变更(一次取一个比赛所有选手的变更)
CREATE INDEX idx_wrc_comp ON wca_result_changes (competition_id);
