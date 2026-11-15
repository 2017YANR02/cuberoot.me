-- Workspace has one organization-wide scope. Preserve every report, checklist and schedule.
-- Multiple old project reports on the same day remain separate records; do not merge or delete them.
CREATE OR REPLACE FUNCTION workspace_prepare_account_delete() RETURNS trigger LANGUAGE plpgsql AS $$
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

UPDATE workspace_revisions SET snapshot = snapshot - 'projectId' - 'projectName' - 'projectActive';
DELETE FROM workspace_audit WHERE action = 'project.save';
ALTER TABLE workspace_reports DROP COLUMN project_id;
ALTER TABLE workspace_checklists DROP COLUMN project_id;
ALTER TABLE workspace_schedules DROP COLUMN project_id;
DROP TABLE workspace_project_members;
DROP TABLE workspace_projects;
CREATE INDEX workspace_reports_member_date ON workspace_reports(member_id, work_date);
