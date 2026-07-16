-- 论坛发帖审核(issue #36,Discourse approve-post-count 模式)。
-- status 取值(与 0056 wca_result_changes 同约定):
--   'approved'  已发布:公开可见(老数据由 DEFAULT 全量回填为已发布)
--   'pending'   待审核:仅作者与管理员可见;回帖在楼层流里对他人显示占位(postNo 稳定,同软删占位)
--   'rejected'  已驳回:对他人等同删除占位;作者可见驳回原因(review_note)
-- 门槛在服务端:管理员免审;已过审帖数 >= N(FORUM_APPROVE_POST_COUNT)视为可信直发;
-- 敏感词(FORUM_WATCH_WORDS)命中则连可信用户也进队列。
ALTER TABLE forum_threads
  ADD COLUMN status VARCHAR(12) NOT NULL DEFAULT 'approved';
ALTER TABLE forum_threads
  ADD COLUMN review_note VARCHAR(500);
ALTER TABLE forum_posts
  ADD COLUMN status VARCHAR(12) NOT NULL DEFAULT 'approved';
ALTER TABLE forum_posts
  ADD COLUMN review_note VARCHAR(500);

-- 审核队列按先来先审取(部分索引只覆盖 pending,体积小)
CREATE INDEX idx_forum_threads_pending ON forum_threads (created_at) WHERE status = 'pending';
CREATE INDEX idx_forum_posts_pending ON forum_posts (created_at) WHERE status = 'pending';

-- 信任门槛查询:数某作者已过审帖数(每次发帖都要查一次)
CREATE INDEX idx_forum_posts_author_approved ON forum_posts (author_id)
  WHERE status = 'approved' AND NOT is_deleted;
