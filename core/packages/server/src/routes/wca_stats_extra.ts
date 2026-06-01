/**
 * WCA stats extra — 6 + 2 个 cubing.pro 风格统计 tab / 选手页查询路由.
 *
 * 数据源: wca_grand_slam / wca_results_top
 *         wca_cohort_ranks / wca_success_rate / wca_all_events_done / wca_person_ranks
 *         + historical_ranks_snapshot(选手页 PR 历史 + 排名折线)
 * 每周由 GH Actions 重灌(同 historical_ranks).
 *
 * 端点:
 *   GET /v1/wca/grand-slam?event=&onlyFirst=
 *   GET /v1/wca/all-results?event=&type=&country=&year=&month=&q=&page=&size=
 *   GET /v1/wca/cohort-ranks?cohort=&event=&type=&country=&page=&size=
 *   GET /v1/wca/success-rate?event=&country=&minAttempted=&page=&size=
 *   GET /v1/wca/all-events-done?country=&hidePodiumless=&page=&size=
 *   GET /v1/wca/sum-of-ranks?type=&country=&events=&hidePodium=&page=&size=
 *   GET /v1/wca/person-best-ranks?wcaId=
 *   GET /v1/wca/person-rank-history?wcaId=&eventId=
 *
 * 所有端点 Cache-Control: 1 day —— 每周才变.
 */
import { Hono } from 'hono';
import { query } from '../db/connection.js';

export const wcaStatsExtraRoutes = new Hono();

const VALID_EVENTS = new Set<string>([
  '333','222','444','555','666','777',
  '333bf','333fm','333oh',
  'minx','pyram','clock','skewb','sq1',
  '444bf','555bf','333mbf',
  '333ft','magic','mmagic','333mbo',
]);
const ACTIVE_EVENTS = [
  '333','222','444','555','666','777',
  '333bf','333fm','333oh',
  'minx','pyram','clock','skewb','sq1',
  '444bf','555bf','333mbf',
] as const;

const MAX_SIZE = 200;
const DEFAULT_SIZE = 100;
const CACHE_HEADER = 'public, max-age=86400, s-maxage=86400';

// 国家 ISO2/id 归一化
async function resolveCountry(input: string): Promise<{ ok: true; id: string } | { ok: false; err: string }> {
  if (!input) return { ok: true, id: '' };
  if (input.length === 2) {
    const rows = await query<{ id: string }>(
      `SELECT id FROM wca_countries WHERE iso2 = ? LIMIT 1`,
      [input.toUpperCase()],
    );
    if (rows.length === 0) return { ok: false, err: 'Country not found' };
    return { ok: true, id: rows[0]!.id };
  }
  return { ok: true, id: input };
}

// ── 1. /v1/wca/grand-slam ──
wcaStatsExtraRoutes.get('/wca/grand-slam', async (c) => {
  const event = c.req.query('event') ?? '';   // '' = all events
  const onlyFirst = c.req.query('onlyFirst') === '1' || c.req.query('onlyFirst') === 'true';
  const hasWr = c.req.query('hasWr') === '1' || c.req.query('hasWr') === 'true';

  const where: string[] = [];
  const params: unknown[] = [];
  if (event) {
    if (!VALID_EVENTS.has(event)) return c.json({ error: 'Invalid event' }, 400);
    where.push(`gs.event_id = ?`);
    params.push(event);
  }
  if (onlyFirst) where.push(`gs.is_only_first = TRUE`);
  if (hasWr) where.push(`gs.has_wr = TRUE`);

  const sql = `
    SELECT gs.wca_id, gs.event_id, gs.best_value, gs.avg_value,
           gs.country_id, gs.has_wr, gs.is_only_first,
           gs.world_champ_comp_id, gs.world_champ_pos,
           gs.continental_champ_comp_id, gs.continental_champ_pos,
           gs.national_champ_comp_id, gs.national_champ_pos,
           p.name AS person_name,
           co.iso2 AS iso2,
           wc.name AS world_champ_name,
           cc.name AS cont_champ_name,
           nc.name AS nat_champ_name
    FROM wca_grand_slam gs
    JOIN wca_persons p ON p.wca_id = gs.wca_id
    LEFT JOIN wca_countries co ON co.id = gs.country_id
    LEFT JOIN wca_competitions wc ON wc.id = gs.world_champ_comp_id
    LEFT JOIN wca_competitions cc ON cc.id = gs.continental_champ_comp_id
    LEFT JOIN wca_competitions nc ON nc.id = gs.national_champ_comp_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY gs.event_id, gs.best_value NULLS LAST, gs.wca_id
    LIMIT 5000
  `;
  const rows = await query<{
    wca_id: string; event_id: string;
    best_value: number | null; avg_value: number | null;
    country_id: string; has_wr: boolean; is_only_first: boolean;
    world_champ_comp_id: string | null; world_champ_pos: number | null;
    continental_champ_comp_id: string | null; continental_champ_pos: number | null;
    national_champ_comp_id: string | null; national_champ_pos: number | null;
    person_name: string;
    iso2: string | null;
    world_champ_name: string | null;
    cont_champ_name: string | null;
    nat_champ_name: string | null;
  }>(sql, params);

  c.header('Cache-Control', CACHE_HEADER);
  return c.json({
    rows: rows.map(r => ({
      wcaId: r.wca_id,
      name: r.person_name,
      eventId: r.event_id,
      single: r.best_value,
      average: r.avg_value,
      countryId: r.country_id,
      iso2: r.iso2,
      hasWr: r.has_wr,
      isOnlyFirst: r.is_only_first,
      worldChamp: r.world_champ_comp_id ? { compId: r.world_champ_comp_id, name: r.world_champ_name, pos: r.world_champ_pos } : null,
      continentalChamp: r.continental_champ_comp_id ? { compId: r.continental_champ_comp_id, name: r.cont_champ_name, pos: r.continental_champ_pos } : null,
      nationalChamp: r.national_champ_comp_id ? { compId: r.national_champ_comp_id, name: r.nat_champ_name, pos: r.national_champ_pos } : null,
    })),
  });
});

// ── 2. /v1/wca/all-results ──
// 全量(无 cap):11M 行,WHERE 用 event_id + is_avg + 可选 country / year / month / q,
// ORDER BY value 走 wrt_main / wrt_country / wrt_wca_id / wrt_comp_id 索引.
// q 在 wca_persons.name 和 wca_competitions.name 上 ILIKE,各 LIMIT 200.
wcaStatsExtraRoutes.get('/wca/all-results', async (c) => {
  const event = (c.req.query('event') ?? '333').toLowerCase();
  const type = (c.req.query('type') ?? 'single').toLowerCase();
  const country = c.req.query('country') ?? '';
  const year = parseInt(c.req.query('year') ?? '0', 10);   // 0 = 全部
  const month = parseInt(c.req.query('month') ?? '0', 10); // 0 = 全部
  const q = (c.req.query('q') ?? '').trim();
  const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10));
  const size = Math.min(MAX_SIZE, Math.max(1, parseInt(c.req.query('size') ?? String(DEFAULT_SIZE), 10)));

  if (!VALID_EVENTS.has(event)) return c.json({ error: 'Invalid event' }, 400);
  if (type !== 'single' && type !== 'average') return c.json({ error: 'Invalid type' }, 400);
  if (event === '333mbf' && type === 'average') return c.json({ error: 'No average for 333mbf' }, 400);
  const cn = await resolveCountry(country);
  if (!cn.ok) return c.json({ error: cn.err }, 400);
  if (year && (year < 2003 || year > new Date().getUTCFullYear() + 1)) {
    return c.json({ error: 'Invalid year' }, 400);
  }
  if (month && (month < 1 || month > 12)) {
    return c.json({ error: 'Invalid month' }, 400);
  }

  const where: string[] = [`t.event_id = ?`, `t.is_avg = ?`];
  const params: unknown[] = [event, type === 'average'];

  if (cn.id) { where.push(`t.person_country_id = ?`); params.push(cn.id); }
  if (year) { where.push(`t.comp_year = ?`); params.push(year); }
  if (month) { where.push(`EXTRACT(MONTH FROM t.comp_date) = ?`); params.push(month); }

  if (q) {
    const [personRows, compRows] = await Promise.all([
      query<{ wca_id: string }>(
        `SELECT wca_id FROM wca_persons WHERE name ILIKE ? LIMIT 200`,
        [`%${q}%`],
      ),
      query<{ id: string }>(
        `SELECT id FROM wca_competitions WHERE name ILIKE ? LIMIT 200`,
        [`%${q}%`],
      ),
    ]);
    const personIds = personRows.map(r => r.wca_id);
    const compIds = compRows.map(r => r.id);
    if (personIds.length === 0 && compIds.length === 0) {
      c.header('Cache-Control', CACHE_HEADER);
      return c.json({ event, type, country: cn.id, year, month, q, page, size, total: 0, rows: [] });
    }
    const conds: string[] = [];
    if (personIds.length > 0) {
      conds.push(`t.wca_id IN (${personIds.map(() => '?').join(',')})`);
      params.push(...personIds);
    }
    if (compIds.length > 0) {
      conds.push(`t.comp_id IN (${compIds.map(() => '?').join(',')})`);
      params.push(...compIds);
    }
    where.push(`(${conds.join(' OR ')})`);
  }

  const offset = (page - 1) * size;
  const totalParams = [...params];
  const dataParams = [...params, size, offset];

  // 派生表 + late join 走 id PK 回表:
  // 内子查询只 SELECT (id, value, wca_id) — 三列都覆盖在 wrt_main INCLUDE (id) 索引里,
  // OFFSET 1M 走纯 Index Only Scan, ~250ms (Heap Fetches: 0,需 VACUUM 让 visibility map up-to-date).
  // 外层用 id PK 回表+三张字典表 join,只 enrich 100 行 ~10ms.
  // 直查 + LIMIT/OFFSET + 三 JOIN 的写法会让 PG 先 join 后 OFFSET,深页 ~10s+.
  // rows + count 互不依赖,并行跑 — 冷启动 38s → ~19s.
  const [rows, totalRow] = await Promise.all([
    query<{
      value: number; wca_id: string; person_country_id: string;
      iso2: string | null; comp_id: string; comp_name: string | null; comp_date: string | null;
      attempts: number[] | null; person_name: string; record_tag: string | null;
    }>(
      `
      SELECT q.value, q.wca_id, t.person_country_id,
             co.iso2 AS iso2,
             t.comp_id, c.name AS comp_name, t.comp_date,
             t.attempts, p.name AS person_name,
             t.record_tag
      FROM (
        SELECT t.id, t.value, t.wca_id
        FROM wca_results_top t
        WHERE ${where.join(' AND ')}
        ORDER BY t.value ASC, t.wca_id ASC
        LIMIT ? OFFSET ?
      ) q
      JOIN wca_results_top t ON t.id = q.id
      JOIN wca_persons p ON p.wca_id = t.wca_id
      LEFT JOIN wca_countries co ON co.id = t.person_country_id
      LEFT JOIN wca_competitions c ON c.id = t.comp_id
      ORDER BY q.value ASC, q.wca_id ASC
      `,
      dataParams,
    ),
    query<{ n: string }>(
      `SELECT COUNT(*) AS n FROM wca_results_top t WHERE ${where.join(' AND ')}`,
      totalParams,
    ),
  ]);
  const total = totalRow[0] ? parseInt(totalRow[0].n, 10) : 0;

  c.header('Cache-Control', CACHE_HEADER);
  return c.json({
    event, type, country: cn.id, year, month, q, page, size, total,
    rows: rows.map((r, i) => ({
      rank: offset + i + 1, value: r.value,
      wcaId: r.wca_id, name: r.person_name,
      countryId: r.person_country_id, iso2: r.iso2,
      compId: r.comp_id, compName: r.comp_name, compDate: r.comp_date,
      attempts: r.attempts ?? [],
      record: r.record_tag || null,
    })),
  });
});

// ── 2b. /v1/wca/rank-for ──
// "我这个成绩放进 WCA 历史能排第几" —— 给 /timer 速拧计时器的世界排名徽章用.
//   GET /v1/wca/rank-for?event=333&type=single&centis=984
//
// 语义(重要):wca_results_top 是「一行一条成绩」(每人每场每轮都有行,同一人重复多次,见
//   wca_stats_extra_build.ts + schema 注释),不是「一行一人最佳」.WCA 官方世界排名是「按选手
//   个人最佳去重」(distinct person whose PB < value),所以名次 = 「PR 严格小于 value 的人数」+ 1.
//
// 方案(精确、全成绩有效、无饱和):对每个 (event, type) 懒构建一个「每个上榜选手的个人最佳」
//   升序数组,内存缓存 24h,用二分查找(lowerBound)回答任意 value 的名次.这复刻
//   utils/current_records.ts 的缓存范式(module-level cache + TTL + 懒构建 + in-flight Promise 去重).
//
//   - 构建一次:SELECT MIN(value) ... GROUP BY wca_id —— 该 (event,type) 每位上榜选手一条 PR,
//     升序排好存成 Int32Array.这跟 current_records.ts 的 grouped-MIN 同表同代价,24h 才跑一次.
//   - 查询:rank = lowerBound(arr, value) + 1(value 之前严格更小的 PR 个数 + 1);total = arr.length.
//     不再有 SCAN_CAP / saturated —— 9.84s 与 20s 的 333 会落在数组里截然不同的位置,各自精确.
//
// 内存:只存排好序的 value(不存 wca_id).333 single ~数十万人 ≈ 1-2MB Int32Array.懒构建,只缓存
//   实际被请求过的 (event,type),不预热全项目(服务器 RAM 紧张).
//
// 索引:GROUP BY wca_id 的 MIN(value) 走 wrt_main(event_id,is_avg,value,wca_id) Index Only Scan.
// Cache-Control 同其它端点 1 天(每周才变).
interface RankIndex {
  /** 该 (event,type) 每位上榜选手的个人最佳(centiseconds),升序 */
  values: Int32Array;
  builtAt: number;
}
const RANK_TTL_MS = 24 * 60 * 60_000;
const rankCache = new Map<string, RankIndex>();
const rankInflight = new Map<string, Promise<RankIndex | null>>();

async function buildRankIndex(event: string, isAvg: boolean): Promise<RankIndex | null> {
  const t0 = Date.now();
  try {
    // 每位上榜选手在该 (event,type) 的个人最佳.value>0 排除 DNF(-1)/DNS(-2)/0.
    const rows = await query<{ m: number }>(
      `SELECT MIN(value)::int AS m
       FROM wca_results_top
       WHERE event_id = ? AND is_avg = ? AND value > 0
       GROUP BY wca_id`,
      [event, isAvg],
    );
    const values = new Int32Array(rows.length);
    for (let i = 0; i < rows.length; i++) values[i] = Number(rows[i]!.m);
    values.sort(); // Int32Array.sort 默认数值升序
    console.log(`[rank-for] built ${event}|${isAvg ? 'avg' : 'single'} n=${values.length} in ${Date.now() - t0}ms`);
    return { values, builtAt: Date.now() };
  } catch (e) {
    console.warn(`[rank-for] build failed ${event}|${isAvg ? 'avg' : 'single'}:`, (e as Error).message);
    return null;
  }
}

async function getRankIndex(event: string, isAvg: boolean): Promise<RankIndex | null> {
  const key = `${event}|${isAvg ? '1' : '0'}`;
  const cur = rankCache.get(key);
  if (cur && Date.now() - cur.builtAt < RANK_TTL_MS) return cur;
  const pending = rankInflight.get(key);
  if (pending) return pending;
  const p = (async () => {
    const fresh = await buildRankIndex(event, isAvg);
    if (fresh) rankCache.set(key, fresh);
    rankInflight.delete(key);
    return fresh;
  })();
  rankInflight.set(key, p);
  return p;
}

/** 升序数组里第一个 >= target 的下标 = 严格小于 target 的元素个数. */
function lowerBound(arr: Int32Array, target: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid]! < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

wcaStatsExtraRoutes.get('/wca/rank-for', async (c) => {
  const event = (c.req.query('event') ?? '').toLowerCase();
  const type = (c.req.query('type') ?? 'single').toLowerCase();
  const centisRaw = c.req.query('centis') ?? '';

  if (!(ACTIVE_EVENTS as readonly string[]).includes(event)) {
    return c.json({ error: 'Invalid event' }, 400);
  }
  if (type !== 'single' && type !== 'average') {
    return c.json({ error: 'Invalid type' }, 400);
  }
  // 333mbf 无 average;333fm 的 average 是「平均步数」非时间,这里只支持 single
  // (徽章对 333fm/333mbf 用 single).拒掉这些项目的 average 查询.
  if (type === 'average' && (event === '333mbf' || event === '333fm')) {
    return c.json({ error: 'No average for this event' }, 400);
  }
  const centis = Number(centisRaw);
  if (!Number.isInteger(centis) || centis <= 0) {
    return c.json({ error: 'Invalid centis' }, 400);
  }

  const isAvg = type === 'average';
  const idx = await getRankIndex(event, isAvg);
  if (!idx) return c.json({ error: 'Rank index unavailable' }, 503);

  // rank = (PR 严格小于 value 的人数) + 1;total = 上榜选手数.精确,无饱和.
  const rank = lowerBound(idx.values, centis) + 1;
  const total = idx.values.length;

  c.header('Cache-Control', CACHE_HEADER);
  return c.json({ event, type, value: centis, rank, total });
});

// ── 3. /v1/wca/cohort-ranks ──
wcaStatsExtraRoutes.get('/wca/cohort-ranks', async (c) => {
  const cohort = parseInt(c.req.query('cohort') ?? '0', 10);
  const event = (c.req.query('event') ?? '333').toLowerCase();
  const type = (c.req.query('type') ?? 'single').toLowerCase();
  const country = c.req.query('country') ?? '';
  const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10));
  const size = Math.min(MAX_SIZE, Math.max(1, parseInt(c.req.query('size') ?? String(DEFAULT_SIZE), 10)));

  if (!Number.isFinite(cohort) || cohort < 1980 || cohort > new Date().getUTCFullYear() + 1) {
    return c.json({ error: 'Invalid cohort year' }, 400);
  }
  if (!VALID_EVENTS.has(event)) return c.json({ error: 'Invalid event' }, 400);
  if (type !== 'single' && type !== 'average') return c.json({ error: 'Invalid type' }, 400);
  if (event === '333mbf' && type === 'average') return c.json({ error: 'No average for 333mbf' }, 400);
  const cn = await resolveCountry(country);
  if (!cn.ok) return c.json({ error: cn.err }, 400);

  const offset = (page - 1) * size;
  const orderRank = cn.id ? 'cr.country_rank' : 'cr.world_rank';
  const whereCountry = cn.id ? 'AND cr.country_id = ?' : '';
  const params: unknown[] = [cohort, event, type === 'average'];
  if (cn.id) params.push(cn.id);
  const totalParams = [...params];
  params.push(size, offset);

  const rows = await query<{
    wca_id: string; value: number; country_id: string;
    iso2: string | null; world_rank: number; country_rank: number;
    person_name: string;
  }>(
    `
    SELECT cr.wca_id, cr.value, cr.country_id,
           co.iso2 AS iso2,
           cr.world_rank, cr.country_rank,
           p.name AS person_name
    FROM wca_cohort_ranks cr
    JOIN wca_persons p ON p.wca_id = cr.wca_id
    LEFT JOIN wca_countries co ON co.id = cr.country_id
    WHERE cr.cohort_year = ? AND cr.event_id = ? AND cr.is_avg = ?
      ${whereCountry}
    ORDER BY ${orderRank} ASC, cr.wca_id ASC
    LIMIT ? OFFSET ?
    `,
    params,
  );

  const totalRow = await query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM wca_cohort_ranks
     WHERE cohort_year = ? AND event_id = ? AND is_avg = ? ${whereCountry}`,
    totalParams,
  );
  const total = totalRow[0] ? parseInt(totalRow[0].n, 10) : 0;

  c.header('Cache-Control', CACHE_HEADER);
  return c.json({
    cohort, event, type, country: cn.id, page, size, total,
    rows: rows.map(r => ({
      rank: cn.id ? r.country_rank : r.world_rank,
      wcaId: r.wca_id, name: r.person_name,
      value: r.value,
      countryId: r.country_id, iso2: r.iso2,
    })),
  });
});

// ── 5. /v1/wca/success-rate ──
wcaStatsExtraRoutes.get('/wca/success-rate', async (c) => {
  const event = (c.req.query('event') ?? '333bf').toLowerCase();
  const country = c.req.query('country') ?? '';
  const minAttempted = Math.max(3, parseInt(c.req.query('minAttempted') ?? '3', 10));
  const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10));
  const size = Math.min(MAX_SIZE, Math.max(1, parseInt(c.req.query('size') ?? String(DEFAULT_SIZE), 10)));

  if (!VALID_EVENTS.has(event)) return c.json({ error: 'Invalid event' }, 400);
  const cn = await resolveCountry(country);
  if (!cn.ok) return c.json({ error: cn.err }, 400);

  const offset = (page - 1) * size;
  const whereCountry = cn.id ? 'AND sr.country_id = ?' : '';
  const params: unknown[] = [event, minAttempted];
  if (cn.id) params.push(cn.id);
  const totalParams = [...params];
  params.push(size, offset);

  const rows = await query<{
    wca_id: string; country_id: string;
    iso2: string | null;
    solved: number; attempted: number; pct_x10000: number;
    person_name: string;
  }>(
    `
    SELECT sr.wca_id, sr.country_id,
           co.iso2 AS iso2,
           sr.solved, sr.attempted, sr.pct_x10000,
           p.name AS person_name
    FROM wca_success_rate sr
    JOIN wca_persons p ON p.wca_id = sr.wca_id
    LEFT JOIN wca_countries co ON co.id = sr.country_id
    WHERE sr.event_id = ? AND sr.attempted >= ? ${whereCountry}
    ORDER BY sr.pct_x10000 DESC, sr.attempted DESC, sr.wca_id ASC
    LIMIT ? OFFSET ?
    `,
    params,
  );

  const totalRow = await query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM wca_success_rate
     WHERE event_id = ? AND attempted >= ? ${whereCountry}`,
    totalParams,
  );
  const total = totalRow[0] ? parseInt(totalRow[0].n, 10) : 0;

  c.header('Cache-Control', CACHE_HEADER);
  return c.json({
    event, country: cn.id, minAttempted, page, size, total,
    rows: rows.map(r => ({
      wcaId: r.wca_id, name: r.person_name,
      countryId: r.country_id, iso2: r.iso2,
      solved: r.solved, attempted: r.attempted,
      percentage: r.pct_x10000 / 100, // → "99.99"
    })),
  });
});

// ── 6. /v1/wca/all-events-done ──
wcaStatsExtraRoutes.get('/wca/all-events-done', async (c) => {
  const country = c.req.query('country') ?? '';
  const onlyDone = c.req.query('onlyDone') !== '0' && c.req.query('onlyDone') !== 'false';
  const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10));
  const size = Math.min(MAX_SIZE, Math.max(1, parseInt(c.req.query('size') ?? String(DEFAULT_SIZE), 10)));

  const cn = await resolveCountry(country);
  if (!cn.ok) return c.json({ error: cn.err }, 400);

  const offset = (page - 1) * size;
  const where: string[] = [];
  const params: unknown[] = [];
  if (onlyDone) where.push(`aed.is_done = TRUE`);
  if (cn.id) { where.push(`aed.country_id = ?`); params.push(cn.id); }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  // Order:done 的按 days 升,未 done 的按 done_count 降 + days 升
  const orderBy = onlyDone
    ? 'aed.days_to_complete ASC, aed.wca_id ASC'
    : 'aed.done_count DESC, aed.days_to_complete ASC NULLS LAST, aed.wca_id ASC';
  const totalParams = [...params];
  params.push(size, offset);

  const rows = await query<{
    wca_id: string; country_id: string;
    iso2: string | null;
    done_count: number; is_done: boolean;
    first_comp_id: string | null; first_comp_date: string | null;
    achievement_comp_id: string | null; achievement_comp_date: string | null;
    achievement_comp_name: string | null;
    days_to_complete: number | null; total_comp_count: number;
    person_name: string;
  }>(
    `
    SELECT aed.wca_id, aed.country_id,
           co.iso2 AS iso2,
           aed.done_count, aed.is_done,
           aed.first_comp_id, aed.first_comp_date,
           aed.achievement_comp_id, aed.achievement_comp_date,
           ac.name AS achievement_comp_name,
           aed.days_to_complete, aed.total_comp_count,
           p.name AS person_name
    FROM wca_all_events_done aed
    JOIN wca_persons p ON p.wca_id = aed.wca_id
    LEFT JOIN wca_countries co ON co.id = aed.country_id
    LEFT JOIN wca_competitions ac ON ac.id = aed.achievement_comp_id
    ${whereSql}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
    `,
    params,
  );

  const totalRow = await query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM wca_all_events_done aed ${whereSql}`,
    totalParams,
  );
  const total = totalRow[0] ? parseInt(totalRow[0].n, 10) : 0;

  c.header('Cache-Control', CACHE_HEADER);
  return c.json({
    country: cn.id, onlyDone, page, size, total,
    rows: rows.map(r => ({
      wcaId: r.wca_id, name: r.person_name,
      countryId: r.country_id, iso2: r.iso2,
      doneCount: r.done_count, isDone: r.is_done,
      firstCompId: r.first_comp_id, firstCompDate: r.first_comp_date,
      achievementCompId: r.achievement_comp_id,
      achievementCompName: r.achievement_comp_name,
      achievementCompDate: r.achievement_comp_date,
      daysToComplete: r.days_to_complete,
      totalCompCount: r.total_comp_count,
    })),
  });
});

// ── 7. /v1/wca/sum-of-ranks ──
// events param: 逗号分隔 event id 列表(默认 = 全 17)
wcaStatsExtraRoutes.get('/wca/sum-of-ranks', async (c) => {
  const type = (c.req.query('type') ?? 'single').toLowerCase();
  const country = c.req.query('country') ?? '';
  const eventsParam = c.req.query('events') ?? '';
  const hidePodium = c.req.query('hidePodium') === '1' || c.req.query('hidePodium') === 'true';
  // bestMisser: 命中 best_final_pos = N(殿军之王 = 4).bestMisser>0 时 hidePodium 被忽略.
  const bestMisserRaw = parseInt(c.req.query('bestMisser') ?? '0', 10);
  const bestMisser = Number.isFinite(bestMisserRaw) && bestMisserRaw > 0 ? bestMisserRaw : 0;
  const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10));
  const size = Math.min(MAX_SIZE, Math.max(1, parseInt(c.req.query('size') ?? String(DEFAULT_SIZE), 10)));

  if (type !== 'single' && type !== 'average') return c.json({ error: 'Invalid type' }, 400);
  const cn = await resolveCountry(country);
  if (!cn.ok) return c.json({ error: cn.err }, 400);

  // 解析事件列表 → 索引集合(对齐 ACTIVE_EVENTS 顺序)
  let eventIdxs: number[] | null = null;  // null = 全部 17 项
  if (eventsParam) {
    const arr = eventsParam.split(',').map(s => s.trim()).filter(Boolean);
    const idxs: number[] = [];
    for (const e of arr) {
      const i = ACTIVE_EVENTS.indexOf(e as typeof ACTIVE_EVENTS[number]);
      if (i >= 0) idxs.push(i);
    }
    if (idxs.length === 0) return c.json({ error: 'Invalid events list' }, 400);
    if (idxs.length < ACTIVE_EVENTS.length) eventIdxs = idxs;
  }

  const isCountryMode = !!cn.id;
  const orderCol = eventIdxs ? null : (isCountryMode ? 'pr.total_country_rank' : 'pr.total_world_rank');
  const ranksCol = isCountryMode ? 'ranks_country' : 'ranks_world';
  const isAvg = type === 'average';

  // 构造 WHERE(主查询)
  const where: string[] = [`pr.is_avg = ?`];
  const params: unknown[] = [isAvg];
  if (isCountryMode) { where.push(`pr.country_id = ?`); params.push(cn.id); }
  if (bestMisser > 0) {
    where.push(`pr.best_final_pos = ?`);
    params.push(bestMisser);
  } else if (hidePodium) {
    where.push(`(pr.best_final_pos = 0 OR pr.best_final_pos > 3)`);
  }

  // 如果是默认全 17 项 — 走索引,直接 ORDER BY 聚合好的 total
  if (orderCol) {
    const offset = (page - 1) * size;
    const totalParams = [...params];
    params.push(size, offset);

    const rows = await query<{
      wca_id: string; country_id: string;
      iso2: string | null;
      events_done: number; total_world_rank: number; total_country_rank: number;
      ranks_world: number[]; ranks_country: number[];
      person_name: string;
    }>(
      `
      SELECT pr.wca_id, pr.country_id,
             co.iso2 AS iso2,
             pr.events_done, pr.total_world_rank, pr.total_country_rank,
             pr.ranks_world, pr.ranks_country,
             p.name AS person_name
      FROM wca_person_ranks pr
      JOIN wca_persons p ON p.wca_id = pr.wca_id
      LEFT JOIN wca_countries co ON co.id = pr.country_id
      WHERE ${where.join(' AND ')}
      ORDER BY ${orderCol} ASC, pr.wca_id ASC
      LIMIT ? OFFSET ?
      `,
      params,
    );
    const totalRow = await query<{ n: string }>(
      `SELECT COUNT(*) AS n FROM wca_person_ranks pr WHERE ${where.join(' AND ')}`,
      totalParams,
    );
    const total = totalRow[0] ? parseInt(totalRow[0].n, 10) : 0;

    c.header('Cache-Control', CACHE_HEADER);
    return c.json({
      type, country: cn.id, hidePodium, bestMisser, page, size, total,
      events: ACTIVE_EVENTS,
      rows: rows.map(r => ({
        wcaId: r.wca_id, name: r.person_name,
        countryId: r.country_id, iso2: r.iso2,
        eventsDone: r.events_done,
        totalWorldRank: r.total_world_rank,
        totalCountryRank: r.total_country_rank,
        ranks: isCountryMode ? r.ranks_country : r.ranks_world,
      })),
    });
  }

  // 子集:CTE 算每个选中项目的参赛人数(scope 内有 rank>0 的 cuber 数),
  // 缺项 rank=0 时回退到该项目的"参赛人数+1"(比倒数第一再差一名).
  // 注意 ep CTE 不应用 hidePodium 过滤(参赛人数是项目固有属性,跟当前显示过滤无关).
  const cteWhere: string[] = [`is_avg = ?`];
  const cteParams: unknown[] = [isAvg];
  if (isCountryMode) { cteWhere.push(`country_id = ?`); cteParams.push(cn.id); }

  const epSelect = eventIdxs!.map(i =>
    `SUM(CASE WHEN ${ranksCol}[${i + 1}] > 0 THEN 1 ELSE 0 END)::INTEGER AS p${i}`
  ).join(', ');
  const sumExpr = eventIdxs!.map(i =>
    `(CASE WHEN pr.${ranksCol}[${i + 1}] > 0 THEN pr.${ranksCol}[${i + 1}] ELSE ep.p${i} + 1 END)`
  ).join(' + ');

  const offset = (page - 1) * size;
  const dataParams = [...cteParams, ...params, size, offset];
  const totalParams = [...params];

  const rows = await query<{
    wca_id: string; country_id: string;
    iso2: string | null;
    events_done: number; subset_total: number;
    ranks_world: number[]; ranks_country: number[];
    person_name: string;
  }>(
    `
    WITH ep AS (
      SELECT ${epSelect}
      FROM wca_person_ranks
      WHERE ${cteWhere.join(' AND ')}
    )
    SELECT pr.wca_id, pr.country_id,
           co.iso2 AS iso2,
           pr.events_done,
           (${sumExpr}) AS subset_total,
           pr.ranks_world, pr.ranks_country,
           p.name AS person_name
    FROM wca_person_ranks pr
    CROSS JOIN ep
    JOIN wca_persons p ON p.wca_id = pr.wca_id
    LEFT JOIN wca_countries co ON co.id = pr.country_id
    WHERE ${where.join(' AND ')}
    ORDER BY subset_total ASC, pr.wca_id ASC
    LIMIT ? OFFSET ?
    `,
    dataParams,
  );
  const totalRow = await query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM wca_person_ranks pr WHERE ${where.join(' AND ')}`,
    totalParams,
  );
  const total = totalRow[0] ? parseInt(totalRow[0].n, 10) : 0;

  c.header('Cache-Control', CACHE_HEADER);
  return c.json({
    type, country: cn.id, hidePodium, bestMisser, page, size, total,
    events: ACTIVE_EVENTS,
    selectedEvents: eventIdxs!.map(i => ACTIVE_EVENTS[i]),
    rows: rows.map(r => ({
      wcaId: r.wca_id, name: r.person_name,
      countryId: r.country_id, iso2: r.iso2,
      eventsDone: r.events_done,
      subsetTotal: r.subset_total,
      ranks: isCountryMode ? r.ranks_country : r.ranks_world,
    })),
  });
});

// ── 8. /v1/wca/person-best-ranks ──
// 选手个人 "历史最佳排名":每个项目 single / average 取得过的最低 world/continent/country rank,
// 以及取得该 rank 时的成绩值 + 年份.PR 表 "历史最佳排名" 切换用.
//
// 数据来自预计算专表 historical_best_ranks(每 选手×项目 一行,wca_id 打头主键).
// 该表由 stats-build/historical_ranks_build.ts 逐场重放算出(per-competition order-statistics):
// 名次 = "该场比赛结束、当前所有已结束比赛重排"时的位置,取生涯最小 —— 即选手在排名站看到过的最佳值
// (区别于年末/月末快照的近似:年表会低估到 15,月表 12,本表精确到按比赛口径仍是 12,且全站精确).
wcaStatsExtraRoutes.get('/wca/person-best-ranks', async (c) => {
  const wcaId = (c.req.query('wcaId') ?? '').trim().toUpperCase();
  if (!/^[0-9]{4}[A-Z]{4}[0-9]{2}$/.test(wcaId)) {
    return c.json({ error: 'Invalid wcaId' }, 400);
  }

  const rows = await query<{
    event_id: string;
    s_world_rank: number | null; s_world_value: number | null; s_world_year: number | null;
    s_cont_rank: number | null; s_cont_value: number | null; s_cont_year: number | null;
    s_country_rank: number | null; s_country_value: number | null; s_country_year: number | null;
    a_world_rank: number | null; a_world_value: number | null; a_world_year: number | null;
    a_cont_rank: number | null; a_cont_value: number | null; a_cont_year: number | null;
    a_country_rank: number | null; a_country_value: number | null; a_country_year: number | null;
  }>(
    `
    SELECT event_id,
           s_world_rank, s_world_value, s_world_year,
           s_cont_rank, s_cont_value, s_cont_year,
           s_country_rank, s_country_value, s_country_year,
           a_world_rank, a_world_value, a_world_year,
           a_cont_rank, a_cont_value, a_cont_year,
           a_country_rank, a_country_value, a_country_year
    FROM historical_best_ranks
    WHERE wca_id = ?
    `,
    [wcaId],
  );

  type Best = { rank: number; year: number; value: number | null };
  const cell = (rank: number | null, value: number | null, year: number | null): Best | undefined =>
    rank && rank > 0 ? { rank, year: year ?? 0, value } : undefined;

  const out: Record<string, {
    single?: { world?: Best; continent?: Best; country?: Best };
    average?: { world?: Best; continent?: Best; country?: Best };
  }> = {};

  for (const r of rows) {
    out[r.event_id] = {
      single: {
        world: cell(r.s_world_rank, r.s_world_value, r.s_world_year),
        continent: cell(r.s_cont_rank, r.s_cont_value, r.s_cont_year),
        country: cell(r.s_country_rank, r.s_country_value, r.s_country_year),
      },
      average: {
        world: cell(r.a_world_rank, r.a_world_value, r.a_world_year),
        continent: cell(r.a_cont_rank, r.a_cont_value, r.a_cont_year),
        country: cell(r.a_country_rank, r.a_country_value, r.a_country_year),
      },
    };
  }

  c.header('Cache-Control', CACHE_HEADER);
  return c.json({ wcaId, events: out });
});

// ── 9. /v1/wca/person-rank-history ──
// 选手 (wcaId, eventId) 的 single/average × world/continent/country rank 时间序列.
// granularity=month (默认) → 月级表 (smart-emit,只在选手有比赛的月份有点)
// granularity=year         → 年级表 (年末快照,每年一个点,含 rank decay)
wcaStatsExtraRoutes.get('/wca/person-rank-history', async (c) => {
  const wcaId = (c.req.query('wcaId') ?? '').trim().toUpperCase();
  const eventId = (c.req.query('eventId') ?? '').toLowerCase();
  const granularity = (c.req.query('granularity') ?? 'month').toLowerCase();
  if (!/^[0-9]{4}[A-Z]{4}[0-9]{2}$/.test(wcaId)) {
    return c.json({ error: 'Invalid wcaId' }, 400);
  }
  if (!VALID_EVENTS.has(eventId)) {
    return c.json({ error: 'Invalid event' }, 400);
  }
  if (granularity !== 'month' && granularity !== 'year') {
    return c.json({ error: 'Invalid granularity' }, 400);
  }

  if (granularity === 'year') {
    const rows = await query<{
      year: number;
      single: number | null;
      average: number | null;
      single_world_rank: number | null;
      single_country_rank: number | null;
      single_continent_rank: number | null;
      avg_world_rank: number | null;
      avg_country_rank: number | null;
      avg_continent_rank: number | null;
    }>(
      `
      SELECT year, single, average,
             single_world_rank, single_country_rank, single_continent_rank,
             avg_world_rank, avg_country_rank, avg_continent_rank
      FROM historical_ranks_snapshot
      WHERE wca_id = ? AND event_id = ?
      ORDER BY year ASC
      `,
      [wcaId, eventId],
    );

    c.header('Cache-Control', CACHE_HEADER);
    return c.json({
      wcaId, eventId, granularity,
      rows: rows.map(r => ({
        year: r.year,
        single: r.single, average: r.average,
        singleWorldRank: r.single_world_rank,
        singleCountryRank: r.single_country_rank,
        singleContinentRank: r.single_continent_rank,
        avgWorldRank: r.avg_world_rank,
        avgCountryRank: r.avg_country_rank,
        avgContinentRank: r.avg_continent_rank,
      })),
    });
  }

  // 月级
  const rows = await query<{
    year: number;
    month: number;
    single: number | null;
    average: number | null;
    single_world_rank: number | null;
    single_country_rank: number | null;
    single_continent_rank: number | null;
    avg_world_rank: number | null;
    avg_country_rank: number | null;
    avg_continent_rank: number | null;
  }>(
    `
    SELECT year, month, single, average,
           single_world_rank, single_country_rank, single_continent_rank,
           avg_world_rank, avg_country_rank, avg_continent_rank
    FROM historical_ranks_monthly_snapshot
    WHERE wca_id = ? AND event_id = ?
    ORDER BY year ASC, month ASC
    `,
    [wcaId, eventId],
  );

  c.header('Cache-Control', CACHE_HEADER);
  return c.json({
    wcaId, eventId, granularity,
    rows: rows.map(r => ({
      year: r.year, month: r.month,
      single: r.single, average: r.average,
      singleWorldRank: r.single_world_rank,
      singleCountryRank: r.single_country_rank,
      singleContinentRank: r.single_continent_rank,
      avgWorldRank: r.avg_world_rank,
      avgCountryRank: r.avg_country_rank,
      avgContinentRank: r.avg_continent_rank,
    })),
  });
});
