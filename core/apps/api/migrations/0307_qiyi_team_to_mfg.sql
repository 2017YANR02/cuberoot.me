-- Maintainer confirmed on 2026-11-02: rename the whole QiYi team to MFG,
-- including Yang Pin Xiu. Keep the original team ID and every membership.
-- A separately created MFG catalog entry, if present, is merged into that ID.
DO $$
DECLARE
  qiyi_id integer;
  mfg_id integer;
BEGIN
  LOCK TABLE wca_teams, wca_person_teams IN SHARE ROW EXCLUSIVE MODE;
  SELECT id INTO qiyi_id FROM wca_teams WHERE name = '奇艺';
  SELECT id INTO mfg_id FROM wca_teams WHERE lower(name) = 'mfg';
  IF qiyi_id IS NOT NULL THEN
    IF mfg_id IS NOT NULL THEN
      UPDATE wca_person_teams SET team_id = qiyi_id, updated_at = NOW() WHERE team_id = mfg_id;
      DELETE FROM wca_teams WHERE id = mfg_id;
    END IF;
    UPDATE wca_teams SET name = 'MFG' WHERE id = qiyi_id;
  ELSIF mfg_id IS NULL THEN
    INSERT INTO wca_teams (name) VALUES ('MFG');
  END IF;
END $$;
