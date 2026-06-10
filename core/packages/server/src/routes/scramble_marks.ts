import { Hono } from 'hono';
import { query } from '../db/connection.js';
import { requireAuth, checkRateLimit } from '../utils/recon_helpers.js';

/**
 * /v1/scramble-marks — 公开「打卡」:登录用户给做过的 WCA 真实比赛打乱做标记。
 *
 *   GET    /scramble-marks?ci=&e=&r=&g=&x=&n=   某条打乱的标记列表(公开)
 *   GET    /scramble-marks/recent?event=&wcaId=&before=&limit=   最近标记 feed(公开)
 *   POST   /scramble-marks                       标记(登录,upsert,可带成绩)
 *   DELETE /scramble-marks?ci=&e=&r=&g=&x=&n=    取消自己的标记(登录)
 *
 * 打乱用六元自然键 (ci,e,r,g,x,n) 标识 —— 与 timer 的 WcaScrambleMeta 短键对齐。
 * 不校验打乱存在性:comp 模式新比赛走 wca_scrambles_cache,镜像表可能还没有;
 * 字段做严格 shape 校验 + 登录 + 限流即可。身份取 requireAuth(c),name 随 JWT 落快照;
 * country 客户端报(纯装饰旗帜)。feed 联 wca_scrambles 取打乱原文、wca_competitions 取赛名。
 */
export const scrambleMarksRoutes = new Hono();

function getIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return c.req.header('X-Real-IP') ?? c.req.header('X-Forwarded-For') ?? '0.0.0.0';
}

/** 单用户标记总量上限(防滥写;正常使用远到不了)。 */
const MAX_MARKS_PER_USER = 20000;
const MAX_TIME_CS = 36_000_000; // 100h

interface ScrambleKey {
  ci: string; e: string; r: string; g: string; x: 0 | 1; n: number;
}

/** 六元自然键 shape 校验(与 wca_scrambles 列宽一致),非法返 null。 */
function parseKey(src: Record<string, unknown>): ScrambleKey | null {
  const ci = String(src.ci ?? '');
  const e = String(src.e ?? '');
  const r = String(src.r ?? '');
  const g = String(src.g ?? '');
  const x = Number(src.x) === 1 ? 1 : 0;
  const n = Number(src.n);
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(ci)) return null;
  if (!/^[0-9a-z]{2,6}$/.test(e)) return null;
  if (!/^[a-z0-9]$/.test(r)) return null;
  if (!/^[A-Za-z0-9]{0,3}$/.test(g)) return null;
  if (!Number.isInteger(n) || n < 1 || n > 999) return null;
  return { ci, e, r, g, x, n };
}

function keyFromQuery(c: { req: { query: (k: string) => string | undefined } }): ScrambleKey | null {
  return parseKey({
    ci: c.req.query('ci'), e: c.req.query('e'), r: c.req.query('r'),
    g: c.req.query('g'), x: c.req.query('x'), n: c.req.query('n'),
  });
}

const KEY_WHERE = `competition_id = ? AND event_id = ? AND round_type_id = ?
       AND group_id = ? AND is_extra = ? AND scramble_num = ?`;
const keyParams = (k: ScrambleKey) => [k.ci, k.e, k.r, k.g, k.x, k.n];

interface MarkRow {
  wca_id: string; name: string; country: string;
  time_cs: number | null; created_at: number; total: number;
}

// GET /scramble-marks?ci=&e=&r=&g=&x=&n= — 某条打乱的公开标记列表(新→旧,最多 100)。
scrambleMarksRoutes.get('/scramble-marks', async (c) => {
  c.header('Cache-Control', 'no-store');
  const key = keyFromQuery(c);
  if (!key) return c.json({ error: 'invalid scramble key' }, 400);
  const rows = await query<MarkRow>(
    `SELECT wca_id, name, country, time_cs, created_at, count(*) OVER() AS total
       FROM scramble_marks
      WHERE ${KEY_WHERE}
      ORDER BY created_at DESC, id DESC
      LIMIT 100`,
    keyParams(key),
  );
  return c.json({
    count: rows.length > 0 ? Number(rows[0].total) : 0,
    marks: rows.map((r) => ({
      wcaId: r.wca_id,
      name: r.name,
      country: r.country,
      timeCs: r.time_cs == null ? null : Number(r.time_cs),
      createdAt: Number(r.created_at),
    })),
  });
});

interface FeedRow extends MarkRow {
  id: number;
  competition_id: string; event_id: string; round_type_id: string;
  group_id: string; is_extra: number; scramble_num: number;
  scramble: string | null; comp_name: string | null;
}

// GET /scramble-marks/recent?event=&wcaId=&before=&limit= — 最近标记 feed(/timer/marks)。
// keyset 分页:before = 上页最后一条的 id。打乱原文从镜像 join(极新比赛可能为 null)。
scrambleMarksRoutes.get('/scramble-marks/recent', async (c) => {
  c.header('Cache-Control', 'no-store');
  const event = c.req.query('event') ?? '';
  const wcaId = c.req.query('wcaId') ?? '';
  const before = Number(c.req.query('before')) || 0;
  const limit = Math.min(50, Math.max(1, Number(c.req.query('limit')) || 30));
  if (event && !/^[0-9a-z]{2,6}$/.test(event)) return c.json({ error: 'invalid event' }, 400);
  if (wcaId && !/^[0-9A-Z]{4,20}$/.test(wcaId)) return c.json({ error: 'invalid wcaId' }, 400);

  const where: string[] = [];
  const params: (string | number)[] = [];
  if (event) { where.push('m.event_id = ?'); params.push(event); }
  if (wcaId) { where.push('m.wca_id = ?'); params.push(wcaId); }
  if (before > 0) { where.push('m.id < ?'); params.push(before); }
  const rows = await query<FeedRow>(
    `SELECT m.id, m.wca_id, m.name, m.country, m.time_cs, m.created_at,
            m.competition_id, m.event_id, m.round_type_id, m.group_id, m.is_extra, m.scramble_num,
            ws.scramble, wc.name AS comp_name, 0 AS total
       FROM scramble_marks m
       LEFT JOIN wca_scrambles ws
         ON ws.competition_id = m.competition_id AND ws.event_id = m.event_id
        AND ws.round_type_id = m.round_type_id AND ws.group_id = m.group_id
        AND ws.is_extra = m.is_extra AND ws.scramble_num = m.scramble_num
       LEFT JOIN wca_competitions wc ON wc.id = m.competition_id
      ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY m.id DESC
      LIMIT ?`,
    [...params, limit],
  );
  return c.json({
    marks: rows.map((r) => ({
      id: Number(r.id),
      wcaId: r.wca_id,
      name: r.name,
      country: r.country,
      timeCs: r.time_cs == null ? null : Number(r.time_cs),
      createdAt: Number(r.created_at),
      ci: r.competition_id,
      cn: r.comp_name ?? r.competition_id,
      e: r.event_id,
      r: r.round_type_id,
      g: r.group_id,
      n: r.scramble_num,
      x: r.is_extra ? 1 : 0,
      scramble: r.scramble,
    })),
  });
});

// POST /scramble-marks — 标记(upsert:重复标记刷新成绩/时间戳)。
scrambleMarksRoutes.post('/scramble-marks', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  let body: Record<string, unknown>;
  try {
    body = await c.req.json<Record<string, unknown>>();
  } catch {
    return c.json({ error: 'invalid json' }, 400);
  }
  const key = parseKey(body);
  if (!key) return c.json({ error: 'invalid scramble key' }, 400);
  const timeCsRaw = Number(body.timeCs);
  const timeCs = Number.isInteger(timeCsRaw) && timeCsRaw > 0 && timeCsRaw <= MAX_TIME_CS ? timeCsRaw : null;
  const countryRaw = String(body.country ?? '');
  const country = /^[A-Za-z]{2}$/.test(countryRaw) ? countryRaw.toUpperCase() : '';
  const name = (authUser.name ?? '').slice(0, 200);

  const cnt = await query<{ n: number }>(
    'SELECT count(*) AS n FROM scramble_marks WHERE wca_id = ?',
    [authUser.wcaId],
  );
  if (Number(cnt[0]?.n ?? 0) >= MAX_MARKS_PER_USER) {
    return c.json({ error: 'mark limit reached' }, 429);
  }

  const now = Math.floor(Date.now() / 1000);
  await query(
    `INSERT INTO scramble_marks
       (wca_id, name, country, competition_id, event_id, round_type_id, group_id, is_extra, scramble_num, time_cs, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (wca_id, competition_id, event_id, round_type_id, group_id, is_extra, scramble_num)
     DO UPDATE SET
       name = EXCLUDED.name,
       country = EXCLUDED.country,
       time_cs = COALESCE(EXCLUDED.time_cs, scramble_marks.time_cs),
       created_at = EXCLUDED.created_at`,
    [authUser.wcaId, name, country, ...keyParams(key), timeCs, now],
  );
  return c.json({ ok: true, createdAt: now });
});

// DELETE /scramble-marks?ci=&e=&r=&g=&x=&n= — 取消自己的标记。
scrambleMarksRoutes.delete('/scramble-marks', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const key = keyFromQuery(c);
  if (!key) return c.json({ error: 'invalid scramble key' }, 400);
  await query(
    `DELETE FROM scramble_marks WHERE wca_id = ? AND ${KEY_WHERE}`,
    [authUser.wcaId, ...keyParams(key)],
  );
  return c.json({ ok: true });
});
