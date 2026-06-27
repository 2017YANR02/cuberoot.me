/**
 * 历史排名查询路由
 *
 * 数据源:`historical_ranks_snapshot` 表(每天 GH Actions 重灌 PG)
 *   每行 = (event, year, person) 在 [WCA 起始 ~ year-12-31] 区间内的累积最佳 + 三层 rank
 *
 * 端点:
 *   GET /v1/wca/historical-ranks?event=333&year=2025&country=CN&type=single&page=1&size=100
 *   GET /v1/wca/historical-ranks/countries  (前端 dropdown 用)
 *   GET /v1/wca/historical-ranks/meta       (返回最近导入时间)
 *
 * Cache-Control: 1 day —— 数据每天才变一次,nginx/CDN 友好.
 */
import { Hono } from 'hono';
import { query } from '../db/connection.js';

export const historicalRanksRoutes = new Hono();

// 21 个 WCA 项目(含已停办,跟 stats-build 对齐)
const VALID_EVENTS = new Set<string>([
  '333','222','444','555','666','777',
  '333bf','333fm','333oh',
  'minx','pyram','clock','skewb','sq1',
  '444bf','555bf','333mbf',
  '333ft','magic','mmagic','333mbo',
]);

const MAX_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 100;

// 大洲筛选:country 入参以 _ 开头 = WCA continent_id。无预算的「大洲名次」,改按世界名次序(走 hrs_*_wr 偏索引)
// 过滤该大洲国家后取行位置当大洲名次(实测毫秒级,见 EXPLAIN)。
const CONTINENT_IDS = new Set([
  '_Africa', '_Asia', '_Europe', '_North America', '_Oceania', '_South America',
]);

// GET /v1/wca/historical-ranks
historicalRanksRoutes.get('/wca/historical-ranks', async (c) => {
  const event = String(c.req.query('event') ?? '333').toLowerCase();
  const year = parseInt(c.req.query('year') ?? '0', 10);
  const country = c.req.query('country') ?? '';                 // '' = worldwide; 否则 country.id 或 ISO2
  const type = String(c.req.query('type') ?? 'single').toLowerCase(); // 'single' | 'average'
  const gender = String(c.req.query('gender') ?? 'all').toLowerCase(); // 'all' | 'm' | 'f'
  const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10));
  const size = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(c.req.query('size') ?? String(DEFAULT_PAGE_SIZE), 10)));

  // ── 校验
  if (!VALID_EVENTS.has(event)) {
    return c.json({ error: 'Invalid event' }, 400);
  }
  if (!Number.isFinite(year) || year < 2003 || year > new Date().getUTCFullYear() + 1) {
    return c.json({ error: 'Invalid year' }, 400);
  }
  if (type !== 'single' && type !== 'average') {
    return c.json({ error: 'Invalid type' }, 400);
  }
  if (gender !== 'all' && gender !== 'm' && gender !== 'f') {
    return c.json({ error: 'Invalid gender' }, 400);
  }
  // 333mbf 没有 average
  if (event === '333mbf' && type === 'average') {
    return c.json({ error: 'No average for 333mbf' }, 400);
  }

  // ── 国家归一化:支持 ISO2('CN')、country.id('China')、WCA continent_id('_Asia' 以 _ 开头 = 大洲)
  let countryId = '';
  let continentId = '';
  if (country) {
    if (country.startsWith('_')) {
      if (!CONTINENT_IDS.has(country)) {
        return c.json({ error: 'Continent not found' }, 400);
      }
      continentId = country;
    } else if (country.length === 2) {
      const rows = await query<{ id: string }>(
        `SELECT id FROM wca_countries WHERE iso2 = ? LIMIT 1`,
        [country.toUpperCase()],
      );
      if (rows.length === 0) {
        return c.json({ error: 'Country not found' }, 400);
      }
      countryId = rows[0]!.id;
    } else {
      countryId = country;
    }
  }

  // ── 选 SQL 列
  const valCol = type === 'single' ? 's.single' : 's.average';
  const wrCol = type === 'single' ? 's.single_world_rank' : 's.avg_world_rank';
  const crCol = type === 'single' ? 's.single_country_rank' : 's.avg_country_rank';
  // PB 上下文列(2026-05 加,migration 0006):show=persons 视图渲染 Date/Competition/Solves 用.
  const compIdCol = type === 'single' ? 's.best_single_comp_id'   : 's.best_average_comp_id';
  const dateCol   = type === 'single' ? 's.best_single_date'      : 's.best_average_date';
  const attsCol   = type === 'single' ? 's.best_single_attempts'  : 's.best_average_attempts';

  // ── 主查询(分页)
  const offset = (page - 1) * size;
  const orderRank = countryId ? crCol : wrCol;

  let rows: {
    wca_id: string;
    name: string;
    val: number | null;
    country_id: string;
    iso2: string | null;
    world_rank: number;
    country_rank: number;
    comp_id: string | null;
    comp_name: string | null;
    comp_date: string | null;
    attempts: number[] | null;
  }[];
  let total: number;

  if (continentId) {
    // 大洲口径:快照无「大洲名次」预算列。按世界名次序(走 hrs_*_wr 偏索引)过滤该大洲国家,
    // 行位置 = 大洲名次(offset+i+1);可叠加性别(同子集内位置即名次)。实测 5–80ms。
    const genderClause = gender !== 'all' ? 'AND p.gender = ?' : '';
    const params: unknown[] = [event, year, continentId];
    if (gender !== 'all') params.push(gender);
    params.push(size, offset);

    rows = await query(
      `
      SELECT
        s.wca_id          AS wca_id,
        p.name            AS name,
        ${valCol}         AS val,
        s.country_id      AS country_id,
        co.iso2           AS iso2,
        ${wrCol}          AS world_rank,
        0                 AS country_rank,
        ${compIdCol}      AS comp_id,
        c.name            AS comp_name,
        ${dateCol}        AS comp_date,
        ${attsCol}        AS attempts
      FROM historical_ranks_snapshot s
      JOIN wca_persons p ON p.wca_id = s.wca_id
      LEFT JOIN wca_countries co ON co.id = s.country_id
      LEFT JOIN wca_competitions c ON c.id = ${compIdCol}
      WHERE s.event_id = ? AND s.year = ? AND ${wrCol} > 0
        AND s.country_id IN (SELECT id FROM wca_countries WHERE continent_id = ?)
        ${genderClause}
      ORDER BY ${wrCol} ASC, s.wca_id ASC
      LIMIT ? OFFSET ?
      `,
      params,
    );
    const countParams: unknown[] = [event, year, continentId];
    if (gender !== 'all') countParams.push(gender);
    const totalRow = await query<{ n: string }>(
      `
      SELECT COUNT(*) AS n
      FROM historical_ranks_snapshot s
      ${gender !== 'all' ? 'JOIN wca_persons p ON p.wca_id = s.wca_id' : ''}
      WHERE s.event_id = ? AND s.year = ? AND ${wrCol} > 0
        AND s.country_id IN (SELECT id FROM wca_countries WHERE continent_id = ?)
        ${genderClause}
      `,
      countParams,
    );
    total = totalRow[0] ? parseInt(totalRow[0].n, 10) : 0;
  } else if (gender === 'all') {
    // 默认快路径:用快照里预算好的全球/国家名次,走索引排序。
    const whereExtra = countryId
      ? `AND ${crCol} > 0 AND s.country_id = ?`
      : `AND ${wrCol} > 0`;
    const params: unknown[] = [event, year];
    if (countryId) params.push(countryId);
    params.push(size, offset);

    rows = await query(
      `
      SELECT
        s.wca_id          AS wca_id,
        p.name            AS name,
        ${valCol}         AS val,
        s.country_id      AS country_id,
        co.iso2           AS iso2,
        ${wrCol}          AS world_rank,
        ${crCol}          AS country_rank,
        ${compIdCol}      AS comp_id,
        c.name            AS comp_name,
        ${dateCol}        AS comp_date,
        ${attsCol}        AS attempts
      FROM historical_ranks_snapshot s
      JOIN wca_persons p ON p.wca_id = s.wca_id
      LEFT JOIN wca_countries co ON co.id = s.country_id
      LEFT JOIN wca_competitions c ON c.id = ${compIdCol}
      WHERE s.event_id = ? AND s.year = ?
        ${whereExtra}
      ORDER BY ${orderRank} ASC, s.wca_id ASC
      LIMIT ? OFFSET ?
      `,
      params,
    );
    const countParams: unknown[] = [event, year];
    if (countryId) countParams.push(countryId);
    const totalRow = await query<{ n: string }>(
      `
      SELECT COUNT(*) AS n
      FROM historical_ranks_snapshot s
      WHERE s.event_id = ? AND s.year = ?
        ${countryId ? `AND ${crCol} > 0 AND s.country_id = ?` : `AND ${wrCol} > 0`}
      `,
      countParams,
    );
    total = totalRow[0] ? parseInt(totalRow[0].n, 10) : 0;
  } else {
    // 性别过滤:快照里的名次是全球/全国口径,不能直接用 → JOIN wca_persons 过滤 gender 后
    // 用 RANK() OVER (ORDER BY 值) 在「该性别(可叠加国家)」子集内重排;按值有成绩 = valCol IS NOT NULL。
    const where = `s.event_id = ? AND s.year = ? AND p.gender = ? AND ${valCol} IS NOT NULL${countryId ? ' AND s.country_id = ?' : ''}`;
    const params: unknown[] = [event, year, gender];
    if (countryId) params.push(countryId);
    const dataParams = [...params, size, offset];

    rows = await query(
      `
      WITH base AS (
        SELECT
          s.wca_id          AS wca_id,
          p.name            AS name,
          ${valCol}         AS val,
          s.country_id      AS country_id,
          co.iso2           AS iso2,
          ${compIdCol}      AS comp_id,
          c.name            AS comp_name,
          ${dateCol}        AS comp_date,
          ${attsCol}        AS attempts
        FROM historical_ranks_snapshot s
        JOIN wca_persons p ON p.wca_id = s.wca_id
        LEFT JOIN wca_countries co ON co.id = s.country_id
        LEFT JOIN wca_competitions c ON c.id = ${compIdCol}
        WHERE ${where}
      ),
      ranked AS (
        SELECT *, RANK() OVER (ORDER BY val ASC) AS rnk FROM base
      )
      SELECT wca_id, name, val, country_id, iso2,
             rnk AS world_rank, rnk AS country_rank,
             comp_id, comp_name, comp_date, attempts
      FROM ranked
      ORDER BY val ASC, wca_id ASC
      LIMIT ? OFFSET ?
      `,
      dataParams,
    );
    const totalRow = await query<{ n: string }>(
      `
      SELECT COUNT(*) AS n
      FROM historical_ranks_snapshot s
      JOIN wca_persons p ON p.wca_id = s.wca_id
      WHERE ${where}
      `,
      params,
    );
    total = totalRow[0] ? parseInt(totalRow[0].n, 10) : 0;
  }

  c.header('Cache-Control', 'public, max-age=300, s-maxage=86400');
  return c.json({
    event,
    year,
    country: continentId || countryId,
    type,
    gender,
    page,
    size,
    total,
    rows: rows.map((r, i) => ({
      // 大洲口径:行位置即大洲名次(已按世界名次序);国家口径:用预算的国家名次;否则世界名次。
      rank: continentId ? offset + i + 1 : countryId ? r.country_rank : r.world_rank,
      wcaId: r.wca_id,
      name: r.name,
      value: r.val,
      countryId: r.country_id,
      iso2: r.iso2,
      compId: r.comp_id,
      compName: r.comp_name,
      compDate: r.comp_date,
      attempts: r.attempts ?? [],
    })),
  });
});

// GET /v1/wca/historical-ranks/countries
// 列出所有有 snapshot 数据的国家(前端下拉菜单用)
historicalRanksRoutes.get('/wca/historical-ranks/countries', async (c) => {
  const rows = await query<{
    id: string;
    iso2: string | null;
    name: string;
    continent_id: string;
  }>(
    `SELECT id, iso2, name, continent_id FROM wca_countries ORDER BY name`,
  );
  c.header('Cache-Control', 'public, max-age=300, s-maxage=86400');
  return c.json({
    countries: rows.map(r => ({
      id: r.id,
      iso2: r.iso2,
      name: r.name,
      continentId: r.continent_id,
    })),
  });
});

// GET /v1/wca/historical-ranks/meta
// 返回最近一次导入时间(前端可显示 "Last updated: ...")
historicalRanksRoutes.get('/wca/historical-ranks/meta', async (c) => {
  const rows = await query<{ value: string; updated_at: Date | string }>(
    `SELECT value, updated_at FROM meta_historical WHERE key = 'last_imported_at'`,
  );
  c.header('Cache-Control', 'public, max-age=300, s-maxage=3600');
  return c.json({
    lastImportedAt: rows[0]?.updated_at ?? null,
  });
});
