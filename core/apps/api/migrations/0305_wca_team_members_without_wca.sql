-- Team membership does not require a WCA competition record. Keep the existing
-- assignment table and its WCA uniqueness contract; give every member an ID.
ALTER TABLE wca_person_teams ADD COLUMN member_id SERIAL;
ALTER TABLE wca_person_teams ADD COLUMN name VARCHAR(80);
ALTER TABLE wca_person_teams DROP CONSTRAINT wca_person_teams_pkey;
ALTER TABLE wca_person_teams ALTER COLUMN wca_id DROP NOT NULL;
ALTER TABLE wca_person_teams ADD PRIMARY KEY (member_id);
ALTER TABLE wca_person_teams ADD CONSTRAINT wca_person_teams_wca_id_unique UNIQUE (wca_id);
ALTER TABLE wca_person_teams ADD CONSTRAINT wca_person_teams_identity_check
  CHECK (wca_id IS NOT NULL OR (name IS NOT NULL AND length(btrim(name)) > 0));
