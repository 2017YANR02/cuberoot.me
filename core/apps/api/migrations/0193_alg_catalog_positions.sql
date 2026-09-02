CREATE TABLE alg_catalog_positions (
  puzzle      VARCHAR(20) NOT NULL,
  item_key    VARCHAR(64) NOT NULL,
  position    INTEGER NOT NULL CHECK (position >= 0),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (puzzle, item_key)
);

CREATE TRIGGER alg_catalog_positions_updated_at
  BEFORE UPDATE ON alg_catalog_positions
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

COMMENT ON TABLE alg_catalog_positions IS
  'Admin-defined card order for alg catalog pages, including virtual entries such as Cross and LSLL.';
