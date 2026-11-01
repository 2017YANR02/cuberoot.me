import { Hono } from 'hono';
import { wcaIdToCubingSlug } from '@cuberoot/shared/cubing-slug';
import type { CompetitionGroupAward } from '@cuberoot/shared/cubing-live';
import { query } from '../db/connection.js';
import { readGroupAwards, refreshGroupAwards } from '../utils/competition_group_awards.js';
export const competitionGroupAwardsRoutes = new Hono();
competitionGroupAwardsRoutes.get('/group-awards/competitions/:id', async c => {
  c.header('Cache-Control', 'no-store');
  const id = c.req.param('id');
  const alias = c.req.query('cubingSlug');
  if (!/^[A-Za-z0-9-]{1,120}$/.test(id) || (alias && !/^[A-Za-z0-9-]{1,120}$/.test(alias))) return c.json({ error: 'Invalid competition' }, 400);
  const cached = await readGroupAwards(id);
  if (cached && Date.now() - new Date(cached.fetched_at).getTime() < 300_000) return c.json({ rows: cached.rows, coverage: 'collected', stale: false });
  try {
    const rows = await refreshGroupAwards(cached?.cubing_slug || alias || wcaIdToCubingSlug(id), id);
    if (rows.length) c.header('Cache-Control', 'public, max-age=60');
    return c.json({ rows, coverage: 'collected', stale: false });
  } catch (error) {
    console.warn('[group-awards]', id, (error as Error).message);
    if (cached) return c.json({ rows: cached.rows, coverage: 'collected', stale: true });
    const status = (error as { status?: number }).status;
    return c.json({ error: status === 404 ? 'Category awards unavailable' : 'Category awards source unavailable' }, status === 404 ? 404 : 503);
  }
});
competitionGroupAwardsRoutes.get('/group-awards/persons/:id', async c => {
  c.header('Cache-Control', 'no-store');
  const id = c.req.param('id');
  if (!/^\d{4}[A-Z]{4}\d{2}$/.test(id)) return c.json({ error: 'Invalid WCA ID' }, 400);
  const snapshots = await query<{ rows: CompetitionGroupAward[] }>('SELECT rows FROM competition_group_awards WHERE person_ids @> ARRAY[?]::text[]', [id]);
  const rows = snapshots.flatMap(s => s.rows.filter(r => r.wcaId === id)).sort((a, b) => b.date.localeCompare(a.date) || a.competitionId.localeCompare(b.competitionId) || a.eventId.localeCompare(b.eventId) || a.groupKey.localeCompare(b.groupKey));
  if (rows.length) c.header('Cache-Control', 'public, max-age=60');
  return c.json({ rows, coverage: 'collected', stale: false });
});
