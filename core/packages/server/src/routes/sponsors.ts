/**
 * /v1/sponsors + /v1/contributors — /support 致谢墙 (admin 录入) API。
 *   - GET    /v1/sponsors             — 全表,按金额降序(1h cache),前端一次拉完
 *   - POST   /v1/sponsors             — admin 新增
 *   - PUT    /v1/sponsors/:id          — admin 编辑
 *   - DELETE /v1/sponsors/:id          — admin 删
 *   - GET    /v1/contributors         — 全表,按 score 降序(1h cache)
 *   - POST   /v1/contributors         — admin 新增
 *   - PUT    /v1/contributors/:id      — admin 编辑
 *   - POST   /v1/contributors/:id/bump — admin score 原子 +1(issue #28:点数字自增)
 *   - DELETE /v1/contributors/:id
 *
 * 鉴权走 requireAdminOrApiKey(WCA OAuth Bearer 或 X-Admin-Key)。
 * Schema 见 migrations/0043_sponsors.sql + 0075_contributors.sql。
 */
import { Hono } from 'hono';
import { getIp } from '../utils/analytics_helpers.js';
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

// wcaId / avatarUrl 可选字段校验 —— sponsors 与 contributors 共用。
function parseWcaId(v: unknown): { error: string } | { value: string | null } {
  if (v == null || v === '') return { value: null };
  if (typeof v !== 'string') return { error: 'wcaId must be a string' };
  const wca_id = v.trim().toUpperCase();
  if (!WCA_ID_RE.test(wca_id)) return { error: 'invalid WCA ID' };
  return { value: wca_id };
}

function parseAvatarUrl(v: unknown): { error: string } | { value: string | null } {
  if (v == null || v === '') return { value: null };
  if (typeof v !== 'string') return { error: 'avatarUrl must be a string' };
  const avatar_url = v.trim();
  if (avatar_url.length > URL_MAX) return { error: 'avatarUrl too long' };
  if (!/^https?:\/\//i.test(avatar_url)) return { error: 'avatarUrl must be http(s)' };
  return { value: avatar_url };
}

function validateAndNormalize(b: SponsorInput): { error: string } | { value: NormalizedSponsor } {
  if (typeof b.name !== 'string' || !b.name.trim()) return { error: 'name required' };
  if (b.name.length > NAME_MAX) return { error: 'name too long' };

  const amount = Number(b.amount);
  if (!Number.isFinite(amount) || amount < 0) return { error: 'amount must be a non-negative number' };
  if (amount > AMOUNT_MAX) return { error: 'amount too large' };

  const wcaRes = parseWcaId(b.wcaId);
  if ('error' in wcaRes) return wcaRes;
  const wca_id = wcaRes.value;

  const avatarRes = parseAvatarUrl(b.avatarUrl);
  if ('error' in avatarRes) return avatarRes;
  const avatar_url = avatarRes.value;

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

// ══ /v1/contributors — /support 贡献者名单(issue #28)══
// score = 贡献次数,admin 每收到一次反馈/bug/建议点数字 +1(/:id/bump)。

const SCORE_MAX = 1_000_000;
const CONTRIB_ITEMS_MAX = 500;   // 单个贡献者最多明细条数
const CONTRIB_TEXT_MAX = 1000;   // 单条 zh/en 文本上限
const CONTRIB_DATE_MAX = 40;     // 日期/时间标签(自由文本)上限

// 一次贡献的内容明细。存 contributors.contributions(JSONB 数组)。
interface Contribution {
  zh: string;
  en: string;
  date?: string;
}

interface ContributorRow {
  id: number | string;
  name: string;
  wca_id: string | null;
  avatar_url: string | null;
  score: number | string;
  contributions: unknown; // JSONB —— driver 已反序列化成 JS 值
}

function contributorToJson(r: ContributorRow): Record<string, unknown> {
  const o: Record<string, unknown> = {
    id: Number(r.id),
    name: r.name,
    score: Number(r.score),
    contributions: Array.isArray(r.contributions) ? r.contributions : [],
  };
  if (r.wca_id) o.wcaId = r.wca_id;
  if (r.avatar_url) o.avatarUrl = r.avatar_url;
  return o;
}

interface ContributorInput {
  name?: string;
  wcaId?: string | null;
  avatarUrl?: string | null;
  score?: number;
  contributions?: unknown;
}

interface NormalizedContributor {
  name: string;
  wca_id: string | null;
  avatar_url: string | null;
  score: number;
  contributions: Contribution[];
}

// contributions 校验:数组,每项 { zh, en, date? },zh/en 至少一个非空。
function parseContributions(v: unknown): { error: string } | { value: Contribution[] } {
  if (v == null) return { value: [] };
  if (!Array.isArray(v)) return { error: 'contributions must be an array' };
  if (v.length > CONTRIB_ITEMS_MAX) return { error: 'too many contributions' };
  const out: Contribution[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== 'object') return { error: 'contribution must be an object' };
    const o = raw as Record<string, unknown>;
    if (o.zh != null && typeof o.zh !== 'string') return { error: 'contribution.zh must be a string' };
    if (o.en != null && typeof o.en !== 'string') return { error: 'contribution.en must be a string' };
    const zh = typeof o.zh === 'string' ? o.zh.trim() : '';
    const en = typeof o.en === 'string' ? o.en.trim() : '';
    if (!zh && !en) return { error: 'contribution needs zh or en text' };
    if (zh.length > CONTRIB_TEXT_MAX || en.length > CONTRIB_TEXT_MAX) return { error: 'contribution text too long' };
    const item: Contribution = { zh, en };
    if (o.date != null && o.date !== '') {
      if (typeof o.date !== 'string') return { error: 'contribution.date must be a string' };
      const date = o.date.trim();
      if (date.length > CONTRIB_DATE_MAX) return { error: 'contribution date too long' };
      if (date) item.date = date;
    }
    out.push(item);
  }
  return { value: out };
}

function validateContributor(b: ContributorInput): { error: string } | { value: NormalizedContributor } {
  if (typeof b.name !== 'string' || !b.name.trim()) return { error: 'name required' };
  if (b.name.length > NAME_MAX) return { error: 'name too long' };

  let score = 1;
  if (b.score != null) {
    score = Number(b.score);
    if (!Number.isInteger(score) || score < 0) return { error: 'score must be a non-negative integer' };
    if (score > SCORE_MAX) return { error: 'score too large' };
  }

  const wcaRes = parseWcaId(b.wcaId);
  if ('error' in wcaRes) return wcaRes;

  const avatarRes = parseAvatarUrl(b.avatarUrl);
  if ('error' in avatarRes) return avatarRes;

  const contribRes = parseContributions(b.contributions);
  if ('error' in contribRes) return contribRes;

  return {
    value: {
      name: b.name.trim(),
      wca_id: wcaRes.value,
      avatar_url: avatarRes.value,
      score,
      contributions: contribRes.value,
    },
  };
}

// GET /v1/contributors — 全表,score 降序
sponsorsRoutes.get('/contributors', async (c) => {
  c.header('Cache-Control', 'public, max-age=3600');
  const rows = await query<ContributorRow>(
    'SELECT * FROM contributors ORDER BY score DESC, created_at',
  );
  return c.json(rows.map(contributorToJson));
});

// POST /v1/contributors — 新增
sponsorsRoutes.post('/contributors', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  await requireAdminOrApiKey(c);

  const res = validateContributor(await c.req.json<ContributorInput>());
  if ('error' in res) return c.json({ error: res.error }, 400);
  const f = res.value;

  const inserted = await query<ContributorRow>(
    `INSERT INTO contributors (name, wca_id, avatar_url, score, contributions)
     VALUES (?, ?, ?, ?, ?::jsonb)
     RETURNING *`,
    [f.name, f.wca_id, f.avatar_url, f.score, f.contributions],
  );
  return c.json(contributorToJson(inserted[0]));
});

// PUT /v1/contributors/:id — 编辑
sponsorsRoutes.put('/contributors/:id', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  await requireAdminOrApiKey(c);

  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: 'invalid id' }, 400);

  const res = validateContributor(await c.req.json<ContributorInput>());
  if ('error' in res) return c.json({ error: res.error }, 400);
  const f = res.value;

  const updated = await query<ContributorRow>(
    `UPDATE contributors SET
       name = ?, wca_id = ?, avatar_url = ?, score = ?, contributions = ?::jsonb
     WHERE id = ?
     RETURNING *`,
    [f.name, f.wca_id, f.avatar_url, f.score, f.contributions, id],
  );
  if (updated.length === 0) return c.json({ error: 'Not found' }, 404);
  return c.json(contributorToJson(updated[0]));
});

// POST /v1/contributors/:id/bump — score 原子 +1(admin 点卡片上的数字)
sponsorsRoutes.post('/contributors/:id/bump', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  await requireAdminOrApiKey(c);

  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: 'invalid id' }, 400);

  const updated = await query<ContributorRow>(
    'UPDATE contributors SET score = score + 1 WHERE id = ? RETURNING *',
    [id],
  );
  if (updated.length === 0) return c.json({ error: 'Not found' }, 404);
  return c.json(contributorToJson(updated[0]));
});

// DELETE /v1/contributors/:id
sponsorsRoutes.delete('/contributors/:id', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  await requireAdminOrApiKey(c);

  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: 'invalid id' }, 400);

  const deleted = await query<{ id: number | string }>(
    'DELETE FROM contributors WHERE id = ? RETURNING id',
    [id],
  );
  if (deleted.length === 0) return c.json({ error: 'Not found' }, 404);
  return c.json({ ok: true });
});
