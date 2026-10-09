import { randomBytes } from 'node:crypto';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { query } from '../db/connection.js';
import { getIp } from '../utils/analytics_helpers.js';
import { checkRateLimit, requireAuth } from '../utils/recon_helpers.js';

export const timerReplaySharesRoutes = new Hono();
const MAX_SOLVE_BYTES = 512 * 1024;
const shareBodyLimit = bodyLimit({
  maxSize: MAX_SOLVE_BYTES + 16 * 1024,
  onError: (c) => c.json({ error: 'Replay payload too large' }, 413),
});

function makeId(): string {
  return randomBytes(8).toString('base64url');
}

timerReplaySharesRoutes.post('/timer/replay-shares', shareBodyLimit, async (c) => {
  checkRateLimit(getIp(c));
  const user = await requireAuth(c);
  if (!user.uid) return c.json({ error: 'Account session required' }, 401);
  let body: { solve?: unknown };
  try { body = await c.req.json<{ solve?: unknown }>(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
  if (!body.solve || typeof body.solve !== 'object' || Array.isArray(body.solve)) {
    return c.json({ error: 'solve is required' }, 400);
  }
  const solve = JSON.stringify(body.solve);
  const byteSize = Buffer.byteLength(solve, 'utf8');
  if (byteSize > MAX_SOLVE_BYTES) return c.json({ error: 'Replay payload too large' }, 413);
  const createdAt = Math.floor(Date.now() / 1000);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const id = makeId();
    try {
      await query(
        'INSERT INTO timer_replay_shares (id, user_id, solve, byte_size, created_at) VALUES (?, ?, ?, ?, ?)',
        [id, user.uid, solve, byteSize, createdAt],
      );
      return c.json({ id });
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
  return c.json({ error: 'Could not create replay share' }, 503);
});

timerReplaySharesRoutes.get('/timer/replay-shares/:id', async (c) => {
  const id = c.req.param('id');
  if (!/^[A-Za-z0-9_-]{8,16}$/.test(id)) return c.json({ error: 'Not found' }, 404);
  const rows = await query<{ solve: string }>('SELECT solve FROM timer_replay_shares WHERE id = ?', [id]);
  if (!rows.length) return c.json({ error: 'Not found' }, 404);
  c.header('Cache-Control', 'public, max-age=300, s-maxage=3600');
  try { return c.json({ solve: JSON.parse(rows[0].solve) }); } catch { return c.json({ error: 'Not found' }, 404); }
});
