-- Maintainer confirmed on 2026-11-10: DianSheng has one member, 张安宇.
-- WCA name search returned one candidate: Anyu Zhang (张安宇), 2012ZHAN08.
-- Verified 333 best valid average: 825 centiseconds. No homonym tie to resolve.
-- Sources: https://www.worldcubeassociation.org/persons/2012ZHAN08
-- GET /v1/recon/search-solvers?q=张安宇
-- GET /v1/wca/person-page?wcaId=2012ZHAN08
-- At verification, he had no team assignment and DianSheng had no members.
-- Leave YongJun and all other member assignments unchanged.
INSERT INTO wca_person_teams (wca_id, team_id)
SELECT '2012ZHAN08', id FROM wca_teams WHERE name = '点盛'
ON CONFLICT (wca_id) DO UPDATE
SET team_id = EXCLUDED.team_id, updated_at = NOW()
WHERE wca_person_teams.team_id IS DISTINCT FROM EXCLUDED.team_id;
