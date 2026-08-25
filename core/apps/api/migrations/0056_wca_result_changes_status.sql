-- 用户提议的成绩变更需管理员审核才上线(社区纠错 + 审核闸门)。
-- status 取值:
--   'approved'  已生效:自动监控检出 / 管理员录入 / 本人 +2 即时(进 effective 值,影响公开显示)
--   'pending'   待审核:任何登录用户对他人成绩、或任何「原始/改判」改动 → 公开可见但标注待审核,不进 effective 值
--   'rejected'  已驳回:管理员驳回,公开不再显示
-- DEFAULT 'approved' 保证既有行 + 监控自动插入 + 不显式带 status 的写入都视为已生效。
ALTER TABLE wca_result_changes
  ADD COLUMN status VARCHAR(12) NOT NULL DEFAULT 'approved';

-- 审核队列:按待审条目最新优先取(部分索引,只覆盖 pending,体积小)。
CREATE INDEX idx_wrc_pending ON wca_result_changes (detected_at DESC) WHERE status = 'pending';
