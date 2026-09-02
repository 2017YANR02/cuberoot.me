CREATE TABLE platform_qr_card_designs (
  qr_code_id UUID NOT NULL REFERENCES platform_qr_codes(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version > 0),
  card JSONB NOT NULL CHECK (JSONB_TYPEOF(card) = 'object'),
  created_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_by_actor_key VARCHAR(160) NOT NULL
    CHECK (created_by_actor_key = BTRIM(created_by_actor_key) AND created_by_actor_key <> ''),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (qr_code_id, version)
);

CREATE INDEX idx_platform_qr_card_designs_latest
  ON platform_qr_card_designs(qr_code_id, version DESC);
