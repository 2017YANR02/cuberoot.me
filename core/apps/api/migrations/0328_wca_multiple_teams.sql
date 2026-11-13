-- A cuber may have both a manufacturer team and a retailer sponsorship.
-- Preserve every existing member_id, name and team assignment.
ALTER TABLE wca_person_teams DROP CONSTRAINT wca_person_teams_wca_id_unique;
ALTER TABLE wca_person_teams ADD CONSTRAINT wca_person_teams_person_team_unique UNIQUE (wca_id, team_id);
