CREATE TABLE home_card_positions (
  group_id    VARCHAR(20) NOT NULL,
  item_id     VARCHAR(64) NOT NULL,
  position    INTEGER NOT NULL CHECK (position >= 0),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, item_id)
);

CREATE TRIGGER home_card_positions_updated_at
  BEFORE UPDATE ON home_card_positions
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

COMMENT ON TABLE home_card_positions IS
  'Admin-defined card order for each homepage directory group.';
