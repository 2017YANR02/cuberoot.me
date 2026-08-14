-- 公式集连拧的用户自定义顺序。case_keys 只存 canonical key，不复制公式内容。
CREATE TABLE alg_chain_orders (
  wca_id     VARCHAR(20) NOT NULL,
  puzzle     VARCHAR(16) NOT NULL,
  set_slug   VARCHAR(32) NOT NULL,
  scope      VARCHAR(96) NOT NULL DEFAULT '',
  case_keys  JSONB       NOT NULL DEFAULT '[]'::jsonb,
  updated_at BIGINT      NOT NULL,
  PRIMARY KEY (wca_id, puzzle, set_slug, scope),
  CHECK (jsonb_typeof(case_keys) = 'array')
);
