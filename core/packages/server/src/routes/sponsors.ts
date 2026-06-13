/**
 * /v1/sponsors — 致谢/赞助墙 (admin 录入) API。
 *   - GET    /v1/sponsors        — 全表,按金额降序(1h cache),前端一次拉完
 *   - POST   /v1/sponsors        — admin 新增
 *   - PUT    /v1/sponsors/:id     — admin 编辑
 *   - DELETE /v1/sponsors/:id     — admin 删
 *
 * 鉴权走 requireAdminOrApiKey(WCA OAuth Bearer 或 X-Admin-Key)。
 * Schema 见 migrations/0043_sponsors.sql。
 */
import { Hono } from 'hono';
import { query } from '../db/connection.js';
import { requireAdminOrApiKey, checkRateLimit } from '../utils/recon_helpers.js';

export const sponsorsRoutes = new Hono();

const WCA_ID_RE = /^\d{4}[A-Z]{4}\d{2}$/;
const NAME_MAX = 200;
const URL_MAX = 2000;
const MSG_MAX = 500;
const AMOUNT_MAX = 99_999_999;
const CURRENCIES = new Set(['CNY', 'USD', 'EUR']);

interface SponsorRow {
  id: number | string;
  name: string;
  wca_id: string | null;
  avatar_url: string | null;
  amount: string | number;
  currency: string;
  message: string | null;
}

function rowToJson(r: SponsorRow): Record<string, unknown> {
  const o: Record<string, unknown> = {
    id: Number(r.id),
    name: r.name,
    amount: Number(r.amount),
    currency: r.currency,
  };
  if (r.wca_id) o.wcaId = r.wca_id;
  if (r.avatar_url) o.avatarUrl = r.avatar_url;
  if (r.message) o.message = r.message;
  return o;
}

function getIp(c: { req: { header: (n: string) => string | undefined } }): string {
  return c.req.header('X-Real-IP') ?? c.req.header('X-Forwarded-For') ?? '0.0.0.0';
}

interface SponsorInput {
  name?: string;
  wcaId?: string | null;
  avatarUrl?: string | null;
  amount?: number;
  currency?: string | null;
  message?: string | null;
}

interface NormalizedSponsor {
  name: string;
  wca_id: string | null;
  avatar_url: string | null;
  amount: number;
  currency: string;
  message: string | null;
}

function validateAndNormalize(b: SponsorInput): { error: string } | { value: NormalizedSponsor } {
  if (typeof b.name !== 'string' || !b.name.trim()) return { error: 'name required' };
  if (b.name.length > NAME_MAX) return { error: 'name too long' };

  const amount = Number(b.amount);
  if (!Number.isFinite(amount) || amount < 0) return { error: 'amount must be a non-negative number' };
  if (amount > AMOUNT_MAX) return { error: 'amount too large' };

  let wca_id: string | null = null;
  if (b.wcaId != null && b.wcaId !== '') {
    if (typeof b.wcaId !== 'string') return { error: 'wcaId must be a string' };
    wca_id = b.wcaId.trim().toUpperCase();
    if (!WCA_ID_RE.test(wca_id)) return { error: 'invalid WCA ID' };
  }

  let avatar_url: string | null = null;
  if (b.avatarUrl != null && b.avatarUrl !== '') {
    if (typeof b.avatarUrl !== 'string') return { error: 'avatarUrl must be a string' };
    avatar_url = b.avatarUrl.trim();
    if (avatar_url.length > URL_MAX) return { error: 'avatarUrl too long' };
    if (!/^https?:\/\//i.test(avatar_url)) return { error: 'avatarUrl must be http(s)' };
  }

  let currency = 'CNY';
  if (b.currency != null && b.currency !== '') {
    if (typeof b.currency !== 'string') return { error: 'currency must be a string' };
    currency = b.currency.trim().toUpperCase();
    if (!CURRENCIES.has(currency)) return { error: 'unsupported currency' };
  }

  let message: string | null = null;
  if (b.message != null && b.message !== '') {
    if (typeof b.message !== 'string') return { error: 'message must be a string' };
    message = b.message.trim();
    if (message.length > MSG_MAX) return { error: 'message too long' };
  }

  return { value: { name: b.name.trim(), wca_id, avatar_url, amount, currency, message } };
}

// GET /v1/sponsors — 全表,金额降序
sponsorsRoutes.get('/sponsors', async (c) => {
  c.header('Cache-Control', 'public, max-age=3600');
  const rows = await query<SponsorRow>(
    'SELECT * FROM sponsors ORDER BY amount DESC, created_at',
  );
  return c.json(rows.map(rowToJson));
});

// POST /v1/sponsors — 新增
sponsorsRoutes.post('/sponsors', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  await requireAdminOrApiKey(c);

  const res = validateAndNormalize(await c.req.json<SponsorInput>());
  if ('error' in res) return c.json({ error: res.error }, 400);
  const f = res.value;

  const inserted = await query<SponsorRow>(
    `INSERT INTO sponsors (name, wca_id, avatar_url, amount, currency, message)
     VALUES (?, ?, ?, ?, ?, ?)
     RETURNING *`,
    [f.name, f.wca_id, f.avatar_url, f.amount, f.currency, f.message],
  );
  return c.json(rowToJson(inserted[0]));
});

// PUT /v1/sponsors/:id — 编辑
sponsorsRoutes.put('/sponsors/:id', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  await requireAdminOrApiKey(c);

  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: 'invalid id' }, 400);

  const res = validateAndNormalize(await c.req.json<SponsorInput>());
  if ('error' in res) return c.json({ error: res.error }, 400);
  const f = res.value;

  const updated = await query<SponsorRow>(
    `UPDATE sponsors SET
       name = ?, wca_id = ?, avatar_url = ?, amount = ?, currency = ?, message = ?
     WHERE id = ?
     RETURNING *`,
    [f.name, f.wca_id, f.avatar_url, f.amount, f.currency, f.message, id],
  );
  if (updated.length === 0) return c.json({ error: 'Not found' }, 404);
  return c.json(rowToJson(updated[0]));
});

// DELETE /v1/sponsors/:id
sponsorsRoutes.delete('/sponsors/:id', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  await requireAdminOrApiKey(c);

  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: 'invalid id' }, 400);

  const deleted = await query<{ id: number | string }>(
    'DELETE FROM sponsors WHERE id = ? RETURNING id',
    [id],
  );
  if (deleted.length === 0) return c.json({ error: 'Not found' }, 404);
  return c.json({ ok: true });
});
