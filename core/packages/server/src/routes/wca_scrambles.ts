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
  optimal_scramble?: string | null; // God's-number 最优打乱(同态项目 333/oh/ft/fm 才有,见 wca_scramble_optimal)
}

// 自然键关联 wca_scramble_optimal(wca_scrambles.id 是本地自增 IDENTITY,非 WCA id,只能按 6 列自然键 join)。
const OPT_JOIN = `LEFT JOIN wca_scramble_optimal o
    ON o.competition_id = ws.competition_id AND o.event_id = ws.event_id
   AND o.round_type_id = ws.round_type_id AND o.group_id = ws.group_id
   AND o.is_extra = ws.is_extra AND o.scramble_num = ws.scramble_num`;

/** 全量镜像表命中则组装成 WcaScrambleRow[];未收录该比赛返回 null。 */
async function fromMirror(compId: string): Promise<ScrambleRow[] | null> {
  const rows = await query<ScrambleRow>(
    `SELECT ws.competition_id, ws.event_id, ws.round_type_id, ws.group_id,
            (ws.is_extra = 1) AS is_extra, ws.scramble_num, ws.scramble, o.optimal_scramble
       FROM wca_scrambles ws
       ${OPT_JOIN}
      WHERE ws.competition_id = ?
      ORDER BY ws.event_id, ws.round_type_id, ws.group_id, ws.is_extra, ws.scramble_num`,
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

// GET /wca/scrambles/random?event=333&count=5&from=&to= — 随机真实打乱(timer 练习池)。
//
// 无日期边界(默认/全时段):「抽奖号」飞镖采样。每行有永久随机 rnd∈[0,1)(migration 0037),
//   随机 dart∈[0,1) 落点,取该 event 中 rnd>=dart 的 next count 条;末尾不足则从头(rnd<dart 的最小者)
//   环绕补齐。单次 (event_id,rnd,id) 索引区间扫描,只读 count 行 —— ~1ms,且对每条打乱严格(边际)均匀,
//   不必先抽比赛(根治早期「老是同一场」聚簇)。
// 有日期边界:comp-sampling —— 先从 wca_competitions(~1.8 万行,按 start_date 过滤)随机抽 30 场,
//   再从这些场的该 event 打乱里随机取 count 条(~33-49ms)。窄范围下比飞镖稳(飞镖叠日期谓词会退化成稀疏扫描)。
// 两路都 LEFT/INNER JOIN 取比赛名,附带元数据(国旗/名称/轮次)供 UI 展示来源。
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const COMP_SAMPLE = 30;
type RandomRow = ScrambleRow & { comp_name: string | null };
const RANDOM_COLS = `ws.competition_id, ws.event_id, ws.round_type_id, ws.group_id,
        (ws.is_extra = 1) AS is_extra, ws.scramble_num, ws.scramble, c.name AS comp_name, o.optimal_scramble`;

// wca_scrambles 行 → 首页 RecentScrambles 的短键 meta(ci/cn/e/r/g/n/x),payload 也更小。
// o = God's-number 最优打乱(仅同态项目 333/oh/ft/fm 且已求解才有;无则省略,payload 不膨胀)。
function toScrambleMeta(r: RandomRow) {
  return {
    scramble: r.scramble,
    ci: r.competition_id,
    cn: r.comp_name ?? r.competition_id,
    e: r.event_id,
    r: r.round_type_id,
    g: r.group_id,
    n: r.scramble_num,
    x: r.is_extra ? 1 : 0,
    ...(r.optimal_scramble ? { o: r.optimal_scramble } : {}),
  };
}

wcaScramblesRoutes.get('/wca/scrambles/random', async (c) => {
  const event = c.req.query('event') ?? '';
  if (!/^[0-9a-z]{2,6}$/.test(event)) return c.json({ error: 'invalid event' }, 400);
  const count = Math.min(50, Math.max(1, Number(c.req.query('count')) || 1));
  const from = c.req.query('from') ?? '';
  const to = c.req.query('to') ?? '';
  const hasFrom = DATE_RE.test(from);
  const hasTo = DATE_RE.test(to);
  // optimal=1: 只回有 God's-number 最优等态打乱的真题(避免「开了最优却拿到原始打乱」的静默回退)。
  // 仅同态项目(333/oh/ft/fm + 222/pyram/skewb)入 wca_scramble_optimal,前端只对这些项目传 optimal=1。
  const optFilter = c.req.query('optimal') === '1' ? 'AND o.optimal_scramble IS NOT NULL' : '';

  try {
    let rows: RandomRow[];
    if (!hasFrom && !hasTo) {
      // 全时段:抽奖号飞镖采样。dart 在应用侧生成,便于环绕补齐复用同一落点。
      const dart = Math.random();
      rows = await query<RandomRow>(
        `SELECT ${RANDOM_COLS}
           FROM wca_scrambles ws
           LEFT JOIN wca_competitions c ON c.id = ws.competition_id
           ${OPT_JOIN}
          WHERE ws.event_id = ? AND ws.rnd >= ? ${optFilter}
          ORDER BY ws.rnd, ws.id
          LIMIT ?`,
        [event, dart, count],
      );
      if (rows.length < count) {
        // 落点偏高、尾部不足 → 从头(最小 rnd)环绕补齐,凑满 count。
        const more = await query<RandomRow>(
          `SELECT ${RANDOM_COLS}
             FROM wca_scrambles ws
             LEFT JOIN wca_competitions c ON c.id = ws.competition_id
             ${OPT_JOIN}
            WHERE ws.event_id = ? AND ws.rnd < ? ${optFilter}
            ORDER BY ws.rnd, ws.id
            LIMIT ?`,
          [event, dart, count - rows.length],
        );
        rows = rows.concat(more);
      }
    } else {
      // 日期范围:comp-sampling。日期已正则校验,可安全拼进子查询 WHERE。
      const dateWhere: string[] = [];
      const dateParams: string[] = [];
      if (hasFrom) { dateWhere.push('start_date >= ?'); dateParams.push(from); }
      if (hasTo) { dateWhere.push('start_date <= ?'); dateParams.push(to); }
      rows = await query<RandomRow>(
        `SELECT ${RANDOM_COLS}
           FROM wca_scrambles ws
           JOIN (SELECT id, name FROM wca_competitions WHERE ${dateWhere.join(' AND ')}
                  ORDER BY random() LIMIT ${COMP_SAMPLE}) c ON c.id = ws.competition_id
           ${OPT_JOIN}
          WHERE ws.event_id = ? ${optFilter}
          ORDER BY random()
          LIMIT ?`,
        [...dateParams, event, count],
      );
    }
    if (rows.length === 0) return c.json({ error: 'no scrambles for event', event }, 404);
    c.header('Cache-Control', 'no-store');
    return c.json({ event, scrambles: rows.map(toScrambleMeta) });
  } catch (err) {
    console.error('[wca-scrambles] random failed:', err);
    return c.json({ error: 'query failed' }, 500);
  }
});
