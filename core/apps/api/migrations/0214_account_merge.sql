-- 保留合并来源账号作为无个人资料的重定向墓碑，让旧 JWT 自动归到保留账号。
ALTER TABLE app_users
  ADD COLUMN merged_into_user_id BIGINT REFERENCES app_users(id),
  ADD CONSTRAINT chk_app_users_not_merged_into_self
    CHECK (merged_into_user_id IS NULL OR merged_into_user_id <> id);

CREATE INDEX idx_app_users_merged_into
  ON app_users(merged_into_user_id)
  WHERE merged_into_user_id IS NOT NULL;
