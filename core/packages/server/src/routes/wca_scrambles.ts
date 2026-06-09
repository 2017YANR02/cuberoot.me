import { Hono } from 'hono';
import { query } from '../db/connection.js';

/**
 * /v1/wca/scrambles — WCA 官方比赛打乱。两条路径共用全量镜像表 wca_scrambles
 * (源 WCA dump scrambles 表,首灌 + CI 日更;扁平行直接对应前端 WcaScrambleRow[])。
 *
 *   GET /wca/scrambles?compId=          指定比赛全场打乱(秒出,不回源 WCA)
 *   GET /wca/scrambles/random?event=&count=   随机真实打乱池(timer 练习用)
 *
 * 指定比赛:全量表优先 → 命中即本地组装返回;未命中(dump 还没收录的新赛)
 * 回落到 wca_scrambles_cache 懒缓存代理(查缓存 → 回源 WCA API → 写缓存)。
 * 从 routes/recon.ts 迁出(原 /v1/recon/wca-scrambles,与复盘无耦合)。
 */
export const wcaScramblesRoutes = new Hono();

const WCA_CACHE_TTL_DAYS = 30;

interface ScrambleRow {
  competition_id: string;
  event_id: string;
  round_type_id: string;
  group_id: string;
  is_extra: boolean;
  scramble_num: number;
  scramble: string;
}

/** 全量镜像表命中则组装成 WcaScrambleRow[];未收录该比赛返回 null。 */
async function fromMirror(compId: string): Promise<ScrambleRow[] | null> {
  const rows = await query<ScrambleRow>(
    `SELECT competition_id, event_id, round_type_id, group_id,
            (is_extra = 1) AS is_extra, scramble_num, scramble
       FROM wca_scrambles
      WHERE competition_id = ?
      ORDER BY event_id, round_type_id, group_id, is_extra, scramble_num`,
    [compId],
  );
  return rows.length > 0 ? rows : null;
}

wcaScramblesRoutes.get('/wca/scrambles', async (c) => {
  const compId = c.req.query('compId') ?? '';
  if (!compId) return c.json({ error: 'compId required' }, 400);
  if (!/^[A-Za-z0-9_-]+$/.test(compId)) return c.json({ error: 'invalid compId' }, 400);

  // 1) 全量镜像优先 —— 老比赛秒出,不依赖 WCA API。
  try {
    const mirror = await fromMirror(compId);
    if (mirror) {
      c.header('Cache-Control', 'public, max-age=86400');
      c.header('X-Cache', 'MIRROR');
      return c.json(mirror);
    }
  } catch (err) {
    console.error('[wca-scrambles] mirror read failed:', err);
  }

  // 2) 镜像未收录(刚结束的新赛)→ 懒缓存代理。
  try {
    const rows = await query<{ payload: string }>(
      `SELECT payload FROM wca_scrambles_cache
        WHERE comp_id = ?
          AND fetched_at > NOW() - INTERVAL '${WCA_CACHE_TTL_DAYS} days'`,
      [compId],
    );
    if (rows[0]?.payload) {
      c.header('Cache-Control', 'public, max-age=86400');
      c.header('X-Cache', 'HIT');
      return c.body(rows[0].payload, 200, { 'Content-Type': 'application/json' });
    }
  } catch (err) {
    console.error('[wca-scrambles] cache read failed:', err);
  }

  const url = `https://www.worldcubeassociation.org/api/v0/competitions/${encodeURIComponent(compId)}/scrambles`;
  let upstream: unknown[] | null = null;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'CubeRoot-WCA/1.0' },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return c.json({ error: 'WCA API unavailable', status: res.status }, 502);
    upstream = await res.json();
  } catch (err) {
    console.error('[wca-scrambles] fetch failed:', err);
    return c.json({ error: 'WCA API unreachable', detail: String((err as Error)?.message ?? err) }, 502);
  }
  if (!Array.isArray(upstream)) return c.json({ error: 'WCA API malformed' }, 502);

  const payload = JSON.stringify(upstream);
  if (upstream.length > 0) {
    try {
      await query(
        `INSERT INTO wca_scrambles_cache (comp_id, payload)
         VALUES (?, ?)
         ON CONFLICT (comp_id) DO UPDATE SET
           payload = EXCLUDED.payload,
           fetched_at = NOW()`,
        [compId, payload],
      );
    } catch (err) {
      console.error('[wca-scrambles] cache write failed:', err);
    }
  }

  c.header('Cache-Control', upstream.length > 0 ? 'public, max-age=86400' : 'public, max-age=60');
  c.header('X-Cache', 'MISS');
  return c.body(payload, 200, { 'Content-Type': 'application/json' });
});

// GET /wca/scrambles/random?event=333&count=5 — 从全量镜像随机抽真实打乱(timer 练习池)。
// 随机起点 id 窗口采样(见 migration 0036):取该 event 的 [min,max] id 范围,随机选一个
// 起点,沿 id 升序取 count 条。复合索引 (event_id, id) → O(count) 区间扫描(~3ms),不再
// ORDER BY random() 全表排序(~11.8s)。同一窗口内多为同场同轮(id 聚簇),每次 refill 换
// 一个随机窗口,整段练习仍覆盖不同比赛。附带比赛元数据(国旗/名称/轮次)供 UI 展示来源。
wcaScramblesRoutes.get('/wca/scrambles/random', async (c) => {
  const event = c.req.query('event') ?? '';
  if (!/^[0-9a-z]{2,6}$/.test(event)) return c.json({ error: 'invalid event' }, 400);
  const count = Math.min(50, Math.max(1, Number(c.req.query('count')) || 1));

  try {
    const rows = await query<ScrambleRow & { comp_name: string | null }>(
      `WITH b AS (SELECT min(id) AS lo, max(id) AS hi FROM wca_scrambles WHERE event_id = ?)
       SELECT ws.competition_id, ws.event_id, ws.round_type_id, ws.group_id,
              (ws.is_extra = 1) AS is_extra, ws.scramble_num, ws.scramble,
              c.name AS comp_name
         FROM wca_scrambles ws
         LEFT JOIN wca_competitions c ON c.id = ws.competition_id
        WHERE ws.event_id = ?
          AND ws.id >= (SELECT lo + floor(random() * GREATEST(hi - lo, 1))::bigint FROM b)
        ORDER BY ws.id
        LIMIT ?`,
      [event, event, count],
    );
    if (rows.length === 0) return c.json({ error: 'no scrambles for event', event }, 404);
    c.header('Cache-Control', 'no-store');
    return c.json({
      event,
      // 短键对齐首页 RecentScrambles 的 meta 形态(ci/cn/e/r/g/n/x),payload 也更小。
      scrambles: rows.map((r) => ({
        scramble: r.scramble,
        ci: r.competition_id,
        cn: r.comp_name ?? r.competition_id,
        e: r.event_id,
        r: r.round_type_id,
        g: r.group_id,
        n: r.scramble_num,
        x: r.is_extra ? 1 : 0,
      })),
    });
  } catch (err) {
    console.error('[wca-scrambles] random failed:', err);
    return c.json({ error: 'query failed' }, 500);
  }
});
