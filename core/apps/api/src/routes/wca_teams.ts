import { Hono } from 'hono';
import { query, withTransaction } from '../db/connection.js';
import { requireAdminOrApiKey } from '../utils/recon_helpers.js';
import { normalizeWcaId, parseTeacherLookupIds } from '../utils/wca_teachers.js';
import { wcaTeamFilter } from '../utils/wca_relation_filters.js';
import { FINAL_ROUND_TYPES, RANK_EVENTS } from '../utils/person_page.js';

export const wcaTeamRoutes = new Hono();
const cubeRankIndex = RANK_EVENTS.indexOf('333') + 1;
const finalRoundSql = [...FINAL_ROUND_TYPES].map(type => `'${type}'`).join(',');

wcaTeamRoutes.get('/wca/teams', async (c) => {
  const ids = parseTeacherLookupIds(c.req.query('persons'));
  if (ids === null) return c.json({ error: 'invalid persons' }, 400);
  c.header('Cache-Control', 'no-store');
  if (c.req.query('directory') === '1') {
    const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10) || 1);
    const size = Math.min(100, Math.max(1, parseInt(c.req.query('size') ?? '50', 10) || 50));
    const search = (c.req.query('q') ?? '').trim().slice(0, 100);
    const relation = wcaTeamFilter(c.req.query('team') ?? '', 'a.team_id');
    const where = `WHERE TRUE${relation.sql}${search ? ' AND (COALESCE(s.name, a.name) ILIKE ? OR a.wca_id ILIKE ?)' : ''}`;
    const params = [...relation.params, ...(search ? [`%${search}%`, `%${search}%`] : [])];
    const [teams, members, total] = await Promise.all([
      query<{ id: number; name: string; count: number }>(`SELECT t.id, t.name, COUNT(a.member_id)::int AS count FROM wca_teams t LEFT JOIN wca_person_teams a ON a.team_id = t.id GROUP BY t.id ORDER BY t.id`),
      query(`WITH members AS (
          SELECT DISTINCT ON (COALESCE(a.wca_id, '@' || a.member_id)) a.*
          FROM wca_person_teams a LEFT JOIN wca_persons s ON s.wca_id = a.wca_id
          ${where} ORDER BY COALESCE(a.wca_id, '@' || a.member_id), a.member_id
        )
        SELECT a.member_id AS "memberId", a.wca_id AS "wcaId", COALESCE(s.name, a.name, a.wca_id) AS name, co.iso2, t.id AS "teamId", t.name AS "teamName",
          (SELECT json_agg(json_build_object('id', mt.id, 'name', mt.name) ORDER BY mt.id)
           FROM wca_person_teams ma JOIN wca_teams mt ON mt.id = ma.team_id
           WHERE ma.wca_id = a.wca_id OR (a.wca_id IS NULL AND ma.member_id = a.member_id)) AS teams,
          best.average AS "bestAverage", best.single AS "bestSingle",
          best.competitions AS "competitionCount", best.wins AS "championshipCount",
          NULLIF(sr.ranks_world[${cubeRankIndex}], 0) AS "singleWorldRank",
          NULLIF(ar.ranks_world[${cubeRankIndex}], 0) AS "averageWorldRank"
        FROM members a LEFT JOIN wca_persons s ON s.wca_id = a.wca_id JOIN wca_teams t ON t.id = a.team_id
        LEFT JOIN wca_countries co ON co.id = s.country_id
        LEFT JOIN wca_person_ranks sr ON sr.wca_id = s.wca_id AND sr.is_avg = FALSE
        LEFT JOIN wca_person_ranks ar ON ar.wca_id = s.wca_id AND ar.is_avg = TRUE
        LEFT JOIN LATERAL (
          SELECT MIN(average) FILTER (WHERE event_id = '333' AND average > 0) AS average,
            MIN(best) FILTER (WHERE event_id = '333' AND best > 0) AS single,
            COUNT(DISTINCT comp_id)::int AS competitions,
            COUNT(*) FILTER (WHERE round_type_id IN (${finalRoundSql}) AND pos = 1)::int AS wins
          FROM wca_person_results r WHERE r.wca_id = s.wca_id
        ) best ON TRUE
        ORDER BY best.average ASC NULLS LAST, a.wca_id ASC NULLS LAST, a.member_id LIMIT ? OFFSET ?`, [...params, size, (page - 1) * size]),
      query<{ count: number }>(`SELECT COUNT(DISTINCT COALESCE(a.wca_id, '@' || a.member_id))::int AS count FROM wca_person_teams a LEFT JOIN wca_persons s ON s.wca_id = a.wca_id ${where}`, params),
    ]);
    return c.json({ teams, members, total: total[0]?.count ?? 0, page, size });
  }
  const teams = await query<{ id: number; name: string }>('SELECT id, name FROM wca_teams ORDER BY id');
  const assignments = ids.length ? await query<{ wcaId: string; teamId: number }>(
    'SELECT wca_id AS "wcaId", team_id AS "teamId" FROM wca_person_teams WHERE wca_id IN (' + ids.map(() => '?').join(',') + ') ORDER BY wca_id, team_id', ids,
  ) : [];
  return c.json({ teams, assignments });
});

wcaTeamRoutes.post('/wca/teams/members', async (c) => {
  await requireAdminOrApiKey(c);
  c.header('Cache-Control', 'no-store');
  const body = await c.req.json<{ name?: unknown; teamId?: unknown }>().catch(() => null);
  if (!body || typeof body.name !== 'string' || typeof body.teamId !== 'number'
    || !Number.isInteger(body.teamId) || body.teamId < 1 || body.teamId > 2147483647) {
    return c.json({ error: 'invalid member' }, 400);
  }
  const name = body.name.replace(/\s+/g, ' ').trim();
  if (!name || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name)) return c.json({ error: 'invalid member name' }, 400);
  // Names are not identifiers: two teammates can share a name. Retain the
  // returned memberId for later updates instead of merging people by name.
  const members = await query(
    `INSERT INTO wca_person_teams (name, team_id)
     SELECT ?, id FROM wca_teams WHERE id = ?
     RETURNING member_id AS "memberId", wca_id AS "wcaId", name, team_id AS "teamId"`, [name, body.teamId],
  );
  if (!members.length) return c.json({ error: 'team not found' }, 404);
  return c.json({ member: members[0] }, 201);
});

wcaTeamRoutes.put('/wca/teams/:wcaId', async (c) => {
  await requireAdminOrApiKey(c);
  c.header('Cache-Control', 'no-store');
  const wcaId = normalizeWcaId(c.req.param('wcaId'));
  if (!wcaId) return c.json({ error: 'invalid WCA ID' }, 400);
  const body = await c.req.json<{ names?: unknown }>().catch(() => null);
  // Reject the old singular payload: an old editor must not erase extra memberships.
  if (!body || !Array.isArray(body.names) || body.names.length > 20
    || body.names.some(name => typeof name !== 'string')) return c.json({ error: 'invalid team names' }, 400);
  const names = (body.names as string[]).map(name => name.replace(/\s+/g, ' ').trim());
  if (names.some(name => !name || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name))) {
    return c.json({ error: 'invalid team name' }, 400);
  }
  const uniqueNames = [...new Map(names.map(name => [name.toLowerCase(), name])).values()]
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const teams = await withTransaction(async tx => {
    // Serialize edits for one person, including when they currently have no team.
    const people = await tx('SELECT wca_id FROM wca_persons WHERE wca_id = ? FOR UPDATE', [wcaId]);
    if (!people.length) return null;
    const selected: Array<{ id: number; name: string }> = [];
    for (const name of uniqueNames) {
      const [team] = await tx<{ id: number; name: string }>(
        `INSERT INTO wca_teams (name) VALUES (?)
         ON CONFLICT (lower(name)) DO UPDATE SET name = wca_teams.name RETURNING id, name`, [name]);
      selected.push(team);
    }
    await tx('DELETE FROM wca_person_teams WHERE wca_id = ?'
      + (selected.length ? ' AND team_id NOT IN (' + selected.map(() => '?').join(',') + ')' : ''),
    [wcaId, ...selected.map(team => team.id)]);
    for (const team of selected) {
      await tx(`INSERT INTO wca_person_teams (wca_id, team_id) VALUES (?, ?)
        ON CONFLICT (wca_id, team_id) DO NOTHING`, [wcaId, team.id]);
    }
    return selected.sort((a, b) => a.id - b.id);
  });
  if (!teams) return c.json({ error: 'person not found' }, 404);
  return c.json({ teams });
});
