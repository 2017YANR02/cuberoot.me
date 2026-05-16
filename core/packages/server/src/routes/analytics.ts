/**
 * /v1/analytics — 站内自有流量统计.
 *
 *   POST /v1/analytics/pv      open       记一次 pageview, 返回 { id }
 *   POST /v1/analytics/dwell   open       回填 dwell_ms (body: { id, ms })
 *   GET  /v1/analytics/summary WCA gate   汇总报表给 /traffic 页用
 *
 * 设计:
 *   - pageviews 保留 90 天 (systemd analytics-aggregate.timer 删旧).
 *   - traffic_daily 永久, 由 timer 每天聚合昨天的 pageviews.
 *   - summary 查询 = traffic_daily (历史) + pageviews (今天) UNION,
 *     这样部署当天 /traffic 就有数据,不必等到次日 04:30 UTC.
 *   - top-N (paths/referrers/countries) 取前 20 条,'(direct)' / 'XX' 占位归入桶里.
 *
 * 隐私: 见 utils/analytics_helpers.ts.
 */
import { Hono } from 'hono';
import { query } from '../db/connection.js';
import { requireAuth } from '../utils/recon_helpers.js';
import {
  classifyUa,
  getClientIp,
  lookupCountry,
  makeVisitorId,
  normalizeReferrer,
  truncate,
} from '../utils/analytics_helpers.js';

export const analyticsRoutes = new Hono();

const PATH_MAX = 500;
const REF_MAX = 100;

interface PvInput {
  path?: unknown;
  ref?: unknown;
}

analyticsRoutes.post('/analytics/pv', async (c) => {
  let body: PvInput;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid json' }, 400);
  }
  const path = typeof body.path === 'string' ? truncate(body.path, PATH_MAX) : null;
  if (!path) return c.json({ error: 'path required' }, 400);

  const ref = typeof body.ref === 'string' ? body.ref : '';
  const ua = c.req.header('user-agent') ?? '';
  const ua_class = classifyUa(ua);

  if (ua_class === 'bot') {
    // 静默接受不写库,避免 bot 拖大表(也不暴露过滤策略).
    return c.json({ id: null });
  }

  const ip = getClientIp((n) => c.req.header(n));
  const visitor_id = makeVisitorId(ip, ua);
  const country = await lookupCountry(ip);
  const ref_domain = truncate(normalizeReferrer(ref, 'cuberoot.me'), REF_MAX);

  const [row] = await query<{ id: string | number }>(
    `INSERT INTO pageviews (visitor_id, path, ref_domain, country, ua_class)
     VALUES (?, ?, ?, ?, ?)
     RETURNING id`,
    [visitor_id, path, ref_domain, country, ua_class],
  );
  return c.json({ id: Number(row.id) });
});

interface DwellInput {
  id?: unknown;
  ms?: unknown;
}

analyticsRoutes.post('/analytics/dwell', async (c) => {
  let body: DwellInput;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid json' }, 400);
  }
  const id = typeof body.id === 'number' && Number.isFinite(body.id) ? Math.floor(body.id) : null;
  const ms = typeof body.ms === 'number' && Number.isFinite(body.ms) ? Math.max(0, Math.floor(body.ms)) : null;
  if (id === null || ms === null) return c.json({ error: 'id + ms required' }, 400);
  // Cap at 30 min — beyond that it's almost certainly a tab left open / suspended laptop.
  const capped = Math.min(ms, 30 * 60 * 1000);
  await query(
    `UPDATE pageviews SET dwell_ms = ? WHERE id = ? AND dwell_ms IS NULL AND ts > NOW() - INTERVAL '2 hours'`,
    [capped, id],
  );
  return c.json({ ok: true });
});

type Range = '7d' | '30d' | '90d' | 'all';

function rangeDays(r: Range): number | null {
  if (r === '7d') return 7;
  if (r === '30d') return 30;
  if (r === '90d') return 90;
  return null;
}

interface DailyRow { day: string; pv: number; uv: number }
interface PathRow { path: string; pv: number; uv: number; avg_dwell_ms: number | null }
interface RefRow { ref_domain: string; pv: number; uv: number }
interface CountryRow { country: string; pv: number; uv: number }

analyticsRoutes.get('/analytics/summary', async (c) => {
  await requireAuth(c);

  const rawRange = c.req.query('range') ?? '30d';
  const range: Range = (['7d', '30d', '90d', 'all'] as const).includes(rawRange as Range)
    ? (rawRange as Range)
    : '30d';
  const days = rangeDays(range);

  // 历史聚合(不含今天).
  const histWhere = days === null ? '' : `WHERE day >= CURRENT_DATE - INTERVAL '${days} days' AND day < CURRENT_DATE`;
  const dailyHist = await query<DailyRow>(
    `SELECT day::text AS day, SUM(pv)::int AS pv, SUM(uv)::int AS uv
     FROM traffic_daily ${histWhere}
     GROUP BY day ORDER BY day`,
  );

  // 今天 (尚未 aggregate),直接从 pageviews 算.
  // ua_class != 'bot' 已在 INSERT 时过滤,这里仍带上以防万一.
  const dailyToday = await query<DailyRow>(
    `SELECT CURRENT_DATE::text AS day,
            COUNT(*)::int AS pv,
            COUNT(DISTINCT visitor_id)::int AS uv
     FROM pageviews
     WHERE ts >= CURRENT_DATE AND ua_class <> 'bot'`,
  );
  const daily: DailyRow[] = [...dailyHist];
  if (dailyToday[0] && dailyToday[0].pv > 0) daily.push(dailyToday[0]);

  // Top paths/refs/countries — 同样合并历史 + 今天.
  const histRangeSql = days === null
    ? `WHERE day < CURRENT_DATE`
    : `WHERE day >= CURRENT_DATE - INTERVAL '${days} days' AND day < CURRENT_DATE`;

  // Paths: top 20 by pv.
  // 历史 traffic_daily.uv 是 (day,path,country,ref) 粒度的 uv, sum 起来会高估 path 级 uv.
  // 折中: range≤90d 直接走 pageviews (准确, 行数 OK); range='all' 时只能 sum traffic_daily.uv
  // (带宽换准确度,标签上注明 ~uv).
  let paths: PathRow[];
  let refs: RefRow[];
  let countries: CountryRow[];

  if (days !== null) {
    // 近 N 天(≤90)统一走 pageviews — 精确 uv + dwell 也只能从 raw 算.
    const pvWindow = `WHERE ts >= NOW() - INTERVAL '${days} days' AND ua_class <> 'bot'`;
    paths = await query<PathRow>(
      `SELECT path,
              COUNT(*)::int AS pv,
              COUNT(DISTINCT visitor_id)::int AS uv,
              ROUND(AVG(dwell_ms))::int AS avg_dwell_ms
       FROM pageviews ${pvWindow}
       GROUP BY path
       ORDER BY pv DESC
       LIMIT 20`,
    );
    refs = await query<RefRow>(
      `SELECT COALESCE(NULLIF(ref_domain, ''), '(direct)') AS ref_domain,
              COUNT(*)::int AS pv,
              COUNT(DISTINCT visitor_id)::int AS uv
       FROM pageviews ${pvWindow}
       GROUP BY 1
       ORDER BY pv DESC
       LIMIT 20`,
    );
    countries = await query<CountryRow>(
      `SELECT COALESCE(NULLIF(country, ''), 'XX') AS country,
              COUNT(*)::int AS pv,
              COUNT(DISTINCT visitor_id)::int AS uv
       FROM pageviews ${pvWindow}
       GROUP BY 1
       ORDER BY pv DESC
       LIMIT 30`,
    );
  } else {
    // all-time: 走 traffic_daily; uv 是 sum (上界估计).
    paths = await query<PathRow>(
      `SELECT path,
              SUM(pv)::int AS pv,
              SUM(uv)::int AS uv,
              ROUND(AVG(avg_dwell_ms))::int AS avg_dwell_ms
       FROM traffic_daily ${histRangeSql}
       GROUP BY path
       ORDER BY pv DESC
       LIMIT 20`,
    );
    refs = await query<RefRow>(
      `SELECT CASE WHEN ref_domain = '' THEN '(direct)' ELSE ref_domain END AS ref_domain,
              SUM(pv)::int AS pv,
              SUM(uv)::int AS uv
       FROM traffic_daily ${histRangeSql}
       GROUP BY 1
       ORDER BY pv DESC
       LIMIT 20`,
    );
    countries = await query<CountryRow>(
      `SELECT country,
              SUM(pv)::int AS pv,
              SUM(uv)::int AS uv
       FROM traffic_daily ${histRangeSql}
       GROUP BY 1
       ORDER BY pv DESC
       LIMIT 30`,
    );
  }

  const totalPv = daily.reduce((s, d) => s + d.pv, 0);
  const totalUv = daily.reduce((s, d) => s + d.uv, 0);

  return c.json({
    range,
    generated_at: new Date().toISOString(),
    totals: { pv: totalPv, uv_sum_of_days: totalUv, days: daily.length },
    daily,
    paths,
    referrers: refs,
    countries,
  });
});
