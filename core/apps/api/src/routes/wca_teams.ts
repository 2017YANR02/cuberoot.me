import { Hono } from 'hono';
import { query } from '../db/connection.js';
import { requireAdminOrApiKey } from '../utils/recon_helpers.js';
import { normalizeWcaId, parseTeacherLookupIds } from '../utils/wca_teachers.js';
import { wcaRelationFilter } from '../utils/wca_relation_filters.js';

export const wcaTeamRoutes = new Hono();

wcaTeamRoutes.get('/wca/teams', async (c) => {
  const ids = parseTeacherLookupIds(c.req.query('persons'));
  if (ids === null) return c.json({ error: 'invalid persons' }, 400);
  c.header('Cache-Control', 'no-store');
  if (c.req.query('directory') === '1') {
    const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10) || 1);
    const size = Math.min(100, Math.max(1, parseInt(c.req.query('size') ?? '50', 10) || 50));
    const search = (c.req.query('q') ?? '').trim().slice(0, 100);
    const relation = wcaRelationFilter(key => key === 'team' ? c.req.query(key) : undefined, 's.wca_id', []);
    const where = `WHERE TRUE${relation.sql}${search ? ' AND (s.name ILIKE ? OR s.wca_id ILIKE ?)' : ''}`;
    const params = [...relation.params, ...(search ? [`%${search}%`, `%${search}%`] : [])];
    const [teams, members, total] = await Promise.all([
      query<{ id: number; name: string; count: number }>(`SELECT t.id, t.name, COUNT(a.wca_id)::int AS count FROM wca_teams t LEFT JOIN wca_person_teams a ON a.team_id = t.id GROUP BY t.id ORDER BY t.id`),
      query(`SELECT s.wca_id AS "wcaId", s.name, co.iso2, t.id AS "teamId", t.name AS "teamName", best.average AS "bestAverage"
        FROM wca_person_teams a JOIN wca_persons s ON s.wca_id = a.wca_id JOIN wca_teams t ON t.id = a.team_id
        LEFT JOIN wca_countries co ON co.id = s.country_id
        LEFT JOIN LATERAL (SELECT MIN(average) AS average FROM wca_person_results r WHERE r.wca_id = s.wca_id AND r.event_id = '333' AND average > 0) best ON TRUE
        ${where} ORDER BY best.average ASC NULLS LAST, s.wca_id LIMIT ? OFFSET ?`, [...params, size, (page - 1) * size]),
      query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM wca_person_teams a JOIN wca_persons s ON s.wca_id = a.wca_id ${where}`, params),
    ]);
    return c.json({ teams, members, total: total[0]?.count ?? 0, page, size });
  }
  const teams = await query<{ id: number; name: string }>('SELECT id, name FROM wca_teams ORDER BY id');
  const assignments = ids.length ? await query<{ wcaId: string; teamId: number }>(
    'SELECT wca_id AS "wcaId", team_id AS "teamId" FROM wca_person_teams WHERE wca_id IN (' + ids.map(() => '?').join(',') + ')', ids,
  ) : [];
  return c.json({ teams, assignments });
});

wcaTeamRoutes.put('/wca/teams/:wcaId', async (c) => {
  await requireAdminOrApiKey(c);
  c.header('Cache-Control', 'no-store');
  const wcaId = normalizeWcaId(c.req.param('wcaId'));
  if (!wcaId) return c.json({ error: 'invalid WCA ID' }, 400);
  const body = await c.req.json<{ name?: unknown }>().catch(() => null);
  if (!body || typeof body.name !== 'string') return c.json({ error: 'invalid team name' }, 400);
  const name = body.name.replace(/\s+/g, ' ').trim();
  if (name.length > 80 || /[\u0000-\u001f\u007f]/.test(name)) return c.json({ error: 'invalid team name' }, 400);
  const people = await query('SELECT wca_id FROM wca_persons WHERE wca_id = ?', [wcaId]);
  if (!people.length) return c.json({ error: 'person not found' }, 404);
  if (!name) {
    await query('DELETE FROM wca_person_teams WHERE wca_id = ?', [wcaId]);
    return c.json({ team: null });
  }
  // One statement keeps custom-team creation and assignment atomic, including concurrent saves.
  const teams = await query<{ id: number; name: string }>(
    `WITH team AS (
       INSERT INTO wca_teams (name) VALUES (?)
       ON CONFLICT (lower(name)) DO UPDATE SET name = wca_teams.name
       RETURNING id, name
     ), assignment AS (
       INSERT INTO wca_person_teams (wca_id, team_id) SELECT ?, id FROM team
       ON CONFLICT (wca_id) DO UPDATE SET team_id = EXCLUDED.team_id, updated_at = NOW()
     ) SELECT id, name FROM team`, [name, wcaId],
  );
  return c.json({ team: teams[0] });
});
