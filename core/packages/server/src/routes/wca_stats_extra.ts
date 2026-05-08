/**
 * WCA stats extra — 6 个 cubing.pro 风格统计 tab 的查询路由.
 *
 * 数据源: wca_grand_slam / wca_results_top / wca_year_results_top
 *         wca_cohort_ranks / wca_success_rate / wca_all_events_done / wca_person_ranks
 * 每周由 GH Actions 重灌(同 historical_ranks).
 *
 * 端点:
 *   GET /v1/wca/grand-slam?event=&onlyFirst=
 *   GET /v1/wca/all-results?event=&type=&country=&page=&size=
 *   GET /v1/wca/year-results?year=&month=&event=&type=&country=&page=&size=
 *   GET /v1/wca/cohort-ranks?cohort=&event=&type=&country=&page=&size=
 *   GET /v1/wca/success-rate?event=&country=&minAttempted=&page=&size=
 *   GET /v1/wca/all-events-done?country=&hidePodiumless=&page=&size=
 *   GET /v1/wca/sum-of-ranks?type=&country=&events=&hidePodium=&page=&size=
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

  const where: string[] = [];
  const params: unknown[] = [];
  if (event) {
    if (!VALID_EVENTS.has(event)) return c.json({ error: 'Invalid event' }, 400);
    where.push(`gs.event_id = ?`);
    params.push(event);
  }
  if (onlyFirst) where.push(`gs.is_only_first = TRUE`);

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
wcaStatsExtraRoutes.get('/wca/all-results', async (c) => {
  const event = (c.req.query('event') ?? '333').toLowerCase();
  const type = (c.req.query('type') ?? 'single').toLowerCase();
  const country = c.req.query('country') ?? '';
  const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10));
  const size = Math.min(MAX_SIZE, Math.max(1, parseInt(c.req.query('size') ?? String(DEFAULT_SIZE), 10)));

  if (!VALID_EVENTS.has(event)) return c.json({ error: 'Invalid event' }, 400);
  if (type !== 'single' && type !== 'average') return c.json({ error: 'Invalid type' }, 400);
  if (event === '333mbf' && type === 'average') return c.json({ error: 'No average for 333mbf' }, 400);
  const cn = await resolveCountry(country);
  if (!cn.ok) return c.json({ error: cn.err }, 400);

  const offset = (page - 1) * size;
  const rows = await query<{
    rank_in_scope: number; value: number; wca_id: string; person_country_id: string;
    iso2: string | null; comp_id: string; comp_name: string | null; comp_date: string | null;
    attempts: number[] | null; person_name: string;
  }>(
    `
    SELECT t.rank_in_scope, t.value, t.wca_id, t.person_country_id,
           co.iso2 AS iso2,
           t.comp_id, c.name AS comp_name, c.start_date AS comp_date,
           t.attempts, p.name AS person_name
    FROM wca_results_top t
    JOIN wca_persons p ON p.wca_id = t.wca_id
    LEFT JOIN wca_countries co ON co.id = t.person_country_id
    LEFT JOIN wca_competitions c ON c.id = t.comp_id
    WHERE t.event_id = ? AND t.is_avg = ? AND t.country_filter = ?
    ORDER BY t.rank_in_scope ASC
    LIMIT ? OFFSET ?
    `,
    [event, type === 'average', cn.id, size, offset],
  );

  const totalRow = await query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM wca_results_top WHERE event_id = ? AND is_avg = ? AND country_filter = ?`,
    [event, type === 'average', cn.id],
  );
  const total = totalRow[0] ? parseInt(totalRow[0].n, 10) : 0;

  c.header('Cache-Control', CACHE_HEADER);
  return c.json({
    event, type, country: cn.id, page, size, total,
    rows: rows.map(r => ({
      rank: r.rank_in_scope, value: r.value,
      wcaId: r.wca_id, name: r.person_name,
      countryId: r.person_country_id, iso2: r.iso2,
      compId: r.comp_id, compName: r.comp_name, compDate: r.comp_date,
      attempts: r.attempts ?? [],
    })),
  });
});

// ── 3. /v1/wca/year-results ──
wcaStatsExtraRoutes.get('/wca/year-results', async (c) => {
  const year = parseInt(c.req.query('year') ?? '0', 10);
  const month = parseInt(c.req.query('month') ?? '0', 10);  // 0 = 全年
  const event = (c.req.query('event') ?? '333').toLowerCase();
  const type = (c.req.query('type') ?? 'single').toLowerCase();
  const country = c.req.query('country') ?? '';
  const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10));
  const size = Math.min(MAX_SIZE, Math.max(1, parseInt(c.req.query('size') ?? String(DEFAULT_SIZE), 10)));

  if (!Number.isFinite(year) || year < 2003 || year > new Date().getUTCFullYear() + 1) {
    return c.json({ error: 'Invalid year' }, 400);
  }
  if (!VALID_EVENTS.has(event)) return c.json({ error: 'Invalid event' }, 400);
  if (type !== 'single' && type !== 'average') return c.json({ error: 'Invalid type' }, 400);
  if (event === '333mbf' && type === 'average') return c.json({ error: 'No average for 333mbf' }, 400);
  const cn = await resolveCountry(country);
  if (!cn.ok) return c.json({ error: cn.err }, 400);

  const offset = (page - 1) * size;
  const monthCond = month > 0 ? `AND t.comp_month = ?` : '';
  const params: unknown[] = [year, event, type === 'average', cn.id];
  if (month > 0) params.push(month);
  const totalParams = [...params];
  params.push(size, offset);

  const rows = await query<{
    rank_in_scope: number; value: number; wca_id: string; person_country_id: string;
    iso2: string | null; comp_id: string; comp_name: string | null; comp_date: string | null;
    comp_month: number; attempts: number[] | null; person_name: string;
  }>(
    `
    SELECT t.rank_in_scope, t.value, t.wca_id, t.person_country_id,
           co.iso2 AS iso2,
           t.comp_id, c.name AS comp_name, c.start_date AS comp_date,
           t.comp_month, t.attempts, p.name AS person_name
    FROM wca_year_results_top t
    JOIN wca_persons p ON p.wca_id = t.wca_id
    LEFT JOIN wca_countries co ON co.id = t.person_country_id
    LEFT JOIN wca_competitions c ON c.id = t.comp_id
    WHERE t.year = ? AND t.event_id = ? AND t.is_avg = ? AND t.country_filter = ?
      ${monthCond}
    ORDER BY t.rank_in_scope ASC
    LIMIT ? OFFSET ?
    `,
    params,
  );

  const totalRow = await query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM wca_year_results_top
     WHERE year = ? AND event_id = ? AND is_avg = ? AND country_filter = ? ${monthCond}`,
    totalParams,
  );
  const total = totalRow[0] ? parseInt(totalRow[0].n, 10) : 0;

  c.header('Cache-Control', CACHE_HEADER);
  return c.json({
    year, month, event, type, country: cn.id, page, size, total,
    rows: rows.map(r => ({
      rank: r.rank_in_scope, value: r.value,
      wcaId: r.wca_id, name: r.person_name,
      countryId: r.person_country_id, iso2: r.iso2,
      compId: r.comp_id, compName: r.comp_name, compDate: r.comp_date,
      compMonth: r.comp_month,
      attempts: r.attempts ?? [],
    })),
  });
});

// ── 4. /v1/wca/cohort-ranks ──
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
  const ranksCol = isCountryMode ? 'pr.ranks_country' : 'pr.ranks_world';

  // 构造 WHERE
  const where: string[] = [`pr.is_avg = ?`];
  const params: unknown[] = [type === 'average'];
  if (isCountryMode) { where.push(`pr.country_id = ?`); params.push(cn.id); }
  if (hidePodium) where.push(`pr.has_podium = FALSE`);

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
      type, country: cn.id, hidePodium, page, size, total,
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

  // 子集:用 PG 表达式即时算 SUM,索引 1-based
  const sumExpr = eventIdxs!.map(i => `COALESCE(${ranksCol}[${i + 1}], 0)`).join(' + ');
  const offset = (page - 1) * size;
  const totalParams = [...params];
  params.push(size, offset);

  const rows = await query<{
    wca_id: string; country_id: string;
    iso2: string | null;
    events_done: number; subset_total: number;
    ranks_world: number[]; ranks_country: number[];
    person_name: string;
  }>(
    `
    SELECT pr.wca_id, pr.country_id,
           co.iso2 AS iso2,
           pr.events_done,
           (${sumExpr}) AS subset_total,
           pr.ranks_world, pr.ranks_country,
           p.name AS person_name
    FROM wca_person_ranks pr
    JOIN wca_persons p ON p.wca_id = pr.wca_id
    LEFT JOIN wca_countries co ON co.id = pr.country_id
    WHERE ${where.join(' AND ')}
    ORDER BY subset_total ASC, pr.wca_id ASC
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
    type, country: cn.id, hidePodium, page, size, total,
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
