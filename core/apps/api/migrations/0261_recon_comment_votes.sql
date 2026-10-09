CREATE TABLE recon_comment_votes (
  comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  vote VARCHAR(7) NOT NULL CHECK (vote IN ('like', 'dislike')),
  PRIMARY KEY (comment_id, user_id)
);
CREATE INDEX idx_recon_comment_votes_user ON recon_comment_votes(user_id);
