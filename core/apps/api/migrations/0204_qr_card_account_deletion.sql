-- Preserve immutable QR card design history while severing deleted-account identity.

CREATE OR REPLACE FUNCTION trg_platform_qr_card_designs_account_delete() RETURNS TRIGGER AS $$
DECLARE
  owner_key TEXT := COALESCE(NULLIF(OLD.wca_id, ''), 'u' || OLD.id::TEXT);
  tombstone TEXT := 'deleted:' || OLD.id::TEXT;
BEGIN
  UPDATE platform_qr_card_designs
  SET created_by_user_id = NULL,
      created_by_actor_key = tombstone
  WHERE created_by_user_id = OLD.id OR created_by_actor_key = owner_key;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER platform_qr_card_designs_prepare_account_delete
  BEFORE DELETE ON app_users
  FOR EACH ROW EXECUTE FUNCTION trg_platform_qr_card_designs_account_delete();
