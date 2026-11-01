import { Hono } from 'hono';
import { query } from '../db/connection.js';
import { getIp } from '../utils/analytics_helpers.js';
import { checkRateLimit, requireAdminOrApiKey } from '../utils/recon_helpers.js';

export const compAbsencesRoutes = new Hono();

function competitionId(raw: string): string | null {
  return /^[A-Za-z0-9_-]{1,128}$/.test(raw) ? raw.replaceAll('-', '').toLowerCase() || null : null;
}

compAbsencesRoutes.get('/comp/:compId/absences', async c => {
  c.header('Cache-Control', 'no-store');
  const compId = competitionId(c.req.param('compId'));
  if (!compId) return c.json({ error: 'Invalid competition ID' }, 400);
  const rows = await query<{ wca_id: string }>(
    'SELECT wca_id FROM comp_absences WHERE comp_id = ? AND active = TRUE ORDER BY wca_id', [compId],
  );
  return c.json({ wcaIds: rows.map(row => row.wca_id) });
});

compAbsencesRoutes.on(['PUT', 'DELETE'], '/comp/:compId/absences/:wcaId', async c => {
  c.header('Cache-Control', 'no-store');
  const admin = await requireAdminOrApiKey(c);
  checkRateLimit(getIp(c), { bucket: 'comp-absences-write', max: 60 });
  const compId = competitionId(c.req.param('compId'));
  const wcaId = c.req.param('wcaId').toUpperCase();
  if (!compId || !/^\d{4}[A-Z]{4}\d{2}$/.test(wcaId)) return c.json({ error: 'Invalid competition or WCA ID' }, 400);
  const via = admin.wcaId === '__api_key__' ? 'api_key' : 'admin';
  if (c.req.method === 'PUT') {
    await query(`INSERT INTO comp_absences (comp_id, wca_id, updated_by, updated_via)
      VALUES (?, ?, ?, ?)
      ON CONFLICT (comp_id, wca_id) DO UPDATE
      SET active = TRUE, updated_by = EXCLUDED.updated_by, updated_via = EXCLUDED.updated_via, updated_at = NOW()`,
    [compId, wcaId, admin.uid ?? null, via]);
  } else {
    await query(`UPDATE comp_absences SET active = FALSE, updated_by = ?, updated_via = ?, updated_at = NOW()
      WHERE comp_id = ? AND wca_id = ?`, [admin.uid ?? null, via, compId, wcaId]);
  }
  return c.json({ ok: true });
});
