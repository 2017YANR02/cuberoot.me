import { Hono } from 'hono';
import { z } from 'zod';

// Fixed read-only origin: never forward cookies, authorization or arbitrary URLs.
// RecordRanks owns its data, result formats and ranking calculations.
const query = z.object({
  view: z.enum(['catalog', 'competitions', 'contest', 'rankings', 'records', 'persons', 'person']),
  event: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/).optional(),
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,120}$/).optional(),
  region: z.string().regex(/^[A-Z]{2}$/).optional(),
  group: z.string().regex(/^[a-z0-9-]{1,40}$/).optional(),
  category: z.enum(['competitions', 'meetups', 'online']).optional(),
  type: z.enum(['single', 'average', 'all-avg-formats']).optional(),
  q: z.string().trim().max(100).optional(),
  offset: z.coerce.number().int().min(0).max(100000).optional(),
  history: z.enum(['current', 'all']).optional(),
});

export const contestsRoutes = new Hono();
let active = 0;
contestsRoutes.get('/contests', async c => {
  c.header('Cache-Control', 'no-store');
  const parsed = query.safeParse(c.req.query());
  if (!parsed.success) return c.json({ error: 'Invalid Contests query' }, 400);
  if (active >= 12) return c.json({ error: 'Contests is busy; please retry' }, 503);
  const url = new URL('https://contests.cuberoot.me/api/default/cuberoot');
  for (const [key, value] of Object.entries(parsed.data)) if (value !== undefined) url.searchParams.set(key, String(value));
  active++;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000), redirect: 'error', headers: { Accept: 'application/json' } });
    if (!response.ok) return c.json({ error: 'Contests data unavailable' }, response.status === 404 ? 404 : response.status === 400 ? 400 : 502);
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Invalid response');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Empty response');
    let size = 0;
    const chunks: Uint8Array[] = [];
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 8 * 1024 * 1024) throw new Error('Response too large');
        chunks.push(value);
      }
    } finally { await reader.cancel(); }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || !Object.hasOwn(body, 'data')) throw new Error('Invalid response');
    // Empty responses remain immediately retryable after the daily import.
    if (!Array.isArray(body.data) || body.data.length) c.header('Cache-Control', 'public, max-age=300, s-maxage=300');
    return c.json(body);
  } catch {
    return c.json({ error: 'Contests data unavailable' }, 502);
  } finally { active--; }
});
