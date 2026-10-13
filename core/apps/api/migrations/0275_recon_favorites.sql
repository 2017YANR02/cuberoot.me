CREATE TABLE recon_favorites (
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  recon_id INTEGER NOT NULL REFERENCES recons(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, recon_id)
);
CREATE INDEX idx_recon_favorites_recon ON recon_favorites(recon_id);
