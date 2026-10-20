import { Hono } from 'hono';
import { normalizeMac } from '@cuberoot/shared/timer/external/mac';
import { query } from '../db/connection.js';
import { requireAuth, checkRateLimit } from '../utils/recon_helpers.js';
import { getIp } from '../utils/analytics_helpers.js';
import { publicUserIdsForOwnerKeys } from '../utils/account.js';

export const smartCubeMacRoutes = new Hono();

smartCubeMacRoutes.use('/smart-cube/macs', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  await next();
});

smartCubeMacRoutes.get('/smart-cube/macs', async c => {
  const user = await requireAuth(c);
  const id = (await publicUserIdsForOwnerKeys([user.wcaId])).get(user.wcaId);
  if (!id) return c.json({ error: 'Account not found' }, 404);
  const rows = await query<{ items: Record<string, string> }>(
    'SELECT items FROM smart_cube_macs WHERE user_id = ?', [id],
  );
  return c.json({ items: rows[0]?.items ?? {} });
});

// Merge individual devices atomically; null removes an invalidated address.
smartCubeMacRoutes.patch('/smart-cube/macs', async c => {
  const user = await requireAuth(c);
  const id = (await publicUserIdsForOwnerKeys([user.wcaId])).get(user.wcaId);
  if (!id) return c.json({ error: 'Account not found' }, 404);
  const body = await c.req.json().catch(() => null);
  const raw = body?.items;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).length > 100) {
    return c.json({ error: 'Invalid device map' }, 400);
  }
  const items = Object.create(null) as Record<string, string | null>;
  for (const [name, value] of Object.entries(raw)) {
    if (!name || name.length > 256 || /[\x00-\x1f\x7f]/.test(name)
      || (value !== null && (typeof value !== 'string' || !normalizeMac(value)))) {
      return c.json({ error: 'Invalid device address' }, 400);
    }
    items[name] = value === null ? null : normalizeMac(value as string);
  }
  await query(`INSERT INTO smart_cube_macs (user_id, items) VALUES (?, jsonb_strip_nulls(?::jsonb))
    ON CONFLICT (user_id) DO UPDATE
    SET items = jsonb_strip_nulls(smart_cube_macs.items || ?::jsonb)`, [id, items, items]);
  return c.json({ ok: true });
});
