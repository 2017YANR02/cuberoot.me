import { Hono } from 'hono';
import {
  decodeTimerWcaScrambleMarkKey,
  type TimerWcaScrambleMarkKey,
} from '@cuberoot/shared/timer';
import { getIp } from '../utils/analytics_helpers.js';
import { query } from '../db/connection.js';
import { requireAuth, checkRateLimit } from '../utils/recon_helpers.js';

/**
 * /v1/scramble-marks — 公开「打卡」:登录用户给做过的 WCA 真实比赛打乱做标记。
 *
 *   GET    /scramble-marks?ci=&e=&r=&g=&x=&n=   某条打乱的标记列表(公开)
 *   GET    /scramble-marks/recent?event=&wcaId=&q=&before=&limit=   最近标记 feed(公开)
 *   DELETE /scramble-marks/:id                   按 id 删一条(本人 / 管理员)
 *   POST   /scramble-marks                       标记(登录,upsert,可带成绩)
 *   PATCH  /scramble-marks                       只更新自己的已有标记(登录,绝不新建)
 *   DELETE /scramble-marks?ci=&e=&r=&g=&x=&n=    取消自己的标记(登录)
 *
 * 打乱用六元自然键 (ci,e,r,g,x,n) 标识 —— 与 timer 的 WcaScrambleMeta 短键对齐。
 * 不校验打乱存在性:comp 模式新比赛走 wca_scrambles_cache,镜像表可能还没有;
 * 字段做严格 shape 校验 + 登录 + 限流即可。身份取 requireAuth(c),name 随 JWT 落快照;
 * country 客户端报(纯装饰旗帜)。feed 联 wca_scrambles 取打乱原文、wca_competitions 取赛名。
 */
export const scrambleMarksRoutes = new Hono();

/** 单用户标记总量上限(防滥写;正常使用远到不了)。 */
const MAX_MARKS_PER_USER = 20000;
const MAX_TIME_CS = 36_000_000; // 100h

type ScrambleKey = TimerWcaScrambleMarkKey;

/** JSON writes already carry typed values; shared owns the six-field contract. */
function keyFromBody(src: Record<string, unknown>): ScrambleKey | null {
  return decodeTimerWcaScrambleMarkKey(src);
}

function keyFromQuery(c: { req: { query: (k: string) => string | undefined } }): ScrambleKey | null {
  const rawX = c.req.query('x');
  return decodeTimerWcaScrambleMarkKey({
    ci: c.req.query('ci'), e: c.req.query('e'), r: c.req.query('r'),
    g: c.req.query('g'),
    x: rawX === '0' ? 0 : rawX === '1' ? 1 : undefined,
    n: Number(c.req.query('n')),
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

// GET /scramble-marks/recent?event=&wcaId=&q=&before=&limit= — 最近标记 feed(/timer/marks)。
// keyset 分页:before = 上页最后一条的 id。打乱原文从镜像 join(极新比赛可能为 null)。
// q:模糊搜选手名 / 比赛名 / 比赛 id(ILIKE,大小写不敏感)。
scrambleMarksRoutes.get('/scramble-marks/recent', async (c) => {
  c.header('Cache-Control', 'no-store');
  const event = c.req.query('event') ?? '';
  const wcaId = c.req.query('wcaId') ?? '';
  const q = (c.req.query('q') ?? '').trim().slice(0, 80);
  const before = Number(c.req.query('before')) || 0;
  const limit = Math.min(50, Math.max(1, Number(c.req.query('limit')) || 30));
  if (event && !/^[0-9a-z]{2,6}$/.test(event)) return c.json({ error: 'invalid event' }, 400);
  if (wcaId && !/^[0-9A-Z]{4,20}$/.test(wcaId)) return c.json({ error: 'invalid wcaId' }, 400);

  const where: string[] = [];
  const params: (string | number)[] = [];
  if (event) { where.push('m.event_id = ?'); params.push(event); }
  if (wcaId) { where.push('m.wca_id = ?'); params.push(wcaId); }
  if (q) {
    // LIKE 通配符转义,把用户输入当字面量匹配。
    const like = `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
    where.push('(m.name ILIKE ? OR wc.name ILIKE ? OR m.competition_id ILIKE ?)');
    params.push(like, like, like);
  }
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
  const key = keyFromBody(body);
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
       country = COALESCE(NULLIF(EXCLUDED.country, ''), scramble_marks.country),
       time_cs = COALESCE(EXCLUDED.time_cs, scramble_marks.time_cs),
       created_at = EXCLUDED.created_at`,
    [authUser.wcaId, name, country, ...keyParams(key), timeCs, now],
  );
  return c.json({ ok: true, createdAt: now });
});

// PATCH /scramble-marks — 只更新本人已有标记。用于关闭自动打卡时同步已有成绩；
// 所有权由认证身份 + SQL WHERE 判定，不依赖公开列表(该列表最多只返回 100 条)。
scrambleMarksRoutes.patch('/scramble-marks', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  let body: Record<string, unknown>;
  try {
    body = await c.req.json<Record<string, unknown>>();
  } catch {
    return c.json({ error: 'invalid json' }, 400);
  }
  const key = keyFromBody(body);
  if (!key) return c.json({ error: 'invalid scramble key' }, 400);
  const timeCsRaw = Number(body.timeCs);
  const timeCs = Number.isInteger(timeCsRaw) && timeCsRaw > 0 && timeCsRaw <= MAX_TIME_CS
    ? timeCsRaw
    : null;
  const countryRaw = String(body.country ?? '');
  const country = /^[A-Za-z]{2}$/.test(countryRaw) ? countryRaw.toUpperCase() : '';
  const name = (authUser.name ?? '').slice(0, 200);
  const now = Math.floor(Date.now() / 1000);
  const rows = await query<{ created_at: number }>(
    `UPDATE scramble_marks
        SET name = ?,
            country = COALESCE(NULLIF(?, ''), country),
            time_cs = COALESCE(?, time_cs),
            created_at = ?
      WHERE wca_id = ? AND ${KEY_WHERE}
      RETURNING created_at`,
    [name, country, timeCs, now, authUser.wcaId, ...keyParams(key)],
  );
  if (rows.length === 0) return c.json({ ok: true, updated: false, createdAt: null });
  return c.json({ ok: true, updated: true, createdAt: Number(rows[0].created_at) });
});

// DELETE /scramble-marks?ci=&e=&r=&g=&x=&n= — 取消自己的标记(timer 弹层「取消标记」)。
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

// DELETE /scramble-marks/:id — 按 id 删一条(/timer/marks feed 行内删除)。
// 本人删自己;管理员可删任何人(最高权限)。
scrambleMarksRoutes.delete('/scramble-marks/:id', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: 'invalid id' }, 400);
  const rows = await query<{ wca_id: string }>(
    'SELECT wca_id FROM scramble_marks WHERE id = ?',
    [id],
  );
  if (rows.length === 0) return c.json({ ok: true }); // 幂等:已不存在也算成功
  const isAdmin = authUser.isAdmin;
  if (rows[0].wca_id !== authUser.wcaId && !isAdmin) {
    return c.json({ error: 'Cannot delete others’ marks' }, 403);
  }
  await query('DELETE FROM scramble_marks WHERE id = ?', [id]);
  return c.json({ ok: true });
});
