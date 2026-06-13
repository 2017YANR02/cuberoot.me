import { Hono } from 'hono';
import { query } from '../db/connection.js';
import { requireAuth, checkRateLimit } from '../utils/recon_helpers.js';

/**
 * /v1/comp/follows — per-user 比赛关注（首页「报名」标签的「盯一下」）。
 *
 *   GET    /comp/follows            — 当前用户关注的 comp id 列表 { compIds: string[] }
 *   PUT    /comp/follows/:compId    — 关注（upsert，ON CONFLICT DO NOTHING）
 *   DELETE /comp/follows/:compId    — 取消关注
 *
 * 身份始终取 requireAuth(c).wcaId（Bearer JWT）；客户端不传 wca_id。
 * comp_id 是 WCA competitionId（[A-Za-z0-9_]，长度有限），写前做 shape 校验。
 */
export const compFollowsRoutes = new Hono();

function getIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return c.req.header('X-Real-IP') ?? c.req.header('X-Forwarded-For') ?? '0.0.0.0';
}

/** 单用户关注上限（防滥写；正常用户远到不了）。 */
const MAX_FOLLOWS_PER_USER = 500;

/** WCA competitionId shape：字母数字 + 下划线/连字符，1-64。非法返 null。 */
function parseCompId(raw: string | undefined): string | null {
  const id = (raw ?? '').trim();
  return /^[A-Za-z0-9_-]{1,64}$/.test(id) ? id : null;
}

interface FollowRow { comp_id: string }

compFollowsRoutes.get('/comp/follows', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const rows = await query<FollowRow>(
    'SELECT comp_id FROM comp_follows WHERE wca_id = ? ORDER BY created_at DESC',
    [authUser.wcaId],
  );
  return c.json({ compIds: rows.map((r) => r.comp_id) });
});

compFollowsRoutes.put('/comp/follows/:compId', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const compId = parseCompId(c.req.param('compId'));
  if (!compId) return c.json({ error: 'invalid comp id' }, 400);

  const cnt = await query<{ n: number }>(
    'SELECT COUNT(*)::int AS n FROM comp_follows WHERE wca_id = ?',
    [authUser.wcaId],
  );
  if ((cnt[0]?.n ?? 0) >= MAX_FOLLOWS_PER_USER) {
    return c.json({ error: 'follow limit reached' }, 409);
  }

  await query(
    `INSERT INTO comp_follows (wca_id, comp_id, created_at)
     VALUES (?, ?, ?)
     ON CONFLICT (wca_id, comp_id) DO NOTHING`,
    [authUser.wcaId, compId, Date.now()],
  );
  return c.json({ ok: true, compId });
});

compFollowsRoutes.delete('/comp/follows/:compId', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const compId = parseCompId(c.req.param('compId'));
  if (!compId) return c.json({ error: 'invalid comp id' }, 400);
  await query('DELETE FROM comp_follows WHERE wca_id = ? AND comp_id = ?', [authUser.wcaId, compId]);
  return c.json({ ok: true, compId });
});
