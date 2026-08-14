-- 每套公式保存一份用户主公式映射。引用稳定 altId 或规范化公式文本，不复制 case 数据。
CREATE TABLE alg_preferred_algs (
  wca_id     VARCHAR(20) NOT NULL,
  puzzle     VARCHAR(16) NOT NULL,
  set_slug   VARCHAR(32) NOT NULL,
  items      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  updated_at BIGINT      NOT NULL,
  PRIMARY KEY (wca_id, puzzle, set_slug),
  CHECK (jsonb_typeof(items) = 'object')
);
