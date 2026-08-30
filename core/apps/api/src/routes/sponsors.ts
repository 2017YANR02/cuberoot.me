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
import { query, sql } from '../db/connection.js';
import { requireAdminOrApiKey, checkRateLimit } from '../utils/recon_helpers.js';
import { requireAppUserId } from '../utils/app_user_auth.js';
import { adminRecipients, notify } from '../utils/notify.js';
import { evaluateSponsorClaim } from '../utils/sponsor_claim.js';

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
  claimed_by_user_id: number | string | null;
}

function rowToJson(r: SponsorRow): Record<string, unknown> {
  const o: Record<string, unknown> = {
    id: Number(r.id),
    name: r.name,
    amount: Number(r.amount),
    currency: r.currency,
    claimed: r.claimed_by_user_id != null,
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

// ══ /v1/sponsor-claims — 登录用户认领 + 管理员审核 ══

type ClaimStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'revoked';

interface ClaimRow {
  id: number | string;
  sponsor_id: number | string;
  user_id: number | string;
  status: ClaimStatus;
  claimant_note: string | null;
  profile_snapshot: Record<string, unknown> | string;
  review_note: string | null;
  reviewed_at: string | null;
  cancelled_at: string | null;
  revocation_note: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
  sponsor_name: string;
  amount: number | string;
  currency: string;
}

interface AccountProfileRow {
  id: number | string;
  display_name: string;
  wca_id: string | null;
  birth_date: string | null;
  gender: string | null;
  country_iso2: string | null;
}

function noStore(c: Parameters<typeof requireAppUserId>[0]): void {
  c.header('Cache-Control', 'no-store');
}

function parsePositiveId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function normalizeNote(value: unknown, required: boolean): { value: string | null } | { error: string } {
  if (value == null || value === '') {
    return required ? { error: 'note required' } : { value: null };
  }
  if (typeof value !== 'string') return { error: 'note must be a string' };
  const note = value.trim();
  if (required && note.length < 4) return { error: 'note too short' };
  if (note.length > 500) return { error: 'note too long' };
  return { value: note || null };
}

function ownerKey(user: AccountProfileRow): string {
  return user.wca_id || `u${Number(user.id)}`;
}

function claimToJson(row: ClaimRow): Record<string, unknown> {
  const snapshot = typeof row.profile_snapshot === 'string'
    ? JSON.parse(row.profile_snapshot) as Record<string, unknown>
    : row.profile_snapshot;
  return {
    id: Number(row.id),
    sponsorId: Number(row.sponsor_id),
    status: row.status,
    claimantNote: row.claimant_note,
    profileSnapshot: snapshot,
    reviewNote: row.review_note,
    reviewedAt: row.reviewed_at,
    cancelledAt: row.cancelled_at,
    revocationNote: row.revocation_note,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sponsor: {
      name: row.sponsor_name,
      amount: Number(row.amount),
      currency: row.currency,
    },
  };
}

async function claimRows(where: string, params: unknown[]): Promise<ClaimRow[]> {
  return query<ClaimRow>(
    `SELECT sc.*, s.name AS sponsor_name, s.amount, s.currency
       FROM sponsor_claims sc
       JOIN sponsors s ON s.id = sc.sponsor_id
      ${where}
      ORDER BY sc.created_at DESC`,
    params,
  );
}

async function reviewerUserId(wcaId: string): Promise<number | null> {
  if (wcaId === '__api_key__') return null;
  const rows = await query<{ id: number | string }>(
    'SELECT id FROM app_users WHERE upper(wca_id) = upper(?) LIMIT 1',
    [wcaId],
  );
  return rows[0] ? Number(rows[0].id) : null;
}

// GET /v1/sponsor-claims/mine — 当前账号的认领历史。
sponsorsRoutes.get('/sponsor-claims/mine', async (c) => {
  noStore(c);
  const userId = await requireAppUserId(c);
  const rows = await claimRows('WHERE sc.user_id = ?', [userId]);
  return c.json(rows.map(claimToJson));
});

// POST /v1/sponsors/:id/claims — WCA ID 精确匹配自动通过,其他申请进入审核。
sponsorsRoutes.post('/sponsors/:id/claims', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c), { bucket: 'sponsor-claims', max: 10 });
  const userId = await requireAppUserId(c);
  const sponsorId = parsePositiveId(c.req.param('id'));
  if (!sponsorId) return c.json({ error: 'invalid sponsor id', code: 'invalid_id' }, 400);
  const body: { note?: unknown } = await c.req.json<{ note?: unknown }>().catch(() => ({}));
  const note = normalizeNote(body.note, false);
  if ('error' in note) return c.json({ error: note.error, code: 'invalid_note' }, 400);

  const result = await sql.begin(async (tx) => {
    const users = await tx<AccountProfileRow[]>`
      SELECT id, display_name, wca_id, birth_date, gender, country_iso2
        FROM app_users WHERE id = ${userId} FOR UPDATE`;
    const user = users[0];
    if (!user) return { error: 'account not found', code: 'account_missing', status: 404 as const };

    const sponsors = await tx<Array<{
      id: number | string; name: string; wca_id: string | null;
      amount: number | string; currency: string; claimed_by_user_id: number | string | null;
    }>>`
      SELECT id, name, wca_id, amount, currency, claimed_by_user_id
        FROM sponsors WHERE id = ${sponsorId} FOR UPDATE`;
    const sponsor = sponsors[0];
    if (!sponsor) return { error: 'sponsor not found', code: 'not_found', status: 404 as const };
    if (sponsor.claimed_by_user_id != null) {
      return { error: 'sponsor already claimed', code: 'already_claimed', status: 409 as const };
    }

    const active = await tx<Array<{ id: number | string }>>`
      SELECT id FROM sponsor_claims
       WHERE sponsor_id = ${sponsorId} AND status IN ('pending', 'approved')
       LIMIT 1`;
    if (active.length) return { error: 'an active claim already exists', code: 'active_claim', status: 409 as const };

    const eligibility = evaluateSponsorClaim(sponsor.wca_id, user, note.value);
    if ('error' in eligibility) {
      return eligibility.error === 'profile_incomplete'
        ? { error: 'complete your basic profile first', code: eligibility.error, status: 422 as const }
        : { error: 'payment proof note required', code: eligibility.error, status: 422 as const };
    }
    const autoApproved = eligibility.autoApproved;

    const snapshot = {
      displayName: user.display_name,
      wcaId: user.wca_id,
      countryIso2: user.country_iso2,
      profileComplete: Boolean(user.birth_date && user.gender && user.country_iso2),
    };
    const status: ClaimStatus = autoApproved ? 'approved' : 'pending';
    const inserted = await tx<Array<{ id: number | string; created_at: string }>>`
      INSERT INTO sponsor_claims (
        sponsor_id, user_id, status, claimant_note, profile_snapshot, reviewed_at
      ) VALUES (
        ${sponsorId}, ${userId}, ${status}, ${note.value}, ${tx.json(snapshot)},
        CASE WHEN ${autoApproved} THEN NOW() ELSE NULL END
      )
      RETURNING id, created_at`;
    if (autoApproved) {
      await tx`
        UPDATE sponsors
           SET claimed_by_user_id = ${userId}, claimed_at = NOW()
         WHERE id = ${sponsorId}`;
    }
    return {
      claim: {
        id: Number(inserted[0].id), status, autoApproved,
        sponsorName: sponsor.name, amount: Number(sponsor.amount), currency: sponsor.currency,
      },
      user,
    };
  });

  if ('error' in result) return c.json({ error: result.error, code: result.code }, result.status);
  if (!result.claim.autoApproved) {
    await notify({
      recipients: adminRecipients(),
      kind: 'sponsor_claim_pending',
      actorKey: ownerKey(result.user),
      actorName: result.user.display_name || result.user.wca_id || 'CubeRoot user',
      title: result.claim.sponsorName,
      excerpt: note.value || '',
      link: '/support',
    });
  }
  return c.json(result.claim, result.claim.autoApproved ? 201 : 202);
});

// DELETE /v1/sponsor-claims/:id — 申请人只可撤销待审核申请。
sponsorsRoutes.delete('/sponsor-claims/:id', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c), { bucket: 'sponsor-claims', max: 10 });
  const userId = await requireAppUserId(c);
  const claimId = parsePositiveId(c.req.param('id'));
  if (!claimId) return c.json({ error: 'invalid claim id' }, 400);
  const rows = await query<{ id: number | string }>(
    `UPDATE sponsor_claims SET status = 'cancelled', cancelled_at = NOW()
      WHERE id = ? AND user_id = ? AND status = 'pending'
      RETURNING id`,
    [claimId, userId],
  );
  if (!rows.length) return c.json({ error: 'pending claim not found' }, 404);
  return c.json({ ok: true });
});

// GET /v1/sponsor-claims — 管理员审核列表与完整历史。
sponsorsRoutes.get('/sponsor-claims', async (c) => {
  noStore(c);
  await requireAdminOrApiKey(c);
  const rawStatus = c.req.query('status');
  const allowed: ClaimStatus[] = ['pending', 'approved', 'rejected', 'cancelled', 'revoked'];
  if (rawStatus && !allowed.includes(rawStatus as ClaimStatus)) {
    return c.json({ error: 'invalid status' }, 400);
  }
  const rows = await claimRows(rawStatus ? 'WHERE sc.status = ?' : '', rawStatus ? [rawStatus] : []);
  return c.json(rows.map(claimToJson));
});

// POST /v1/sponsor-claims/:id/review — 管理员通过或驳回。
sponsorsRoutes.post('/sponsor-claims/:id/review', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c), { bucket: 'sponsor-claim-review', max: 30 });
  const admin = await requireAdminOrApiKey(c);
  const claimId = parsePositiveId(c.req.param('id'));
  if (!claimId) return c.json({ error: 'invalid claim id' }, 400);
  const body: { decision?: unknown; note?: unknown } = await c.req
    .json<{ decision?: unknown; note?: unknown }>().catch(() => ({}));
  if (body.decision !== 'approve' && body.decision !== 'reject') {
    return c.json({ error: 'decision must be approve or reject' }, 400);
  }
  const note = normalizeNote(body.note, body.decision === 'reject');
  if ('error' in note) return c.json({ error: note.error }, 400);
  const reviewerId = await reviewerUserId(admin.wcaId);

  const result = await sql.begin(async (tx) => {
    const rows = await tx<Array<{
      id: number | string; sponsor_id: number | string; user_id: number | string;
      status: ClaimStatus; sponsor_name: string; claimed_by_user_id: number | string | null;
      display_name: string; wca_id: string | null;
    }>>`
      SELECT sc.id, sc.sponsor_id, sc.user_id, sc.status,
             s.name AS sponsor_name, s.claimed_by_user_id,
             u.display_name, u.wca_id
        FROM sponsor_claims sc
        JOIN sponsors s ON s.id = sc.sponsor_id
        JOIN app_users u ON u.id = sc.user_id
       WHERE sc.id = ${claimId}
       FOR UPDATE OF sc, s`;
    const row = rows[0];
    if (!row) return { error: 'claim not found', status: 404 as const };
    if (row.status !== 'pending') return { error: 'claim is no longer pending', status: 409 as const };
    if (body.decision === 'approve' && row.claimed_by_user_id != null) {
      return { error: 'sponsor already claimed', status: 409 as const };
    }
    const nextStatus: ClaimStatus = body.decision === 'approve' ? 'approved' : 'rejected';
    await tx`
      UPDATE sponsor_claims
         SET status = ${nextStatus}, review_note = ${note.value},
             reviewed_by_user_id = ${reviewerId}, reviewed_at = NOW()
       WHERE id = ${claimId}`;
    if (nextStatus === 'approved') {
      await tx`
        UPDATE sponsors SET claimed_by_user_id = ${Number(row.user_id)}, claimed_at = NOW()
         WHERE id = ${Number(row.sponsor_id)}`;
    }
    return { row, nextStatus };
  });
  if ('error' in result) return c.json({ error: result.error }, result.status);
  const claimant: AccountProfileRow = {
    id: result.row.user_id,
    display_name: result.row.display_name,
    wca_id: result.row.wca_id,
    birth_date: null, gender: null, country_iso2: null,
  };
  await notify({
    recipients: [ownerKey(claimant)],
    kind: result.nextStatus === 'approved' ? 'sponsor_claim_approved' : 'sponsor_claim_rejected',
    actorKey: admin.wcaId,
    actorName: admin.name,
    title: result.row.sponsor_name,
    excerpt: note.value || '',
    link: '/support',
  });
  return c.json({ ok: true, status: result.nextStatus });
});

// POST /v1/sponsors/:id/unclaim — 管理员解除错误/失效认领,保留 revoked 审计记录。
sponsorsRoutes.post('/sponsors/:id/unclaim', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c), { bucket: 'sponsor-claim-review', max: 30 });
  const admin = await requireAdminOrApiKey(c);
  const sponsorId = parsePositiveId(c.req.param('id'));
  if (!sponsorId) return c.json({ error: 'invalid sponsor id' }, 400);
  const body: { note?: unknown } = await c.req.json<{ note?: unknown }>().catch(() => ({}));
  const note = normalizeNote(body.note, true);
  if ('error' in note) return c.json({ error: note.error }, 400);
  const revokerId = await reviewerUserId(admin.wcaId);

  const result = await sql.begin(async (tx) => {
    const rows = await tx<Array<{
      id: number | string; name: string; claimed_by_user_id: number | string | null;
      display_name: string | null; wca_id: string | null;
    }>>`
      SELECT s.id, s.name, s.claimed_by_user_id, u.display_name, u.wca_id
        FROM sponsors s
        LEFT JOIN app_users u ON u.id = s.claimed_by_user_id
       WHERE s.id = ${sponsorId}
       FOR UPDATE OF s`;
    const row = rows[0];
    if (!row) return { error: 'sponsor not found', status: 404 as const };
    if (row.claimed_by_user_id == null) return { error: 'sponsor is not claimed', status: 409 as const };
    await tx`
      UPDATE sponsor_claims
         SET status = 'revoked', revoked_by_user_id = ${revokerId},
             revocation_note = ${note.value}, revoked_at = NOW()
       WHERE sponsor_id = ${sponsorId} AND status = 'approved'`;
    await tx`
      UPDATE sponsors SET claimed_by_user_id = NULL, claimed_at = NULL
       WHERE id = ${sponsorId}`;
    return { row };
  });
  if ('error' in result) return c.json({ error: result.error }, result.status);
  const claimant: AccountProfileRow = {
    id: result.row.claimed_by_user_id as number | string,
    display_name: result.row.display_name || '',
    wca_id: result.row.wca_id,
    birth_date: null, gender: null, country_iso2: null,
  };
  await notify({
    recipients: [ownerKey(claimant)],
    kind: 'sponsor_claim_revoked',
    actorKey: admin.wcaId,
    actorName: admin.name,
    title: result.row.name,
    excerpt: note.value || '',
    link: '/support',
  });
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
