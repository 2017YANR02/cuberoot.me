/**
 * WCA fun-stats (趣味统计) — port of cubingchina /results/statistics.
 * 18 端点 /v1/wca/fun/*,数据源 wca_fs_*(stats-build 全量重灌)+ wca_results_top(F 按需).
 * 全部支持 region 三态:world / continent(slug 或 _Asia)/ country(iso2 或 WCA id).
 * 每周才变 → Cache-Control 1 day.
 *
 * 家族:A 各地综合排行;B 奖牌&名次;C 遗憾榜;D 纪录;E 参赛&复原;F Top100 占席.
 */
import { Hono } from 'hono';
import { query } from '../db/connection.js';
import {
  VALID_EVENTS, ACTIVE_EVENTS, MAX_SIZE, DEFAULT_SIZE, CACHE_HEADER,
  resolveCountryFull,
} from './wca_stats_extra.js';

export const wcaFunStatsRoutes = new Hono();

// ── region 解析 ──
type Scope =
  | { kind: 'world' }
  | { kind: 'continent'; continentId: string }
  | { kind: 'country'; countryId: string };

const CONTINENT_SLUG: Record<string, string> = {
  africa: '_Africa', asia: '_Asia', europe: '_Europe',
  northamerica: '_North America', oceania: '_Oceania', southamerica: '_South America',
};

async function resolveScope(input: string): Promise<Scope | { err: string }> {
  const s = (input ?? '').trim();
  if (!s || s.toLowerCase() === 'world') return { kind: 'world' };
  const slug = s.toLowerCase().replace(/[\s_-]/g, '');
  if (CONTINENT_SLUG[slug]) return { kind: 'continent', continentId: CONTINENT_SLUG[slug] };
  if (/^_/.test(s)) return { kind: 'continent', continentId: s };
  const c = await resolveCountryFull(s);
  if (!c) return { err: 'Region not found' };
  return { kind: 'country', countryId: c.id };
}

// region WHERE — 假定调用方已 JOIN wca_countries AS <countriesAlias> ON <countriesAlias>.id = <countryCol>
// (continent 过滤走该 alias;country 过滤直接比 countryCol;world 无过滤)
function regionWhere(scope: Scope, countryCol: string, countriesAlias: string): { where: string; params: unknown[] } {
  if (scope.kind === 'world') return { where: '', params: [] };
  if (scope.kind === 'continent') return { where: ` AND ${countriesAlias}.continent_id = ?`, params: [scope.continentId] };
  return { where: ` AND ${countryCol} = ?`, params: [scope.countryId] };
}

function pageParams(c: { req: { query(k: string): string | undefined } }) {
  const pageRaw = parseInt(c.req.query('page') ?? '', 10);
  const sizeRaw = parseInt(c.req.query('size') ?? '', 10);
  const page = Math.max(1, Number.isFinite(pageRaw) ? pageRaw : 1);
  const size = Math.min(MAX_SIZE, Math.max(1, Number.isFinite(sizeRaw) ? sizeRaw : DEFAULT_SIZE));
  return { page, size, offset: (page - 1) * size };
}

function scopeInput(c: { req: { query(k: string): string | undefined } }) {
  return c.req.query('scope') ?? c.req.query('region') ?? '';
}

const ACTIVE_SET = new Set<string>(ACTIVE_EVENTS as readonly string[]);
const NO_AVERAGE_EVENTS = new Set(['444bf', '555bf', '333mbf']);  // best-of-3,无排名平均

// ════════════════════════════════════════════════════════════════
// A 各地综合排行 — GET /v1/wca/fun/country-sor
// ════════════════════════════════════════════════════════════════
wcaFunStatsRoutes.get('/wca/fun/country-sor', async (c) => {
  const type = (c.req.query('type') ?? 'single').toLowerCase();
  if (type !== 'single' && type !== 'average') return c.json({ error: 'Invalid type' }, 400);
  const gender = (c.req.query('gender') ?? 'all').toLowerCase();
  if (gender !== 'all') return c.json({ error: 'gender filter not available' }, 400);
  const scope = await resolveScope(scopeInput(c));
  if ('err' in scope) return c.json({ error: scope.err }, 400);
  const isAvg = type === 'average';
  const { page, size, offset } = pageParams(c);
  const eventsParam = (c.req.query('events') ?? '').trim();
  c.header('Cache-Control', CACHE_HEADER);

  const metaRows = await query<{ penalties: number[]; all_penalties: number }>(
    `SELECT penalties, all_penalties FROM wca_fs_country_ranks_meta WHERE is_avg = ?`, [isAvg]);
  const penalties = metaRows[0]?.penalties ?? [];
  const allPenalties = metaRows[0]?.all_penalties ?? 0;
  const events = ACTIVE_EVENTS as readonly string[];

  // subset events 子集
  let subsetIdxs: number[] | null = null;
  if (eventsParam) {
    const set = new Set<number>();
    for (const e of eventsParam.split(',').map(s => s.trim()).filter(Boolean)) {
      const i = (ACTIVE_EVENTS as readonly string[]).indexOf(e);
      if (i >= 0) set.add(i);
    }
    if (set.size === 0) return c.json({ error: 'Invalid events list' }, 400);
    const idxs = [...set].sort((a, b) => a - b);
    if (idxs.length !== ACTIVE_EVENTS.length) subsetIdxs = idxs;
  }

  // 子集模式:JS 重算 sum'
  if (subsetIdxs) {
    const allRows = await query<{ country_id: string; per_event_rank: number[] }>(
      `SELECT country_id, per_event_rank FROM wca_fs_country_ranks WHERE is_avg = ?`, [isAvg]);
    let allowed: Set<string> | null = null;
    if (scope.kind === 'continent') {
      const cc = await query<{ id: string }>(`SELECT id FROM wca_countries WHERE continent_id = ?`, [scope.continentId]);
      allowed = new Set(cc.map(r => r.id));
    } else if (scope.kind === 'country') {
      allowed = new Set([scope.countryId]);
    }
    const computed = allRows
      .filter(r => !allowed || allowed.has(r.country_id))
      .map(r => {
        let sum = 0, present = 0;
        // per 补成完整 17 长(非选中位 = 0):客户端按 ACTIVE_EVENTS 全下标渲染矩阵
        const per: number[] = new Array(events.length).fill(0);
        for (const i of subsetIdxs!) {
          const v = r.per_event_rank[i] ?? 0;
          sum += v;
          per[i] = v;
          if (v > 0 && penalties[i] !== undefined && v !== penalties[i]) present++;
        }
        return { country_id: r.country_id, sum, present, per };
      })
      .sort((a, b) => a.sum - b.sum || a.country_id.localeCompare(b.country_id));
    const total = computed.length;
    // 竞技排名 (RANK(): 平局共享名次) 在整表上算,再切片;否则分页后跨页平局名次会错位
    const rankOf = new Map<string, number>();
    let prevSum = -1, prevRank = 0;
    computed.forEach((r, idx) => {
      const rk = r.sum === prevSum ? prevRank : (prevSum = r.sum, prevRank = idx + 1);
      rankOf.set(r.country_id, rk);
    });
    const slice = computed.slice(offset, offset + size);
    const cmeta = await query<{ id: string; iso2: string | null; name: string; continent_id: string }>(
      `SELECT id, iso2, name, continent_id FROM wca_countries`);
    const cm = new Map(cmeta.map(x => [x.id, x]));
    const rows = slice.map((r) => {
      const rank = rankOf.get(r.country_id)!;
      const meta = cm.get(r.country_id);
      return {
        rank, worldRank: rank, countryId: r.country_id, iso2: meta?.iso2 ?? null,
        name: meta?.name ?? r.country_id, continentId: meta?.continent_id ?? null,
        sum: r.sum, eventsPresent: r.present, perEventRank: r.per,
      };
    });
    return c.json({ type, scope: scopeInput(c), gender, page, size, total, events, selectedEvents: subsetIdxs.map(i => events[i]), penalties, allPenalties, rows });
  }

  // country detail
  if (scope.kind === 'country') {
    const rows = await query<{ country_id: string; sum: number; events_present: number; per_event_rank: number[]; iso2: string | null; country_name: string; continent_id: string; world_rank: number }>(
      `SELECT cr.country_id, cr.sum, cr.events_present, cr.per_event_rank, co.iso2, co.name AS country_name, co.continent_id,
        (SELECT COUNT(*) + 1 FROM wca_fs_country_ranks x WHERE x.is_avg = cr.is_avg AND x.sum < cr.sum) AS world_rank
      FROM wca_fs_country_ranks cr JOIN wca_countries co ON co.id = cr.country_id
      WHERE cr.is_avg = ? AND cr.country_id = ?`, [isAvg, scope.countryId]);
    const r = rows[0];
    const self = r ? { rank: r.world_rank, worldRank: r.world_rank, countryId: r.country_id, iso2: r.iso2, name: r.country_name, continentId: r.continent_id, sum: r.sum, eventsPresent: r.events_present, perEventRank: r.per_event_rank } : null;
    return c.json({
      type, scope: scopeInput(c), gender, page, size, total: self ? 1 : 0, events, penalties, allPenalties,
      self, rows: self ? [self] : [],
    });
  }

  // list (world / continent)
  const contWhere = scope.kind === 'continent' ? `AND co.continent_id = ?` : '';
  const baseParams: unknown[] = [isAvg];
  if (scope.kind === 'continent') baseParams.push(scope.continentId);
  const rows = await query<{ country_id: string; sum: number; events_present: number; per_event_rank: number[]; iso2: string | null; country_name: string; continent_id: string; region_rank: number; world_rank: number }>(
    `WITH base AS (
       SELECT cr.country_id, cr.sum, cr.events_present, cr.per_event_rank, co.iso2, co.name AS country_name, co.continent_id
       FROM wca_fs_country_ranks cr JOIN wca_countries co ON co.id = cr.country_id
       WHERE cr.is_avg = ? ${contWhere}
     )
     SELECT b.*, RANK() OVER (ORDER BY b.sum ASC) AS region_rank,
       (SELECT COUNT(*) + 1 FROM wca_fs_country_ranks x WHERE x.is_avg = ? AND x.sum < b.sum) AS world_rank
     FROM base b ORDER BY region_rank ASC, b.country_id ASC LIMIT ? OFFSET ?`,
    [...baseParams, isAvg, size, offset]);
  const totalRow = await query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM wca_fs_country_ranks cr JOIN wca_countries co ON co.id = cr.country_id WHERE cr.is_avg = ? ${contWhere}`,
    baseParams);
  const total = totalRow[0] ? parseInt(totalRow[0].n, 10) : 0;
  return c.json({
    type, scope: scopeInput(c), gender, page, size, total, events, penalties, allPenalties,
    rows: rows.map(r => ({
      rank: r.region_rank, worldRank: r.world_rank, countryId: r.country_id, iso2: r.iso2,
      name: r.country_name, continentId: r.continent_id, sum: r.sum, eventsPresent: r.events_present, perEventRank: r.per_event_rank,
    })),
  });
});

// ════════════════════════════════════════════════════════════════
// B 奖牌榜 — GET /v1/wca/fun/medals?type=all|event&event=
// ════════════════════════════════════════════════════════════════
wcaFunStatsRoutes.get('/wca/fun/medals', async (c) => {
  const type = (c.req.query('type') ?? 'all').toLowerCase();
  if (type !== 'all' && type !== 'event') return c.json({ error: 'Invalid type' }, 400);
  let eventId = '__all__';
  if (type === 'event') {
    eventId = (c.req.query('event') ?? '333').toLowerCase();
    if (!ACTIVE_SET.has(eventId)) return c.json({ error: 'Invalid event' }, 400);
  }
  const scope = await resolveScope(scopeInput(c));
  if ('err' in scope) return c.json({ error: scope.err }, 400);
  const { page, size, offset } = pageParams(c);
  const reg = regionWhere(scope, 'm.country_id', 'co');
  c.header('Cache-Control', CACHE_HEADER);

  const rows = await query<{ wca_id: string; country_id: string; iso2: string | null; person_name: string; gold: number; silver: number; bronze: number; total: number }>(
    `SELECT m.wca_id, m.country_id, co.iso2, p.name AS person_name, m.gold, m.silver, m.bronze, (m.gold + m.silver + m.bronze) AS total
     FROM wca_fs_medals m JOIN wca_persons p ON p.wca_id = m.wca_id LEFT JOIN wca_countries co ON co.id = m.country_id
     WHERE m.event_id = ?${reg.where}
     ORDER BY m.gold DESC, m.silver DESC, m.bronze DESC, p.name ASC LIMIT ? OFFSET ?`,
    [eventId, ...reg.params, size, offset]);
  const totalRow = await query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM wca_fs_medals m LEFT JOIN wca_countries co ON co.id = m.country_id WHERE m.event_id = ?${reg.where}`,
    [eventId, ...reg.params]);
  const total = totalRow[0] ? parseInt(totalRow[0].n, 10) : 0;
  return c.json({
    type, event: type === 'event' ? eventId : undefined, scope: scopeInput(c), page, size, total,
    rows: rows.map((r, i) => ({ rank: offset + i + 1, wcaId: r.wca_id, name: r.person_name, countryId: r.country_id, iso2: r.iso2, gold: r.gold, silver: r.silver, bronze: r.bronze, sum: r.total })),
  });
});

// ════════════════════════════════════════════════════════════════
// B 名次次数 — GET /v1/wca/fun/placements?pos=2|4&type=all|event&event=
// ════════════════════════════════════════════════════════════════
wcaFunStatsRoutes.get('/wca/fun/placements', async (c) => {
  const pos = parseInt(c.req.query('pos') ?? '2', 10);
  if (pos !== 2 && pos !== 4) return c.json({ error: 'Invalid pos' }, 400);
  const type = (c.req.query('type') ?? 'all').toLowerCase();
  if (type !== 'all' && type !== 'event') return c.json({ error: 'Invalid type' }, 400);
  let eventId = '__all__';
  if (type === 'event') {
    eventId = (c.req.query('event') ?? '333').toLowerCase();
    if (!ACTIVE_SET.has(eventId)) return c.json({ error: 'Invalid event' }, 400);
  }
  const scope = await resolveScope(scopeInput(c));
  if ('err' in scope) return c.json({ error: scope.err }, 400);
  const { page, size, offset } = pageParams(c);
  c.header('Cache-Control', CACHE_HEADER);

  // region 过滤在 per-result pl.country_id 上(continent 需专用 join)
  const regJoin = scope.kind === 'continent' ? ` JOIN wca_countries rco ON rco.id = pl.country_id` : '';
  const regWhere = scope.kind === 'continent' ? ` AND rco.continent_id = ?` : (scope.kind === 'country' ? ` AND pl.country_id = ?` : '');
  const regParams: unknown[] = scope.kind === 'continent' ? [scope.continentId] : (scope.kind === 'country' ? [scope.countryId] : []);

  const rows = await query<{ wca_id: string; person_name: string; count: string; country_id: string; iso2: string | null }>(
    `SELECT pl.wca_id, p.name AS person_name, SUM(pl.count) AS count, p.country_id, co.iso2
     FROM wca_fs_placements pl JOIN wca_persons p ON p.wca_id = pl.wca_id
     LEFT JOIN wca_countries co ON co.id = p.country_id${regJoin}
     WHERE pl.pos = ? AND pl.event_id = ?${regWhere}
     GROUP BY pl.wca_id, p.name, p.country_id, co.iso2
     ORDER BY count DESC, p.name ASC LIMIT ? OFFSET ?`,
    [pos, eventId, ...regParams, size, offset]);
  const totalRow = await query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM (
       SELECT pl.wca_id FROM wca_fs_placements pl${regJoin}
       WHERE pl.pos = ? AND pl.event_id = ?${regWhere} GROUP BY pl.wca_id
     ) s`,
    [pos, eventId, ...regParams]);
  const total = totalRow[0] ? parseInt(totalRow[0].n, 10) : 0;
  return c.json({
    pos, type, event: type === 'event' ? eventId : undefined, scope: scopeInput(c), page, size, total,
    rows: rows.map((r, i) => ({ rank: offset + i + 1, wcaId: r.wca_id, name: r.person_name, countryId: r.country_id, iso2: r.iso2, count: parseInt(r.count, 10) })),
  });
});

// ════════════════════════════════════════════════════════════════
// B7 领奖台成绩 — GET /v1/wca/fun/best-podiums?event=
// ════════════════════════════════════════════════════════════════
wcaFunStatsRoutes.get('/wca/fun/best-podiums', async (c) => {
  const eventId = (c.req.query('event') ?? '333').toLowerCase();
  if (!ACTIVE_SET.has(eventId)) return c.json({ error: 'Invalid event' }, 400);
  const scope = await resolveScope(scopeInput(c));
  if ('err' in scope) return c.json({ error: scope.err }, 400);
  const { page, size, offset } = pageParams(c);
  const reg = regionWhere(scope, 'c.country_id', 'cco');
  c.header('Cache-Control', CACHE_HEADER);

  const rows = await query<{
    comp_id: string; event_id: string; sum_value: string; tie: boolean;   // BIGINT → porsager 返字符串
    pos1_wca_id: string; pos1_value: string; pos2_wca_id: string; pos2_value: string; pos3_wca_id: string; pos3_value: string;
    comp_name: string; start_date: string; comp_country_id: string; comp_iso2: string | null;
    pos1_name: string | null; pos2_name: string | null; pos3_name: string | null;
  }>(
    `SELECT bp.comp_id, bp.event_id, bp.sum_value, bp.tie, bp.pos1_wca_id, bp.pos1_value, bp.pos2_wca_id, bp.pos2_value, bp.pos3_wca_id, bp.pos3_value,
       c.name AS comp_name, c.start_date, c.country_id AS comp_country_id, cco.iso2 AS comp_iso2,
       p1.name AS pos1_name, p2.name AS pos2_name, p3.name AS pos3_name
     FROM wca_fs_best_podiums bp JOIN wca_competitions c ON c.id = bp.comp_id
     LEFT JOIN wca_countries cco ON cco.id = c.country_id
     LEFT JOIN wca_persons p1 ON p1.wca_id = bp.pos1_wca_id
     LEFT JOIN wca_persons p2 ON p2.wca_id = bp.pos2_wca_id
     LEFT JOIN wca_persons p3 ON p3.wca_id = bp.pos3_wca_id
     WHERE bp.event_id = ?${reg.where}
     ORDER BY bp.sum_value ASC, bp.comp_id ASC LIMIT ? OFFSET ?`,
    [eventId, ...reg.params, size, offset]);
  const totalRow = await query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM wca_fs_best_podiums bp JOIN wca_competitions c ON c.id = bp.comp_id LEFT JOIN wca_countries cco ON cco.id = c.country_id WHERE bp.event_id = ?${reg.where}`,
    [eventId, ...reg.params]);
  const total = totalRow[0] ? parseInt(totalRow[0].n, 10) : 0;
  return c.json({
    event: eventId, scope: scopeInput(c), page, size, total,
    rows: rows.map((r, i) => ({
      rank: offset + i + 1, compId: r.comp_id, compName: r.comp_name, compDate: r.start_date,
      compCountryId: r.comp_country_id, compIso2: r.comp_iso2, sumValue: Number(r.sum_value), tie: r.tie,
      podium: [
        { pos: 1, wcaId: r.pos1_wca_id || null, name: r.pos1_name, value: Number(r.pos1_value) },
        { pos: 2, wcaId: r.pos2_wca_id || null, name: r.pos2_name, value: Number(r.pos2_value) },
        { pos: 3, wcaId: r.pos3_wca_id || null, name: r.pos3_name, value: Number(r.pos3_value) },
      ],
    })),
  });
});

// ════════════════════════════════════════════════════════════════
// C 遗憾榜 — uncrowned-kings / podium-missers / record-missers
// ════════════════════════════════════════════════════════════════
const DEFAULT_RANK_TYPE_SINGLE = new Set(['333bf', '444bf', '555bf', '333mbf']);
function defaultRankType(event: string): 'single' | 'average' {
  return DEFAULT_RANK_TYPE_SINGLE.has(event) ? 'single' : 'average';
}

async function misserHandler(c: any, flagCol: 'ever_first' | 'ever_podium' | 'ever_record', statId: string) {
  const event = (c.req.query('event') ?? '333').toLowerCase();
  if (!ACTIVE_SET.has(event)) return c.json({ error: 'Invalid event' }, 400);
  const type = (c.req.query('type') ?? defaultRankType(event)).toLowerCase();
  if (type !== 'single' && type !== 'average') return c.json({ error: 'Invalid type' }, 400);
  if (type === 'average' && NO_AVERAGE_EVENTS.has(event)) return c.json({ error: 'No average for this event' }, 400);
  const scope = await resolveScope(scopeInput(c));
  if ('err' in scope) return c.json({ error: scope.err }, 400);
  const isAvg = type === 'average';
  const { page, size, offset } = pageParams(c);
  c.header('Cache-Control', CACHE_HEADER);

  let rows: Array<{ value: number; wca_id: string; country_id: string; iso2: string | null; person_name: string }>;
  let total = 0;
  // value>0 过滤剔除 H 哨兵行 (value=-1:仅为 world/continent bool_or 排除而写,不参与排名)
  if (scope.kind === 'country') {
    rows = await query(
      `SELECT m.value, m.wca_id, m.country_id, co.iso2, p.name AS person_name
       FROM wca_fs_misser m JOIN wca_persons p ON p.wca_id = m.wca_id LEFT JOIN wca_countries co ON co.id = m.country_id
       WHERE m.event_id = ? AND m.is_avg = ? AND m.country_id = ? AND m.value > 0 AND m.${flagCol} = FALSE
       ORDER BY m.value ASC, m.wca_id ASC LIMIT ? OFFSET ?`,
      [event, isAvg, scope.countryId, size, offset]);
    const t = await query<{ n: string }>(
      `SELECT COUNT(*) AS n FROM wca_fs_misser m WHERE m.event_id = ? AND m.is_avg = ? AND m.country_id = ? AND m.value > 0 AND m.${flagCol} = FALSE`,
      [event, isAvg, scope.countryId]);
    total = t[0] ? parseInt(t[0].n, 10) : 0;
  } else {
    const contJoin = scope.kind === 'continent' ? ` JOIN wca_countries cc ON cc.id = m.country_id` : '';
    const contWhere = scope.kind === 'continent' ? ` AND cc.continent_id = ?` : '';
    const contParams: unknown[] = scope.kind === 'continent' ? [scope.continentId] : [];
    // bool_or 须见哨兵(故 WHERE 不过滤 value);MIN/COUNT 用 FILTER 只看真值(value>0).
    // HAVING COUNT FILTER>0 剔除只有哨兵、无真实平均的人(无平均不能上平均榜).
    rows = await query(
      `SELECT g.value, g.wca_id, p.name AS person_name, g.country_id, co.iso2
       FROM (
         SELECT m.wca_id, MIN(m.value) FILTER (WHERE m.value > 0) AS value, bool_or(m.${flagCol}) AS excluded,
           (array_agg(m.country_id ORDER BY (CASE WHEN m.value > 0 THEN m.value ELSE 2147483647 END) ASC, m.country_id ASC))[1] AS country_id
         FROM wca_fs_misser m${contJoin}
         WHERE m.event_id = ? AND m.is_avg = ?${contWhere}
         GROUP BY m.wca_id
         HAVING bool_or(m.${flagCol}) = FALSE AND COUNT(*) FILTER (WHERE m.value > 0) > 0
       ) g JOIN wca_persons p ON p.wca_id = g.wca_id LEFT JOIN wca_countries co ON co.id = g.country_id
       ORDER BY g.value ASC, g.wca_id ASC LIMIT ? OFFSET ?`,
      [event, isAvg, ...contParams, size, offset]);
    const t = await query<{ n: string }>(
      `SELECT COUNT(*) AS n FROM (
         SELECT m.wca_id FROM wca_fs_misser m${contJoin}
         WHERE m.event_id = ? AND m.is_avg = ?${contWhere}
         GROUP BY m.wca_id
         HAVING bool_or(m.${flagCol}) = FALSE AND COUNT(*) FILTER (WHERE m.value > 0) > 0
       ) s`,
      [event, isAvg, ...contParams]);
    total = t[0] ? parseInt(t[0].n, 10) : 0;
  }
  return c.json({
    stat: statId, event, type, scope: scopeInput(c), page, size, total,
    rows: rows.map((r, i) => ({ rank: offset + i + 1, value: r.value, wcaId: r.wca_id, name: r.person_name, countryId: r.country_id, iso2: r.iso2 })),
  });
}

wcaFunStatsRoutes.get('/wca/fun/uncrowned-kings', (c) => misserHandler(c, 'ever_first', 'uncrowned-kings'));
wcaFunStatsRoutes.get('/wca/fun/podium-missers', (c) => misserHandler(c, 'ever_podium', 'podium-missers'));
wcaFunStatsRoutes.get('/wca/fun/record-missers', (c) => misserHandler(c, 'ever_record', 'record-missers'));

// ════════════════════════════════════════════════════════════════
// D1 选手创纪录数 — GET /v1/wca/fun/records-person
// ════════════════════════════════════════════════════════════════
wcaFunStatsRoutes.get('/wca/fun/records-person', async (c) => {
  const scope = await resolveScope(scopeInput(c));
  if ('err' in scope) return c.json({ error: scope.err }, 400);
  const { page, size, offset } = pageParams(c);
  c.header('Cache-Control', CACHE_HEADER);

  if (scope.kind === 'world') {
    const rows = await query<{ wca_id: string; person_name: string; country_id: string; iso2: string | null; wr: string; cr: string; nr: string; score: string }>(
      `SELECT rp.wca_id, p.name AS person_name, p.country_id, co.iso2,
         SUM(rp.wr) AS wr, SUM(rp.cr) AS cr, SUM(rp.nr) AS nr, SUM(rp.score) AS score
       FROM wca_fs_records_person rp JOIN wca_persons p ON p.wca_id = rp.wca_id
       LEFT JOIN wca_countries co ON co.id = p.country_id
       GROUP BY rp.wca_id, p.name, p.country_id, co.iso2 HAVING SUM(rp.score) > 0
       ORDER BY score DESC, wr DESC, cr DESC, nr DESC, rp.wca_id ASC LIMIT ? OFFSET ?`,
      [size, offset]);
    const t = await query<{ n: string }>(`SELECT COUNT(DISTINCT wca_id) AS n FROM wca_fs_records_person WHERE score > 0`);
    const total = t[0] ? parseInt(t[0].n, 10) : 0;
    return c.json({
      scope: scopeInput(c), page, size, total,
      rows: rows.map((r, i) => ({ rank: offset + i + 1, wcaId: r.wca_id, name: r.person_name, countryId: r.country_id, iso2: r.iso2, wr: +r.wr, cr: +r.cr, nr: +r.nr, score: +r.score })),
    });
  }
  if (scope.kind === 'continent') {
    // 同洲多国籍选手按 person 聚合(同 world 路径),否则 (wca_id,country) 拆成多行 + total 虚高
    const rows = await query<{ wca_id: string; person_name: string; country_id: string; iso2: string | null; wr: string; cr: string; nr: string; score: string }>(
      `SELECT rp.wca_id, p.name AS person_name, p.country_id, pco.iso2,
         SUM(rp.wr) AS wr, SUM(rp.cr) AS cr, SUM(rp.nr) AS nr, SUM(rp.score) AS score
       FROM wca_fs_records_person rp JOIN wca_persons p ON p.wca_id = rp.wca_id
       JOIN wca_countries co ON co.id = rp.country_id
       LEFT JOIN wca_countries pco ON pco.id = p.country_id
       WHERE rp.score > 0 AND co.continent_id = ?
       GROUP BY rp.wca_id, p.name, p.country_id, pco.iso2 HAVING SUM(rp.score) > 0
       ORDER BY score DESC, wr DESC, cr DESC, nr DESC, rp.wca_id ASC LIMIT ? OFFSET ?`,
      [scope.continentId, size, offset]);
    const t = await query<{ n: string }>(
      `SELECT COUNT(DISTINCT rp.wca_id) AS n FROM wca_fs_records_person rp JOIN wca_countries co ON co.id = rp.country_id WHERE rp.score > 0 AND co.continent_id = ?`,
      [scope.continentId]);
    const total = t[0] ? parseInt(t[0].n, 10) : 0;
    return c.json({
      scope: scopeInput(c), page, size, total,
      rows: rows.map((r, i) => ({ rank: offset + i + 1, wcaId: r.wca_id, name: r.person_name, countryId: r.country_id, iso2: r.iso2, wr: +r.wr, cr: +r.cr, nr: +r.nr, score: +r.score })),
    });
  }
  // country scope: PK (wca_id, country_id) 保证每国一行,直接平铺
  const reg = regionWhere(scope, 'rp.country_id', 'co');
  const rows = await query<{ wca_id: string; country_id: string; wr: number; cr: number; nr: number; score: number; person_name: string; iso2: string | null }>(
    `SELECT rp.wca_id, rp.country_id, rp.wr, rp.cr, rp.nr, rp.score, p.name AS person_name, co.iso2
     FROM wca_fs_records_person rp JOIN wca_persons p ON p.wca_id = rp.wca_id LEFT JOIN wca_countries co ON co.id = rp.country_id
     WHERE rp.score > 0${reg.where}
     ORDER BY rp.score DESC, rp.wr DESC, rp.cr DESC, rp.nr DESC, rp.wca_id ASC LIMIT ? OFFSET ?`,
    [...reg.params, size, offset]);
  const t = await query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM wca_fs_records_person rp LEFT JOIN wca_countries co ON co.id = rp.country_id WHERE rp.score > 0${reg.where}`,
    reg.params);
  const total = t[0] ? parseInt(t[0].n, 10) : 0;
  return c.json({
    scope: scopeInput(c), page, size, total,
    rows: rows.map((r, i) => ({ rank: offset + i + 1, wcaId: r.wca_id, name: r.person_name, countryId: r.country_id, iso2: r.iso2, wr: r.wr, cr: r.cr, nr: r.nr, score: r.score })),
  });
});

// ════════════════════════════════════════════════════════════════
// D2 赛事创纪录数 — GET /v1/wca/fun/records-comp
// ════════════════════════════════════════════════════════════════
wcaFunStatsRoutes.get('/wca/fun/records-comp', async (c) => {
  const scope = await resolveScope(scopeInput(c));
  if ('err' in scope) return c.json({ error: scope.err }, 400);
  const { page, size, offset } = pageParams(c);
  const reg = regionWhere(scope, 'rc.comp_country_id', 'co');
  c.header('Cache-Control', CACHE_HEADER);
  const rows = await query<{ comp_id: string; comp_country_id: string; wr: number; cr: number; nr: number; score: number; comp_name: string; start_date: string; end_date: string; iso2: string | null }>(
    `SELECT rc.comp_id, rc.comp_country_id, rc.wr, rc.cr, rc.nr, rc.score, c.name AS comp_name, c.start_date, c.end_date, co.iso2
     FROM wca_fs_records_comp rc JOIN wca_competitions c ON c.id = rc.comp_id LEFT JOIN wca_countries co ON co.id = rc.comp_country_id
     WHERE rc.score > 0${reg.where}
     ORDER BY rc.score DESC, rc.wr DESC, rc.cr DESC, rc.nr DESC, rc.comp_id ASC LIMIT ? OFFSET ?`,
    [...reg.params, size, offset]);
  const t = await query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM wca_fs_records_comp rc LEFT JOIN wca_countries co ON co.id = rc.comp_country_id WHERE rc.score > 0${reg.where}`,
    reg.params);
  const total = t[0] ? parseInt(t[0].n, 10) : 0;
  return c.json({
    scope: scopeInput(c), page, size, total,
    rows: rows.map((r, i) => ({ rank: offset + i + 1, compId: r.comp_id, compName: r.comp_name, startDate: r.start_date, endDate: r.end_date, countryId: r.comp_country_id, iso2: r.iso2, wr: r.wr, cr: r.cr, nr: r.nr, score: r.score })),
  });
});

// ════════════════════════════════════════════════════════════════
// D3 纪录现保持时间 — GET /v1/wca/fun/oldest-records
// ════════════════════════════════════════════════════════════════
wcaFunStatsRoutes.get('/wca/fun/oldest-records', async (c) => {
  const scope = await resolveScope(scopeInput(c));
  if ('err' in scope) return c.json({ error: scope.err }, 400);
  const { page, size, offset } = pageParams(c);
  c.header('Cache-Control', CACHE_HEADER);
  const scopeKind = scope.kind === 'world' ? 'W' : scope.kind === 'continent' ? 'K' : 'N';
  const scopeId = scope.kind === 'continent' ? scope.continentId : scope.kind === 'country' ? scope.countryId : '';
  const rows = await query<{ event_id: string; is_avg: boolean; wca_id: string; country_id: string; value: number; set_comp_id: string; set_date: string | null; world_rank: number | null; continent_rank: number | null; country_rank: number | null; person_name: string; iso2: string | null; comp_name: string | null; standing_days: number | null }>(
    `SELECT cr.event_id, cr.is_avg, cr.wca_id, cr.country_id, cr.value, cr.set_comp_id, cr.set_date,
       cr.world_rank, cr.continent_rank, cr.country_rank, p.name AS person_name, co.iso2, c.name AS comp_name,
       (CURRENT_DATE - cr.set_date) AS standing_days
     FROM wca_fs_current_records cr JOIN wca_persons p ON p.wca_id = cr.wca_id
     LEFT JOIN wca_countries co ON co.id = cr.country_id LEFT JOIN wca_competitions c ON c.id = cr.set_comp_id
     WHERE cr.scope_kind = ? AND cr.scope_id = ?
     ORDER BY cr.set_date ASC NULLS LAST, cr.wca_id ASC LIMIT ? OFFSET ?`,
    [scopeKind, scopeId, size, offset]);
  const t = await query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM wca_fs_current_records WHERE scope_kind = ? AND scope_id = ?`, [scopeKind, scopeId]);
  const total = t[0] ? parseInt(t[0].n, 10) : 0;
  return c.json({
    scope: scopeInput(c), page, size, total,
    rows: rows.map((r, i) => ({
      rank: offset + i + 1, eventId: r.event_id, type: r.is_avg ? 'average' : 'single', wcaId: r.wca_id, name: r.person_name,
      countryId: r.country_id, iso2: r.iso2, value: r.value, standingDays: r.standing_days, setDate: r.set_date,
      compId: r.set_comp_id || null, compName: r.comp_name,
      record: scopeKind === 'W' ? 'WR' : scopeKind === 'K' ? 'CR' : 'NR',
      worldRank: r.world_rank, continentRank: r.continent_rank, countryRank: r.country_rank,
    })),
  });
});

// ════════════════════════════════════════════════════════════════
// E 参赛 & 复原次数
// ════════════════════════════════════════════════════════════════
wcaFunStatsRoutes.get('/wca/fun/most-comps-person', async (c) => {
  const scope = await resolveScope(scopeInput(c));
  if ('err' in scope) return c.json({ error: scope.err }, 400);
  const { page, size, offset } = pageParams(c);
  const reg = regionWhere(scope, 't.country_id', 'co');
  c.header('Cache-Control', CACHE_HEADER);
  const rows = await query<{ wca_id: string; country_id: string; comp_count: number; name: string; iso2: string | null }>(
    `SELECT t.wca_id, t.country_id, t.comp_count, p.name, co.iso2
     FROM wca_fs_person_comps t JOIN wca_persons p ON p.wca_id = t.wca_id LEFT JOIN wca_countries co ON co.id = t.country_id
     WHERE 1 = 1${reg.where} ORDER BY t.comp_count DESC, t.wca_id ASC LIMIT ? OFFSET ?`,
    [...reg.params, size, offset]);
  const tot = await query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM wca_fs_person_comps t LEFT JOIN wca_countries co ON co.id = t.country_id WHERE 1 = 1${reg.where}`, reg.params);
  const total = tot[0] ? parseInt(tot[0].n, 10) : 0;
  return c.json({
    scope: scopeInput(c), page, size, total,
    rows: rows.map((r, i) => ({ rank: offset + i + 1, wcaId: r.wca_id, name: r.name, countryId: r.country_id, iso2: r.iso2, count: r.comp_count })),
  });
});

wcaFunStatsRoutes.get('/wca/fun/most-persons-comp', async (c) => {
  const scope = await resolveScope(scopeInput(c));
  if ('err' in scope) return c.json({ error: scope.err }, 400);
  const { page, size, offset } = pageParams(c);
  const reg = regionWhere(scope, 't.comp_country_id', 'co');
  c.header('Cache-Control', CACHE_HEADER);
  const rows = await query<{ comp_id: string; comp_country_id: string; person_count: number; name: string; start_date: string; end_date: string; iso2: string | null }>(
    `SELECT t.comp_id, t.comp_country_id, t.person_count, c.name, c.start_date, c.end_date, co.iso2
     FROM wca_fs_comp_persons t JOIN wca_competitions c ON c.id = t.comp_id LEFT JOIN wca_countries co ON co.id = t.comp_country_id
     WHERE 1 = 1${reg.where} ORDER BY t.person_count DESC, t.comp_id ASC LIMIT ? OFFSET ?`,
    [...reg.params, size, offset]);
  const tot = await query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM wca_fs_comp_persons t LEFT JOIN wca_countries co ON co.id = t.comp_country_id WHERE 1 = 1${reg.where}`, reg.params);
  const total = tot[0] ? parseInt(tot[0].n, 10) : 0;
  return c.json({
    scope: scopeInput(c), page, size, total,
    rows: rows.map((r, i) => ({ rank: offset + i + 1, compId: r.comp_id, compName: r.name, countryId: r.comp_country_id, iso2: r.iso2, startDate: r.start_date, endDate: r.end_date, count: r.person_count })),
  });
});

wcaFunStatsRoutes.get('/wca/fun/most-solves-person-comp', async (c) => {
  const scope = await resolveScope(scopeInput(c));
  if ('err' in scope) return c.json({ error: scope.err }, 400);
  const { page, size, offset } = pageParams(c);
  const reg = regionWhere(scope, 't.country_id', 'rco');
  const regJoin = scope.kind === 'continent' ? ` JOIN wca_countries rco ON rco.id = t.country_id` : '';
  c.header('Cache-Control', CACHE_HEADER);
  const rows = await query<{ wca_id: string; country_id: string; comp_id: string; solve: number; attempt: number; name: string; iso2: string | null; comp_name: string; start_date: string; end_date: string }>(
    `WITH best AS (
       SELECT DISTINCT ON (t.wca_id) t.wca_id, t.country_id, t.comp_id, t.solve, t.attempt
       FROM wca_fs_person_comp_solves t${regJoin} WHERE 1 = 1${reg.where}
       ORDER BY t.wca_id, t.solve DESC, t.attempt ASC, t.comp_id ASC
     )
     SELECT b.wca_id, b.country_id, b.comp_id, b.solve, b.attempt, p.name, co.iso2, c.name AS comp_name, c.start_date, c.end_date
     FROM best b JOIN wca_persons p ON p.wca_id = b.wca_id LEFT JOIN wca_countries co ON co.id = b.country_id
     LEFT JOIN wca_competitions c ON c.id = b.comp_id
     ORDER BY b.solve DESC, b.attempt ASC, b.wca_id ASC LIMIT ? OFFSET ?`,
    [...reg.params, size, offset]);
  const tot = await query<{ n: string }>(
    `SELECT COUNT(DISTINCT t.wca_id) AS n FROM wca_fs_person_comp_solves t${regJoin} WHERE 1 = 1${reg.where}`, reg.params);
  const total = tot[0] ? parseInt(tot[0].n, 10) : 0;
  return c.json({
    scope: scopeInput(c), page, size, total,
    rows: rows.map((r, i) => ({ rank: offset + i + 1, wcaId: r.wca_id, name: r.name, countryId: r.country_id, iso2: r.iso2, compId: r.comp_id, compName: r.comp_name, startDate: r.start_date, endDate: r.end_date, solve: r.solve, attempt: r.attempt })),
  });
});

wcaFunStatsRoutes.get('/wca/fun/most-solves-comp', async (c) => {
  const scope = await resolveScope(scopeInput(c));
  if ('err' in scope) return c.json({ error: scope.err }, 400);
  const { page, size, offset } = pageParams(c);
  const reg = regionWhere(scope, 't.comp_country_id', 'co');
  c.header('Cache-Control', CACHE_HEADER);
  const rows = await query<{ comp_id: string; comp_country_id: string; solve: number; attempt: number; name: string; start_date: string; end_date: string; iso2: string | null }>(
    `SELECT t.comp_id, t.comp_country_id, t.solve, t.attempt, c.name, c.start_date, c.end_date, co.iso2
     FROM wca_fs_comp_solves t JOIN wca_competitions c ON c.id = t.comp_id LEFT JOIN wca_countries co ON co.id = t.comp_country_id
     WHERE 1 = 1${reg.where} ORDER BY t.solve DESC, t.attempt ASC, t.comp_id ASC LIMIT ? OFFSET ?`,
    [...reg.params, size, offset]);
  const tot = await query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM wca_fs_comp_solves t LEFT JOIN wca_countries co ON co.id = t.comp_country_id WHERE 1 = 1${reg.where}`, reg.params);
  const total = tot[0] ? parseInt(tot[0].n, 10) : 0;
  return c.json({
    scope: scopeInput(c), page, size, total,
    rows: rows.map((r, i) => ({ rank: offset + i + 1, compId: r.comp_id, compName: r.name, countryId: r.comp_country_id, iso2: r.iso2, startDate: r.start_date, endDate: r.end_date, solve: r.solve, attempt: r.attempt })),
  });
});

wcaFunStatsRoutes.get('/wca/fun/most-solves-person', async (c) => {
  const scope = await resolveScope(scopeInput(c));
  if ('err' in scope) return c.json({ error: scope.err }, 400);
  const { page, size, offset } = pageParams(c);
  const reg = regionWhere(scope, 't.country_id', 'co');
  c.header('Cache-Control', CACHE_HEADER);
  const rows = await query<{ wca_id: string; country_id: string; solve: number; attempt: number; name: string; iso2: string | null }>(
    `SELECT t.wca_id, t.country_id, t.solve, t.attempt, p.name, co.iso2
     FROM wca_fs_person_solves t JOIN wca_persons p ON p.wca_id = t.wca_id LEFT JOIN wca_countries co ON co.id = t.country_id
     WHERE 1 = 1${reg.where} ORDER BY t.solve DESC, t.attempt ASC, t.wca_id ASC LIMIT ? OFFSET ?`,
    [...reg.params, size, offset]);
  const tot = await query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM wca_fs_person_solves t LEFT JOIN wca_countries co ON co.id = t.country_id WHERE 1 = 1${reg.where}`, reg.params);
  const total = tot[0] ? parseInt(tot[0].n, 10) : 0;
  return c.json({
    scope: scopeInput(c), page, size, total,
    rows: rows.map((r, i) => ({ rank: offset + i + 1, wcaId: r.wca_id, name: r.name, countryId: r.country_id, iso2: r.iso2, solve: r.solve, attempt: r.attempt })),
  });
});

wcaFunStatsRoutes.get('/wca/fun/most-solves-person-year/years', async (c) => {
  const scope = await resolveScope(scopeInput(c));
  if ('err' in scope) return c.json({ error: scope.err }, 400);
  const reg = regionWhere(scope, 't.country_id', 'co');
  c.header('Cache-Control', CACHE_HEADER);
  const rows = await query<{ year: number }>(
    `SELECT DISTINCT t.year FROM wca_fs_person_year_solves t LEFT JOIN wca_countries co ON co.id = t.country_id WHERE 1 = 1${reg.where} ORDER BY t.year DESC`,
    reg.params);
  return c.json({ scope: scopeInput(c), years: rows.map(r => r.year) });
});

wcaFunStatsRoutes.get('/wca/fun/most-solves-person-year', async (c) => {
  const scope = await resolveScope(scopeInput(c));
  if ('err' in scope) return c.json({ error: scope.err }, 400);
  const { page, size, offset } = pageParams(c);
  const reg = regionWhere(scope, 't.country_id', 'co');
  c.header('Cache-Control', CACHE_HEADER);
  let year = parseInt(c.req.query('year') ?? '0', 10);
  if (!year) {
    const yr = await query<{ year: number }>(
      `SELECT MAX(t.year) AS year FROM wca_fs_person_year_solves t LEFT JOIN wca_countries co ON co.id = t.country_id WHERE 1 = 1${reg.where}`, reg.params);
    year = yr[0]?.year ?? 0;
  }
  const rows = await query<{ wca_id: string; country_id: string; year: number; solve: number; attempt: number; name: string; iso2: string | null }>(
    `SELECT t.wca_id, t.country_id, t.year, t.solve, t.attempt, p.name, co.iso2
     FROM wca_fs_person_year_solves t JOIN wca_persons p ON p.wca_id = t.wca_id LEFT JOIN wca_countries co ON co.id = t.country_id
     WHERE t.year = ?${reg.where} ORDER BY t.solve DESC, t.attempt ASC, t.wca_id ASC LIMIT ? OFFSET ?`,
    [year, ...reg.params, size, offset]);
  const tot = await query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM wca_fs_person_year_solves t LEFT JOIN wca_countries co ON co.id = t.country_id WHERE t.year = ?${reg.where}`, [year, ...reg.params]);
  const total = tot[0] ? parseInt(tot[0].n, 10) : 0;
  return c.json({
    scope: scopeInput(c), year, page, size, total,
    rows: rows.map((r, i) => ({ rank: offset + i + 1, wcaId: r.wca_id, name: r.name, countryId: r.country_id, iso2: r.iso2, year: r.year, solve: r.solve, attempt: r.attempt })),
  });
});

// ════════════════════════════════════════════════════════════════
// F Top100 占席 — GET /v1/wca/fun/top100-appearances  (on-the-fly)
// ════════════════════════════════════════════════════════════════
const NO_AVERAGE = new Set(['444bf', '555bf', '333mbf']);
wcaFunStatsRoutes.get('/wca/fun/top100-appearances', async (c) => {
  const event = (c.req.query('event') ?? '333').toLowerCase();
  if (!VALID_EVENTS.has(event)) return c.json({ error: 'Invalid event' }, 400);
  const type = (c.req.query('type') ?? 'single').toLowerCase();
  if (type !== 'single' && type !== 'average') return c.json({ error: 'Invalid type' }, 400);
  if (type === 'average' && NO_AVERAGE.has(event)) return c.json({ error: 'No average for this event' }, 400);
  const scope = await resolveScope(scopeInput(c));
  if ('err' in scope) return c.json({ error: scope.err }, 400);
  const isAvg = type === 'average';
  const { page, size, offset } = pageParams(c);
  c.header('Cache-Control', CACHE_HEADER);

  // 内层 top-200(region 过滤在 LIMIT 前)→ RANK()<=100 → 占席计数 → enrich + 分页
  let topCte: string; let topParams: unknown[];
  if (scope.kind === 'world') {
    topCte = `SELECT wca_id, value FROM wca_results_top WHERE event_id = ? AND is_avg = ? AND value > 0 ORDER BY value ASC LIMIT 200`;
    topParams = [event, isAvg];
  } else if (scope.kind === 'country') {
    topCte = `SELECT wca_id, value FROM wca_results_top WHERE event_id = ? AND is_avg = ? AND value > 0 AND person_country_id = ? ORDER BY value ASC LIMIT 200`;
    topParams = [event, isAvg, scope.countryId];
  } else {
    topCte = `SELECT t.wca_id, t.value FROM wca_results_top t WHERE t.event_id = ? AND t.is_avg = ? AND t.value > 0 AND t.person_country_id IN (SELECT id FROM wca_countries WHERE continent_id = ?) ORDER BY t.value ASC LIMIT 200`;
    topParams = [event, isAvg, scope.continentId];
  }
  const rows = await query<{ wca_id: string; appearances: number; best_value: number; person_name: string; person_country_id: string; iso2: string | null }>(
    `WITH top AS (${topCte}),
     ranked AS (SELECT wca_id, value, RANK() OVER (ORDER BY value ASC) AS vr FROM top),
     g AS (SELECT wca_id, COUNT(*)::int AS appearances, MIN(value)::int AS best_value FROM ranked WHERE vr <= 100 GROUP BY wca_id)
     SELECT g.wca_id, g.appearances, g.best_value, p.name AS person_name, p.country_id AS person_country_id, co.iso2
     FROM g JOIN wca_persons p ON p.wca_id = g.wca_id LEFT JOIN wca_countries co ON co.id = p.country_id
     ORDER BY g.appearances DESC, g.best_value ASC, g.wca_id ASC LIMIT ? OFFSET ?`,
    [...topParams, size, offset]);
  const tot = await query<{ n: string }>(
    `WITH top AS (${topCte}), ranked AS (SELECT wca_id, RANK() OVER (ORDER BY value ASC) AS vr FROM top)
     SELECT COUNT(DISTINCT wca_id)::int AS n FROM ranked WHERE vr <= 100`, topParams);
  const total = tot[0] ? parseInt(tot[0].n, 10) : 0;
  return c.json({
    event, type, scope: scopeInput(c), page, size, total,
    rows: rows.map((r, i) => ({ rank: offset + i + 1, wcaId: r.wca_id, name: r.person_name, countryId: r.person_country_id, iso2: r.iso2, appearances: r.appearances, bestValue: r.best_value })),
  });
});
