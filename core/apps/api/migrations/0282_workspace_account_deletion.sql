-- Preserve submitted team history while removing private account data.
ALTER TABLE workspace_members ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE workspace_members DROP CONSTRAINT workspace_members_user_id_fkey;
ALTER TABLE workspace_members ADD CONSTRAINT workspace_members_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE SET NULL;

CREATE FUNCTION workspace_prepare_account_delete() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE member_key INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(2812026);
  SELECT id INTO member_key FROM workspace_members WHERE user_id = OLD.id FOR UPDATE;
  IF member_key IS NOT NULL THEN
    -- Revision history can contain private drafts even after submission.
    DELETE FROM workspace_revisions WHERE report_id IN
      (SELECT id FROM workspace_reports WHERE member_id = member_key);
    DELETE FROM workspace_comments WHERE report_id IN
      (SELECT id FROM workspace_reports WHERE member_id = member_key AND status = 'draft');
    DELETE FROM workspace_reports WHERE member_id = member_key AND status = 'draft';
    DELETE FROM workspace_project_members WHERE member_id = member_key;
    UPDATE workspace_members SET active = FALSE, name = '—' WHERE id = member_key;
    UPDATE workspace_comments SET name = '—' WHERE actor = 'staff:' || member_key::text;
  END IF;
  UPDATE workspace_comments SET actor = 'deleted-admin:' || OLD.id::text, name = '—'
    WHERE actor = 'admin:' || OLD.id::text;
  UPDATE workspace_audit SET actor = 'deleted-admin:' || OLD.id::text
    WHERE actor = 'admin:' || OLD.id::text;
  RETURN OLD;
END;
$$;
CREATE TRIGGER workspace_prepare_account_delete BEFORE DELETE ON app_users
  FOR EACH ROW EXECUTE FUNCTION workspace_prepare_account_delete();
