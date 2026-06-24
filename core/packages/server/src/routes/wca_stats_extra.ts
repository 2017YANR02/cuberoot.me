/**
 * WCA stats extra — 6 + 2 个 cubing.pro 风格统计 tab / 选手页查询路由.
 *
 * 数据源: wca_grand_slam / wca_results_flat
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
 *   GET /v1/wca/sum-of-ranks/census?type=&cancelled=&no_podium=&year=&timeline=  (历史名人堂:历年名次和第一)
 *   GET /v1/wca/sum-of-ranks/player-best?wcaId=           (指定选手最优项目组合 + 支柱/毒药/自由项剖析)
 *   GET /v1/wca/sum-of-ranks/person-subset?wcaId=&events= (自选组合计算器:该子集下选手的名次和+世界第几)
 *   GET /v1/wca/person-best-ranks?wcaId=
 *   GET /v1/wca/person-rank-history?wcaId=&eventId=
 *
 * 缓存分层(2026-06-10 起):nginx s-maxage=86400(重灌后 stats.yml 全清);浏览器 max-age=300 ——
 * 数据日更可变,浏览器层一旦钉住坏/旧响应,nginx purge 与站点清数据都够不到,只能等过期(踩过 24h).
 */
import { Hono } from 'hono';
import { query } from '../db/connection.js';

export const wcaStatsExtraRoutes = new Hono();

export const VALID_EVENTS = new Set<string>([
  '333','222','444','555','666','777',
  '333bf','333fm','333oh',
  'minx','pyram','clock','skewb','sq1',
  '444bf','555bf','333mbf',
  '333ft','magic','mmagic','333mbo',
]);
export const ACTIVE_EVENTS = [
  '333','222','444','555','666','777',
  '333bf','333fm','333oh',
  'minx','pyram','clock','skewb','sq1',
  '444bf','555bf','333mbf',
] as const;
// person_ranks 数组顺序:活跃 17 项(index 0-16,对齐 total_*)+ 4 个废止项(17-20).
// 仅 sum-of-ranks 用;其余端点(/rank-for 等)仍只认 ACTIVE_EVENTS.
const CANCELLED_EVENTS = ['333ft', 'magic', 'mmagic', '333mbo'] as const;
const RANK_EVENTS = [...ACTIVE_EVENTS, ...CANCELLED_EVENTS] as const;

export const MAX_SIZE = 200;
export const DEFAULT_SIZE = 100;
// 浏览器层必须短:这族数据天天重灌,长 max-age 会把暂态/旧 shape 响应钉死在用户浏览器里 24h
export const CACHE_HEADER = 'public, max-age=300, s-maxage=86400';

// NaN 防御:parseInt('abc') = NaN,Math.max/min(NaN) 仍 NaN → 绑进 LIMIT/OFFSET 触发 query error。
function intParam(raw: string | undefined, dflt: number): number {
  const v = parseInt(raw ?? '', 10);
  return Number.isFinite(v) ? v : dflt;
}

// 国家 ISO2/id 归一化
export async function resolveCountry(input: string): Promise<{ ok: true; id: string } | { ok: false; err: string }> {
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
// ORDER BY value 走 wrf_main / wrf_country / wrf_wca_id / wrf_comp_id 索引.
// q 在 wca_persons.name 和 wca_competitions.name 上 ILIKE,各 LIMIT 200.
wcaStatsExtraRoutes.get('/wca/all-results', async (c) => {
  const event = (c.req.query('event') ?? '333').toLowerCase();
  const type = (c.req.query('type') ?? 'single').toLowerCase();
  const country = c.req.query('country') ?? '';
  const year = parseInt(c.req.query('year') ?? '0', 10);   // 0 = 全部
  const month = parseInt(c.req.query('month') ?? '0', 10); // 0 = 全部
  const q = (c.req.query('q') ?? '').trim();
  const basis = (c.req.query('basis') ?? 'period').toLowerCase();  // 'period'(当期) | 'cumulative'(截至年末)
  const group = (c.req.query('group') ?? 'result').toLowerCase();  // 'result'(每条成绩) | 'person'(每选手一行)
  const gender = (c.req.query('gender') ?? 'all').toLowerCase();   // 'all' | 'm' | 'f';性别下拉,JOIN wca_persons 过滤
  const page = Math.max(1, intParam(c.req.query('page'), 1));
  const size = Math.min(MAX_SIZE, Math.max(1, intParam(c.req.query('size'), DEFAULT_SIZE)));

  if (!VALID_EVENTS.has(event)) return c.json({ error: 'Invalid event' }, 400);
  if (basis !== 'period' && basis !== 'cumulative') return c.json({ error: 'Invalid basis' }, 400);
  if (group !== 'result' && group !== 'person') return c.json({ error: 'Invalid group' }, 400);
  if (type !== 'single' && type !== 'average') return c.json({ error: 'Invalid type' }, 400);
  if (gender !== 'all' && gender !== 'm' && gender !== 'f') return c.json({ error: 'Invalid gender' }, 400);
  // 333mbf 平均 = 非官方 Mo3,数据由 wca_results_flat 的 is_avg=true 行提供(builder 现算写入)。
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
  if (year) {
    if (basis === 'cumulative') {
      // 截至:到该年末为止(月份在截至口径下无意义,前端置灰,这里忽略)
      where.push(`t.comp_year <= ?`); params.push(year);
    } else {
      // 当期:仅该自然年(+ 可选月份;表达式与 wrf_month 索引对齐才能走索引)
      where.push(`t.comp_year = ?`); params.push(year);
      if (month) { where.push(`(EXTRACT(MONTH FROM t.comp_date))::int = ?`); params.push(month); }
    }
  }

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

  // 性别过滤:gender 是每人恒定值(wca_persons.gender),JOIN 进来过滤即可,不必灌进 11M 行的 wca_results_flat。
  // JOIN 出现在 FROM 之后、WHERE 之前 → 其 ? 占位排在 where 参数前,故 genderParams 必须前置拼接。
  // 名次按行位置算,自动在性别子集内重排(与「按国家筛会重排」一致)。
  const genderJoin = gender === 'all' ? '' : `JOIN wca_persons gp ON gp.wca_id = t.wca_id AND gp.gender = ?`;
  const genderParams: unknown[] = gender === 'all' ? [] : [gender];

  const offset = (page - 1) * size;
  const totalParams = [...genderParams, ...params];
  const dataParams = [...genderParams, ...params, size, offset];

  // ── group=person:每选手一行(区间内最佳),实时聚合 over wca_results_flat ──
  // bests: DISTINCT ON 取每人最小值 + 其 PB 上下文(comp/date/attempts);
  // RANK 按 value 给名次(选了国家时即国家名次,因 where 已限定单国家);
  // 走 wrf_year(当期年 / 截至年 comp_year<=)/ wrf_month(当期月),~0.4–1s;LIMIT 后再 join 字典表只 enrich 100 行.
  // 选手页恒带 year(persons 模式 year=0 会被前端兜成当年),不会触发全时段全量聚合.
  if (group === 'person') {
    const [rows, totalRow] = await Promise.all([
      query<{
        rnk: string; value: number; wca_id: string; person_country_id: string;
        iso2: string | null; comp_id: string | null; comp_name: string | null;
        comp_date: string | null; attempts: number[] | null; person_name: string;
      }>(
        `
        WITH bests AS (
          SELECT DISTINCT ON (t.wca_id)
                 t.wca_id, t.value, t.person_country_id, t.comp_id, t.comp_date, t.attempts
          FROM wca_results_flat t
          ${genderJoin}
          WHERE ${where.join(' AND ')}
          ORDER BY t.wca_id, t.value ASC
        ),
        ranked AS (
          SELECT *, RANK() OVER (ORDER BY value ASC) AS rnk FROM bests
        ),
        pg AS (
          SELECT * FROM ranked ORDER BY value ASC, wca_id ASC LIMIT ? OFFSET ?
        )
        SELECT r.rnk, r.value, r.wca_id, r.person_country_id,
               co.iso2 AS iso2, r.comp_id, c.name AS comp_name, r.comp_date, r.attempts,
               p.name AS person_name
        FROM pg r
        JOIN wca_persons p ON p.wca_id = r.wca_id
        LEFT JOIN wca_countries co ON co.id = r.person_country_id
        LEFT JOIN wca_competitions c ON c.id = r.comp_id
        ORDER BY r.value ASC, r.wca_id ASC
        `,
        dataParams,
      ),
      query<{ n: string }>(
        `SELECT COUNT(*) AS n FROM (SELECT DISTINCT t.wca_id FROM wca_results_flat t ${genderJoin} WHERE ${where.join(' AND ')}) s`,
        totalParams,
      ),
    ]);
    const total = totalRow[0] ? parseInt(totalRow[0].n, 10) : 0;
    c.header('Cache-Control', CACHE_HEADER);
    return c.json({
      event, type, country: cn.id, year, month, basis, group, gender, page, size, total,
      rows: rows.map(r => ({
        rank: parseInt(r.rnk, 10), value: r.value,
        wcaId: r.wca_id, name: r.person_name,
        countryId: r.person_country_id, iso2: r.iso2,
        compId: r.comp_id, compName: r.comp_name, compDate: r.comp_date,
        attempts: r.attempts ?? [],
      })),
    });
  }

  // 派生表 + late join 走 id PK 回表:
  // 内子查询只 SELECT (id, value, wca_id) — 三列都覆盖在 wrf_main INCLUDE (id) 索引里,
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
        FROM wca_results_flat t
        ${genderJoin}
        WHERE ${where.join(' AND ')}
        ORDER BY t.value ASC, t.wca_id ASC
        LIMIT ? OFFSET ?
      ) q
      JOIN wca_results_flat t ON t.id = q.id
      JOIN wca_persons p ON p.wca_id = t.wca_id
      LEFT JOIN wca_countries co ON co.id = t.person_country_id
      LEFT JOIN wca_competitions c ON c.id = t.comp_id
      ORDER BY q.value ASC, q.wca_id ASC
      `,
      dataParams,
    ),
    query<{ n: string }>(
      `SELECT COUNT(*) AS n FROM wca_results_flat t ${genderJoin} WHERE ${where.join(' AND ')}`,
      totalParams,
    ),
  ]);
  const total = totalRow[0] ? parseInt(totalRow[0].n, 10) : 0;

  c.header('Cache-Control', CACHE_HEADER);
  return c.json({
    event, type, country: cn.id, year, month, q, gender, page, size, total,
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

// ── 2a. /v1/wca/persons-directory ──
//   GET /v1/wca/persons-directory?country=&sort=name|len&dir=asc|desc&name=latin|full|local|aka&lmin=&lmax=&page=&size=
//   lmin/lmax:按当前名字口径的字符长度筛选(空 = 不限)。
// 排名页空态(未选任何项目)的「名录」视图:全选手 A-Z,可叠加国家,按 名字首字母 / 名字长度 分页排序.
// 名字口径 name(与姓名分布 name_stats 四档对齐):
//   latin(默认)= 剥本地名注释后的拉丁名;full = 完整 WCA 名(含括号);
//   local = 仅括号内本地名(只列有本地名的选手);aka = 全名 + 曾用名(LEFT JOIN wca_person_aka).
// wca_persons ~25 万行小表;latin/full 长度排序走 wca_persons_name_len / wca_persons_full_len 索引;
//   首字母走 wca_persons_name;local/aka 走全表扫(子集小 / 有 nginx 缓存兜底).
// 长度表达式须与 migration 0052/0053 索引逐字一致才能命中.
wcaStatsExtraRoutes.get('/wca/persons-directory', async (c) => {
  const country = c.req.query('country') ?? '';
  const sort = (c.req.query('sort') ?? 'name').toLowerCase();   // 'name'(首字母) | 'len'(名字长度)
  const dir = (c.req.query('dir') ?? 'asc').toLowerCase();      // 'asc' | 'desc'
  const nameMode = (c.req.query('name') ?? 'latin').toLowerCase(); // latin | full | local | aka
  const gender = (c.req.query('gender') ?? 'all').toLowerCase();   // 'all' | 'm' | 'f'
  const page = Math.max(1, intParam(c.req.query('page'), 1));
  const size = Math.min(MAX_SIZE, Math.max(1, intParam(c.req.query('size'), DEFAULT_SIZE)));

  if (sort !== 'name' && sort !== 'len') return c.json({ error: 'Invalid sort' }, 400);
  if (dir !== 'asc' && dir !== 'desc') return c.json({ error: 'Invalid dir' }, 400);
  if (!['latin', 'full', 'local', 'aka'].includes(nameMode)) return c.json({ error: 'Invalid name' }, 400);
  if (gender !== 'all' && gender !== 'm' && gender !== 'f') return c.json({ error: 'Invalid gender' }, 400);
  const cn = await resolveCountry(country);
  if (!cn.ok) return c.json({ error: cn.err }, 400);

  // 本地名 = 末尾括号内的内容(与 name_stats / 客户端口径一致)
  const LOCAL_EXTRACT = `substring(p.name from '\\(([^)]+)\\)\\s*$')`;
  const dirSql = dir === 'desc' ? 'DESC' : 'ASC';
  // 当前名字口径的「字符长度」表达式 —— 排序 + 长度筛选共用(须与 migration 0052/0053 索引逐字一致)
  const lenExpr =
    nameMode === 'full'  ? `char_length(p.name)` :
    nameMode === 'local' ? `char_length(${LOCAL_EXTRACT})` :
    nameMode === 'aka'   ? `COALESCE(a.aka_len, char_length(p.name))` :
                           `char_length(regexp_replace(p.name, '\\s*\\([^)]*\\)\\s*$', ''))`;
  const alphaExpr = nameMode === 'local' ? LOCAL_EXTRACT : `p.name`;

  // 长度区间筛选(按当前名字口径的字符数;空 = 不限)
  const parseLen = (v: string | undefined) => {
    if (v == null || v === '') return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const lenMin = parseLen(c.req.query('lmin'));
  const lenMax = parseLen(c.req.query('lmax'));

  // 含曾用名:LEFT JOIN 小表取曾用名数组 + 合并长度;长度表达式/筛选也靠它,故两条查询都要 join
  const akaJoin = nameMode === 'aka' ? `LEFT JOIN wca_person_aka a ON a.wca_id = p.wca_id` : '';
  const akaSelect = nameMode === 'aka' ? `, a.former_names` : '';

  const where: string[] = [];
  const params: unknown[] = [];
  if (cn.id) { where.push(`p.country_id = ?`); params.push(cn.id); }
  if (gender !== 'all') { where.push(`p.gender = ?`); params.push(gender); }
  // 本地名口径只列真有本地名的选手
  if (nameMode === 'local') where.push(`p.name ~ '\\([^)]+\\)\\s*$'`);
  if (lenMin != null) { where.push(`${lenExpr} >= ?`); params.push(lenMin); }
  if (lenMax != null) { where.push(`${lenExpr} <= ?`); params.push(lenMax); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const orderSql = sort === 'len'
    ? `${lenExpr} ${dirSql}, p.name ASC, p.wca_id ASC`
    : `${alphaExpr} ${dirSql}, p.wca_id ASC`;

  const offset = (page - 1) * size;
  const [rows, totalRow] = await Promise.all([
    query<{ wca_id: string; name: string; country_id: string; iso2: string | null; former_names?: string[] | null }>(
      `SELECT p.wca_id, p.name, p.country_id, co.iso2${akaSelect}
       FROM wca_persons p
       LEFT JOIN wca_countries co ON co.id = p.country_id
       ${akaJoin}
       ${whereSql}
       ORDER BY ${orderSql}
       LIMIT ? OFFSET ?`,
      [...params, size, offset],
    ),
    query<{ n: string }>(
      `SELECT COUNT(*) AS n FROM wca_persons p ${akaJoin} ${whereSql}`,
      params,
    ),
  ]);
  const total = totalRow[0] ? parseInt(totalRow[0].n, 10) : 0;
  c.header('Cache-Control', CACHE_HEADER);
  return c.json({
    country: cn.id, sort, dir, name: nameMode, gender, lenMin, lenMax, page, size, total,
    rows: rows.map(r => ({
      wcaId: r.wca_id, name: r.name, countryId: r.country_id, iso2: r.iso2,
      ...(r.former_names && r.former_names.length ? { former: r.former_names } : {}),
    })),
  });
});

// ── 2a-bis. /v1/wca/person-aka ──
//   GET /v1/wca/person-aka?wcaId=
// 选手详情页 hero 展示历史身份「曾经是 X - 国家」。数据来自 wca_person_aka.former_detail
//   ([{name, iso2}],含纯改国籍;former_names 那侧只名字去重,口径不同故另存一列)。
// 绝大多数人无曾用身份 → 空数组;表近静态,空响应也走 1 天缓存,避免每个选手页都回源。
wcaStatsExtraRoutes.get('/wca/person-aka', async (c) => {
  const wcaId = (c.req.query('wcaId') ?? '').trim().toUpperCase();
  if (!/^[0-9]{4}[A-Z]{4}[0-9]{2}$/.test(wcaId)) return c.json({ error: 'Invalid wcaId' }, 400);
  const rows = await query<{ former_detail: { name: string; iso2: string | null }[] | null }>(
    `SELECT former_detail FROM wca_person_aka WHERE wca_id = ?`,
    [wcaId],
  );
  const former = (rows[0]?.former_detail ?? []).filter(f => f && f.name);
  c.header('Cache-Control', CACHE_HEADER);
  return c.json({ wcaId, former });
});

// ── 2a-ter. /v1/wca/person-misc ──
//   GET /v1/wca/person-misc?wcaId=
// 选手详情页「杂项」tab 的两个表:最亲密魔友(同场比赛最多的选手)+ 见过的魔友(同场次数分布).
// 复刻 cubingchina results/p 的 closestCubers + seenCubers(SQL over results).
// 数据源 wca_results_flat 含 DNF/DNS 行(value 可 <=0,见 rank-for 注释),故「按 comp_id 计 DISTINCT」
//   即等价「同场出现过」;注意「同人同 comp 多 round/event 多行」→ 必须 COUNT(DISTINCT comp_id).
// 「去过的省份」由客户端用 comps + 静态省份表算,不在此端点.
// 两步走:先取本人参赛 comp(走 wrf_wca_id 的 wca_id 前缀),再按 comp_id IN(...)分组(走 wrf_comp_lookup),
//   避免 IN(子查询)的 planner 不确定性.
wcaStatsExtraRoutes.get('/wca/person-misc', async (c) => {
  const wcaId = (c.req.query('wcaId') ?? '').trim().toUpperCase();
  if (!/^[0-9]{4}[A-Z]{4}[0-9]{2}$/.test(wcaId)) return c.json({ error: 'Invalid wcaId' }, 400);

  const compRows = await query<{ comp_id: string }>(
    `SELECT DISTINCT comp_id FROM wca_results_flat WHERE wca_id = ?`,
    [wcaId],
  );
  const compIds = compRows.map(r => r.comp_id);
  if (compIds.length === 0) {
    c.header('Cache-Control', CACHE_HEADER);
    return c.json({ wcaId, myComps: 0, totalMet: 0, closest: [], distribution: [] });
  }

  const placeholders = compIds.map(() => '?').join(',');
  const rows = await query<{ wca_id: string; shared: number }>(
    `SELECT wca_id, COUNT(DISTINCT comp_id)::int AS shared
       FROM wca_results_flat
      WHERE comp_id IN (${placeholders})
      GROUP BY wca_id`,
    compIds,
  );

  const others: { wcaId: string; shared: number }[] = [];
  const dist = new Map<number, number>();
  for (const r of rows) {
    if (r.wca_id === wcaId) continue; // 排除本人(shared = myComps)
    const shared = Number(r.shared);
    others.push({ wcaId: r.wca_id, shared });
    dist.set(shared, (dist.get(shared) ?? 0) + 1);
  }

  // 最亲密魔友:共同参赛数 desc,同分按 wcaId 升序;取 top 20.
  others.sort((a, b) => b.shared - a.shared || (a.wcaId < b.wcaId ? -1 : 1));
  const top = others.slice(0, 20);
  let info = new Map<string, { name: string; iso2: string | null }>();
  if (top.length) {
    const nrows = await query<{ wca_id: string; name: string; iso2: string | null }>(
      `SELECT p.wca_id, p.name, co.iso2
         FROM wca_persons p
         LEFT JOIN wca_countries co ON co.id = p.country_id
        WHERE p.wca_id IN (${top.map(() => '?').join(',')})`,
      top.map(t => t.wcaId),
    );
    info = new Map(nrows.map(n => [n.wca_id, { name: n.name, iso2: n.iso2 }]));
  }
  const closest = top.map(t => {
    const i = info.get(t.wcaId);
    return { wcaId: t.wcaId, name: i?.name ?? t.wcaId, iso2: i?.iso2 ?? null, shared: t.shared };
  });

  // 见过的魔友:同场次数 → 人数,升序.
  const distribution = [...dist.entries()]
    .map(([shared, cubers]) => ({ shared, cubers }))
    .sort((a, b) => a.shared - b.shared);

  c.header('Cache-Control', CACHE_HEADER);
  return c.json({ wcaId, myComps: compIds.length, totalMet: others.length, closest, distribution });
});

// ── 2a-quater. /v1/wca/person-championship-podiums ──
//   GET /v1/wca/person-championship-podiums?wcaId=
// 选手页「锦标赛领奖台」tab。预计算表 wca_championship_podiums(builder 资格内重排,见
//   stats-build/core/championship_podiums.ts)逐行返回,客户端按 scope/level/comp 分组展示。
// level: 'world' | 大洲 id('_North America') | 国家 iso2('US') | 多国类型('greater_china')。
wcaStatsExtraRoutes.get('/wca/person-championship-podiums', async (c) => {
  const wcaId = (c.req.query('wcaId') ?? '').trim().toUpperCase();
  if (!/^[0-9]{4}[A-Z]{4}[0-9]{2}$/.test(wcaId)) return c.json({ error: 'Invalid wcaId' }, 400);

  const rows = await query<{
    comp_id: string; event_id: string; level: string; place: number;
    best: number; average: number; attempts: number[] | null;
    single_record: string; average_record: string;
    comp_name: string | null; start_date: string | null; comp_country_id: string | null;
  }>(
    `SELECT p.comp_id, p.event_id, p.level, p.place, p.best, p.average, p.attempts,
            p.single_record, p.average_record,
            c.name AS comp_name, c.start_date, c.country_id AS comp_country_id
       FROM wca_championship_podiums p
       LEFT JOIN wca_competitions c ON c.id = p.comp_id
      WHERE p.wca_id = ?`,
    [wcaId],
  );

  c.header('Cache-Control', CACHE_HEADER);
  return c.json({
    wcaId,
    rows: rows.map(r => ({
      compId: r.comp_id,
      compName: r.comp_name,
      compDate: r.start_date,
      compCountryId: r.comp_country_id,
      eventId: r.event_id,
      level: r.level,
      place: r.place,
      best: r.best,
      average: r.average ?? 0,
      attempts: r.attempts ?? [],
      singleRecord: r.single_record || null,
      averageRecord: r.average_record || null,
    })),
  });
});

// ── 2b. /v1/wca/rank-for ──
// "我这个成绩放进 WCA 历史能排第几" —— 给 /timer 速拧计时器的世界排名徽章用.
//   GET /v1/wca/rank-for?event=333&type=single&centis=984
//
// 语义(重要):wca_results_flat 是「一行一条成绩」(每人每场每轮都有行,同一人重复多次,见
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
// 索引:GROUP BY wca_id 的 MIN(value) 走 wrf_main(event_id,is_avg,value,wca_id) Index Only Scan.
// Cache-Control 同其它端点 1 天(每周才变).
interface RankIndex {
  /** 该 (event,type) 每位上榜选手的个人最佳(centiseconds),升序 */
  values: Int32Array;
  builtAt: number;
}
const RANK_TTL_MS = 24 * 60 * 60_000;
const rankCache = new Map<string, RankIndex>();
const rankInflight = new Map<string, Promise<RankIndex | null>>();

// scope: 'W' 世界 | `N:<countryId>` 国家 | `K:<continentId>` 大洲.
// 国家/大洲 scope 懒构建,只缓存被请求过的(用户多半只查自己一个国家 + 一个大洲).
async function buildRankIndex(event: string, isAvg: boolean, scope: string): Promise<RankIndex | null> {
  const t0 = Date.now();
  try {
    // 每位上榜选手在该 (event,type[,地域]) 的个人最佳.value>0 排除 DNF(-1)/DNS(-2)/0.
    let sql: string;
    const params: unknown[] = [event, isAvg];
    if (scope === 'W') {
      sql = `SELECT MIN(value)::int AS m FROM wca_results_flat
             WHERE event_id = ? AND is_avg = ? AND value > 0
             GROUP BY wca_id`;
    } else if (scope.startsWith('N:')) {
      sql = `SELECT MIN(value)::int AS m FROM wca_results_flat
             WHERE event_id = ? AND is_avg = ? AND value > 0 AND person_country_id = ?
             GROUP BY wca_id`;
      params.push(scope.slice(2));
    } else {
      // 'K:<continentId>' —— join wca_countries 取该大洲全部国家
      sql = `SELECT MIN(t.value)::int AS m FROM wca_results_flat t
             JOIN wca_countries co ON co.id = t.person_country_id
             WHERE t.event_id = ? AND t.is_avg = ? AND t.value > 0 AND co.continent_id = ?
             GROUP BY t.wca_id`;
      params.push(scope.slice(2));
    }
    const rows = await query<{ m: number }>(sql, params);
    const values = new Int32Array(rows.length);
    for (let i = 0; i < rows.length; i++) values[i] = Number(rows[i]!.m);
    values.sort(); // Int32Array.sort 默认数值升序
    console.log(`[rank-for] built ${event}|${isAvg ? 'avg' : 'single'}|${scope} n=${values.length} in ${Date.now() - t0}ms`);
    return { values, builtAt: Date.now() };
  } catch (e) {
    console.warn(`[rank-for] build failed ${event}|${isAvg ? 'avg' : 'single'}|${scope}:`, (e as Error).message);
    return null;
  }
}

async function getRankIndex(event: string, isAvg: boolean, scope: string): Promise<RankIndex | null> {
  const key = `${event}|${isAvg ? '1' : '0'}|${scope}`;
  const cur = rankCache.get(key);
  if (cur && Date.now() - cur.builtAt < RANK_TTL_MS) return cur;
  const pending = rankInflight.get(key);
  if (pending) return pending;
  const p = (async () => {
    const fresh = await buildRankIndex(event, isAvg, scope);
    if (fresh) rankCache.set(key, fresh);
    rankInflight.delete(key);
    return fresh;
  })();
  rankInflight.set(key, p);
  return p;
}

// 解析国家入参(iso2 或 WCA country id)-> {id, continentId, iso2}.查不到返回 null.
export async function resolveCountryFull(
  input: string,
): Promise<{ id: string; continentId: string; iso2: string } | null> {
  if (!input) return null;
  const col = input.length === 2 ? 'iso2' : 'id';
  const val = input.length === 2 ? input.toUpperCase() : input;
  const rows = await query<{ id: string; continent_id: string; iso2: string | null }>(
    `SELECT id, continent_id, iso2 FROM wca_countries WHERE ${col} = ? LIMIT 1`,
    [val],
  );
  if (rows.length === 0) return null;
  return { id: rows[0]!.id, continentId: rows[0]!.continent_id, iso2: rows[0]!.iso2 ?? '' };
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

// 世界排名(Top 100 门控)—— 给 utils/record_format 的纪录文案 /WRn 后缀用.
// 复刻退役 Python wca_rankings.get_world_rank:成绩进世界前 100 返名次,否则 null.
// rank = (个人最佳严格小于 value 的选手数) + 1 = WCA 官方按选手 PB 去重的名次,
// 与 /wca/rank-for 共用 getRankIndex 缓存(同一份 Int32Array,内存零额外).
// ⚠️ 行为变更:数据源从「WCA 官网实时 Top100」变成本地 wca_results_flat(stats-build 周更).
//   两次周更间的新破纪录,/WRn 分母缺最近一周 → 名次可能系统性偏小几名(WR/Top10 无感,
//   NR/CR 的 /WRnn 偶尔偏小且无人察觉).可接受 —— 换来彻底脱离 spawn/联网/超时/熔断脆链.
//   333fm average 这里走得通(getRankIndex 不像 /wca/rank-for 端点那样拒它).
export async function worldRankTop100(
  eventId: string,
  recType: string,
  value: number,
): Promise<number | null> {
  if (!value || value <= 0) return null;
  const idx = await getRankIndex(eventId.toLowerCase(), recType === 'average', 'W');
  if (!idx) return null;
  const rank = lowerBound(idx.values, value) + 1;
  return rank <= 100 ? rank : null;
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
  const worldIdx = await getRankIndex(event, isAvg, 'W');
  if (!worldIdx) return c.json({ error: 'Rank index unavailable' }, 503);

  // rank = (PR 严格小于 value 的人数) + 1;total = 上榜选手数.精确,无饱和.
  const rank = lowerBound(worldIdx.values, centis) + 1;
  const total = worldIdx.values.length;

  const resp: Record<string, unknown> = { event, type, value: centis, rank, total };

  // 可选 country -> 额外给 NR(国家)/ CR(大洲)排名.查不到国家就只返世界排名.
  const countryInput = (c.req.query('country') ?? '').trim();
  if (countryInput) {
    const cn = await resolveCountryFull(countryInput);
    if (cn) {
      const [natIdx, contIdx] = await Promise.all([
        getRankIndex(event, isAvg, `N:${cn.id}`),
        getRankIndex(event, isAvg, `K:${cn.continentId}`),
      ]);
      resp.country = cn.iso2 || cn.id;
      resp.continent = cn.continentId;
      if (natIdx) {
        resp.national = { rank: lowerBound(natIdx.values, centis) + 1, total: natIdx.values.length };
      }
      if (contIdx) {
        resp.continental = { rank: lowerBound(contIdx.values, centis) + 1, total: contIdx.values.length };
      }
    }
  }

  c.header('Cache-Control', CACHE_HEADER);
  return c.json(resp);
});

// ── 2c. /v1/wca/rank-for-batch ──
// 一次问多条成绩的名次(给 /wca/comp 成绩页预热,让弹窗 NR/WR「秒出」)。
// 复用 getRankIndex(24h 缓存 + 懒构建)+ lowerBound:每条只是几次二分,代价可忽略;
// 真正成本是首访 (event,type[,国家]) 时建一次索引,之后全 batch 共享同一份 Int32Array。
// 单条形态与 GET /wca/rank-for 一致({rank,total,national}),返回顺序对齐入参;无效条目返 null。
wcaStatsExtraRoutes.post('/wca/rank-for-batch', async (c) => {
  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json({ error: 'invalid json' }, 400); }
  const items = (body as { items?: unknown })?.items;
  if (!Array.isArray(items)) return c.json({ error: 'items array required' }, 400);
  if (items.length > 400) return c.json({ error: 'too many items (max 400)' }, 400);

  // 同一批里相同国家只解析一次(resolveCountryFull 不带缓存)。
  const countryMemo = new Map<string, Awaited<ReturnType<typeof resolveCountryFull>>>();
  const resolveCountry = async (input: string) => {
    const hit = countryMemo.get(input);
    if (hit !== undefined) return hit;
    const r = await resolveCountryFull(input);
    countryMemo.set(input, r);
    return r;
  };

  const results = await Promise.all((items as unknown[]).map(async (raw) => {
    const it = raw as { event?: unknown; type?: unknown; value?: unknown; country?: unknown };
    const event = String(it?.event ?? '').toLowerCase();
    const type = String(it?.type ?? 'single').toLowerCase();
    const value = Number(it?.value);
    const countryInput = (it?.country ? String(it.country) : '').trim();
    if (!(ACTIVE_EVENTS as readonly string[]).includes(event)) return null;
    if (type !== 'single' && type !== 'average') return null;
    if (type === 'average' && (event === '333mbf' || event === '333fm')) return null;
    if (!Number.isInteger(value) || value <= 0) return null;

    const isAvg = type === 'average';
    const worldIdx = await getRankIndex(event, isAvg, 'W');
    if (!worldIdx) return null;
    const out: Record<string, unknown> = { rank: lowerBound(worldIdx.values, value) + 1, total: worldIdx.values.length };
    if (countryInput) {
      const cn = await resolveCountry(countryInput);
      if (cn) {
        out.country = cn.iso2 || cn.id;
        const natIdx = await getRankIndex(event, isAvg, `N:${cn.id}`);
        if (natIdx) out.national = { rank: lowerBound(natIdx.values, value) + 1, total: natIdx.values.length };
      }
    }
    return out;
  }));

  c.header('Cache-Control', CACHE_HEADER);
  return c.json({ results });
});

// ── 3. /v1/wca/cohort-ranks ──
wcaStatsExtraRoutes.get('/wca/cohort-ranks', async (c) => {
  const cohort = parseInt(c.req.query('cohort') ?? '0', 10);
  const event = (c.req.query('event') ?? '333').toLowerCase();
  const type = (c.req.query('type') ?? 'single').toLowerCase();
  const country = c.req.query('country') ?? '';
  const page = Math.max(1, intParam(c.req.query('page'), 1));
  const size = Math.min(MAX_SIZE, Math.max(1, intParam(c.req.query('size'), DEFAULT_SIZE)));

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
  const minAttempted = Math.max(3, intParam(c.req.query('minAttempted'), 3));
  const page = Math.max(1, intParam(c.req.query('page'), 1));
  const size = Math.min(MAX_SIZE, Math.max(1, intParam(c.req.query('size'), DEFAULT_SIZE)));

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
  const page = Math.max(1, intParam(c.req.query('page'), 1));
  const size = Math.min(MAX_SIZE, Math.max(1, intParam(c.req.query('size'), DEFAULT_SIZE)));

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
  const page = Math.max(1, intParam(c.req.query('page'), 1));
  const size = Math.min(MAX_SIZE, Math.max(1, intParam(c.req.query('size'), DEFAULT_SIZE)));

  if (type !== 'single' && type !== 'average') return c.json({ error: 'Invalid type' }, 400);
  const cn = await resolveCountry(country);
  if (!cn.ok) return c.json({ error: cn.err }, 400);

  // 解析事件列表 → 索引集合(对齐 RANK_EVENTS 顺序;0-16=活跃项,17-20=废止项)
  // eventIdxs=null 仅当选中"恰好活跃 17 项"(默认口径) → 走 total_* 索引快路径.
  // 任何废止项 / 活跃项子集 → eventIdxs 非空,走子集求和路径.
  let eventIdxs: number[] | null = null;
  if (eventsParam) {
    const arr = eventsParam.split(',').map(s => s.trim()).filter(Boolean);
    const idxSet = new Set<number>();
    for (const e of arr) {
      const i = RANK_EVENTS.indexOf(e as typeof RANK_EVENTS[number]);
      if (i >= 0) idxSet.add(i);
    }
    if (idxSet.size === 0) return c.json({ error: 'Invalid events list' }, 400);
    const idxs = [...idxSet].sort((a, b) => a - b);
    // 恰好 = 活跃 17 项(sorted distinct,长度 17 且最大 index 16 ⟺ {0..16})
    const isDefaultAll = idxs.length === ACTIVE_EVENTS.length && idxs[idxs.length - 1] === ACTIVE_EVENTS.length - 1;
    if (!isDefaultAll) eventIdxs = idxs;
  }

  const isCountryMode = !!cn.id;
  const orderCol = eventIdxs ? null : (isCountryMode ? 'pr.total_country_rank' : 'pr.total_world_rank');
  const ranksCol = isCountryMode ? 'ranks_country' : 'ranks_world';
  const isAvg = type === 'average';

  // 构造 WHERE(主查询)
  const where: string[] = [`pr.is_avg = ?`];
  const params: unknown[] = [isAvg];
  if (isCountryMode) { where.push(`pr.country_id = ?`); params.push(cn.id); }
  if (hidePodium) {
    where.push(`(pr.best_final_pos = 0 OR pr.best_final_pos > 3)`);
  }

  // 如果是默认全 17 项 — 走索引,直接 ORDER BY 聚合好的 total
  if (orderCol) {
    const offset = (page - 1) * size;
    const totalParams = [...params];
    // 历史最高 SOR 名次徽标:LEFT JOIN sor_historical_best(同 scope 同 is_avg).
    // JOIN 在 WHERE 之前 → 其 ? 占位排在 where 参数前.表未灌数据时返回 NULL,不报错.
    const bestScope = isCountryMode ? 'country' : 'world';
    const dataParams = [isAvg, bestScope, ...params, size, offset];

    const rows = await query<{
      wca_id: string; country_id: string;
      iso2: string | null;
      events_done: number; total_world_rank: number; total_country_rank: number;
      ranks_world: number[]; ranks_country: number[];
      person_name: string;
      best_rank: number | null; best_year: number | null; best_total: number | null;
    }>(
      `
      SELECT pr.wca_id, pr.country_id,
             co.iso2 AS iso2,
             pr.events_done, pr.total_world_rank, pr.total_country_rank,
             pr.ranks_world, pr.ranks_country,
             p.name AS person_name,
             shb.best_rank AS best_rank, shb.best_year AS best_year, shb.best_total AS best_total
      FROM wca_person_ranks pr
      JOIN wca_persons p ON p.wca_id = pr.wca_id
      LEFT JOIN wca_countries co ON co.id = pr.country_id
      LEFT JOIN sor_historical_best shb
        ON shb.wca_id = pr.wca_id AND shb.is_avg = ? AND shb.scope = ?
      WHERE ${where.join(' AND ')}
      ORDER BY ${orderCol} ASC, pr.wca_id ASC
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
      type, country: cn.id, hidePodium, page, size, total,
      events: RANK_EVENTS,
      rows: rows.map(r => ({
        wcaId: r.wca_id, name: r.person_name,
        countryId: r.country_id, iso2: r.iso2,
        eventsDone: r.events_done,
        totalWorldRank: r.total_world_rank,
        totalCountryRank: r.total_country_rank,
        ranks: isCountryMode ? r.ranks_country : r.ranks_world,
        bestRank: r.best_rank ?? null,
        bestYear: r.best_year ?? null,
        bestTotal: r.best_total ?? null,
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
    type, country: cn.id, hidePodium, page, size, total,
    events: RANK_EVENTS,
    selectedEvents: eventIdxs!.map(i => RANK_EVENTS[i]),
    rows: rows.map(r => ({
      wcaId: r.wca_id, name: r.person_name,
      countryId: r.country_id, iso2: r.iso2,
      eventsDone: r.events_done,
      subsetTotal: r.subset_total,
      ranks: isCountryMode ? r.ranks_country : r.ranks_world,
    })),
  });
});

// ── 7b. /v1/wca/sum-of-ranks/census ──
// 历史名人堂:截至某年末, 全 2^17-1(仅活跃) / 2^21-1(含废止) 个项目组合普查谁当过"名次和第一".
// 预计算专表 sor_census_yearly(数据源 historical_ranks_snapshot 年末快照 → Rust `sorcalc history`).
//   ?type=single|average  ?cancelled=0|1(默认0=不含废止)  ?year=YYYY(默认最新年)
//   ?no_podium=0|1(默认0;1=仅未登领奖台选手 best_final_pos∈{0,>3}, 跟随主榜单开关; v1 仅最新年)
//   ?timeline=1(返回历年 distinct 人数, 画时间线用)  ?limit=
wcaStatsExtraRoutes.get('/wca/sum-of-ranks/census', async (c) => {
  const type = (c.req.query('type') ?? 'single').toLowerCase();
  if (type !== 'single' && type !== 'average') return c.json({ error: 'Invalid type' }, 400);
  const isAvg = type === 'average';
  const inclCancelled = c.req.query('cancelled') === '1' || c.req.query('cancelled') === 'true';
  // no_podium: 跟随主榜单"未登领奖台"开关 — 仅在从未登上比赛决赛前三的选手里重排"名次和第一".
  // v1 只有最新年快照, 历史时间线退化为单点(前端在此态下不画时间线).
  const noPodium = c.req.query('no_podium') === '1' || c.req.query('no_podium') === 'true';
  const totalSubsets = inclCancelled ? (2 ** 21 - 1) : (2 ** 17 - 1);

  // 可选年份列表(供前端选择器)
  const yearRows = await query<{ year: number }>(
    `SELECT DISTINCT year FROM sor_census_yearly WHERE is_avg = ? AND incl_cancelled = ? AND no_podium = ? ORDER BY year`,
    [isAvg, inclCancelled, noPodium],
  );
  const years = yearRows.map(r => r.year);
  const maxYear = years.length ? years[years.length - 1]! : null;

  // timeline 模式:历年 distinct 人数(GROUP BY year)
  if (c.req.query('timeline') === '1') {
    const pts = await query<{ year: number; cnt: string }>(
      `SELECT year, COUNT(*) AS cnt FROM sor_census_yearly
       WHERE is_avg = ? AND incl_cancelled = ? AND no_podium = ? GROUP BY year ORDER BY year`,
      [isAvg, inclCancelled, noPodium],
    );
    c.header('Cache-Control', CACHE_HEADER);
    return c.json({
      type, inclCancelled, noPodium, totalSubsets,
      points: pts.map(p => ({ year: p.year, distinct: parseInt(p.cnt, 10) })),
    });
  }

  const limit = Math.min(MAX_SIZE, Math.max(1, intParam(c.req.query('limit'), 200)));
  const yearParam = parseInt(c.req.query('year') ?? '', 10);
  const year = Number.isFinite(yearParam) && years.includes(yearParam) ? yearParam : maxYear;
  if (year == null) {
    c.header('Cache-Control', CACHE_HEADER);
    return c.json({ type, inclCancelled, noPodium, year: null, years, distinct: 0, totalSubsets, rows: [] });
  }

  const rows = await query<{
    rank: number; wca_id: string; subsets_won: string;
    name: string; country_id: string; iso2: string | null;
  }>(
    `SELECT sc.rank, sc.wca_id, sc.subsets_won, p.name, p.country_id, co.iso2
     FROM sor_census_yearly sc
     JOIN wca_persons p ON p.wca_id = sc.wca_id
     LEFT JOIN wca_countries co ON co.id = p.country_id
     WHERE sc.is_avg = ? AND sc.incl_cancelled = ? AND sc.no_podium = ? AND sc.year = ?
     ORDER BY sc.rank ASC
     LIMIT ?`,
    [isAvg, inclCancelled, noPodium, year, limit],
  );
  const totalRow = await query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM sor_census_yearly WHERE is_avg = ? AND incl_cancelled = ? AND no_podium = ? AND year = ?`,
    [isAvg, inclCancelled, noPodium, year],
  );
  const distinct = totalRow[0] ? parseInt(totalRow[0].n, 10) : 0;

  c.header('Cache-Control', CACHE_HEADER);
  return c.json({
    type, inclCancelled, noPodium, year, years, distinct, totalSubsets,
    rows: rows.map(r => ({
      rank: r.rank, wcaId: r.wca_id, name: r.name,
      countryId: r.country_id, iso2: r.iso2,
      subsetsWon: parseInt(r.subsets_won, 10),
    })),
  });
});

// ── 7c. /v1/wca/sum-of-ranks/player-best?wcaId= ──
// 指定选手的"最优项目组合":选哪些项目时名次和排名最靠前 + 能到第几(单次 & 平均都返回).
// 预计算专表 sor_player_best.最优组合只取项目数最少的那个解.世界口径.
wcaStatsExtraRoutes.get('/wca/sum-of-ranks/player-best', async (c) => {
  const wcaId = (c.req.query('wcaId') ?? '').trim().toUpperCase();
  if (!/^[0-9]{4}[A-Z]{4}[0-9]{2}$/.test(wcaId)) return c.json({ error: 'Invalid wcaId' }, 400);
  // 跟随页面"废止项"开关: 默认 false=仅 17 活跃项; cancelled=1 → 含 4 废止项 (与名人堂/主榜单同口径).
  const inclCancelled = c.req.query('cancelled') === '1' || c.req.query('cancelled') === 'true';

  const pers = await query<{ name: string; country_id: string; iso2: string | null }>(
    `SELECT p.name, p.country_id, co.iso2
     FROM wca_persons p LEFT JOIN wca_countries co ON co.id = p.country_id
     WHERE p.wca_id = ? LIMIT 1`,
    [wcaId],
  );
  if (pers.length === 0) return c.json({ error: 'Person not found' }, 404);

  // best_events 现存「全部」并列组合(sorcalc 去掉了 KEEP 封顶),这里只切前 16 个(项目数最少优先)
  // 给内联头部用 —— 避免每次选手选择都把极端全能者(如 Luke ~8 万组合, 数 MB)整坨拉过来.
  // 完整列表走分页端点 /sum-of-ranks/player-combos(懒加载).combo_count = 完整并列总数.
  // eventCounts = 每个项目出现在多少个并列组合里(支柱/毒药/自由项剖析用):PG 内 unnest 聚合,
  // 只回 ≤21 行,不把全文本拉过来.最坏(8.3 万组合,3.8MB)实测 ~0.9s,nginx 24h 缓存兜底;常人微秒级.
  const [rows, countRows] = await Promise.all([
    query<{ is_avg: boolean; best_rank: number; combo_count: number; listed_count: number; best_events: string }>(
      `SELECT is_avg, best_rank, combo_count,
              cardinality(string_to_array(best_events, ';'))::int AS listed_count,
              array_to_string((string_to_array(best_events, ';'))[1:16], ';') AS best_events
       FROM sor_player_best WHERE wca_id = ? AND scope = 'world' AND incl_cancelled = ?`,
      [wcaId, inclCancelled],
    ),
    query<{ is_avg: boolean; ev: string; n: number }>(
      `SELECT s.is_avg, ev.ev, COUNT(*)::int AS n
       FROM sor_player_best s,
            LATERAL unnest(string_to_array(s.best_events, ';')) AS combo(combo),
            LATERAL unnest(string_to_array(combo.combo, ',')) AS ev(ev)
       WHERE s.wca_id = ? AND s.scope = 'world' AND s.incl_cancelled = ?
       GROUP BY s.is_avg, ev.ev`,
      [wcaId, inclCancelled],
    ),
  ]);
  const countsBy: Record<string, Record<string, number>> = { single: {}, average: {} };
  for (const r of countRows) countsBy[r.is_avg ? 'average' : 'single']![r.ev] = r.n;
  // best_events(切片后)= ';' 分隔的前 16 个最优组合, 每组合内部 ',' 分隔 event id (项目数最少优先).
  // combo_count = 并列该名次的全部子集数(可能 > 这里列出的 16 个).
  const best: Record<string, { rank: number; combos: string[][]; comboCount: number; listedCount: number; eventCounts: Record<string, number> }> = {};
  for (const r of rows) {
    const combos = r.best_events ? r.best_events.split(';').map(c => c.split(',')) : [];
    const type = r.is_avg ? 'average' : 'single';
    best[type] = {
      rank: r.best_rank,
      combos,
      comboCount: r.combo_count ?? combos.length,
      listedCount: r.listed_count ?? combos.length,
      eventCounts: countsBy[type]!,
    };
  }

  // 无任何组合(新选手尚未进 sor_player_best)是暂态,禁 24h 缓存;周更灌上后立即可见
  c.header('Cache-Control', rows.length > 0 ? CACHE_HEADER : 'no-store');
  return c.json({
    wcaId, name: pers[0]!.name, countryId: pers[0]!.country_id, iso2: pers[0]!.iso2,
    scope: 'world', inclCancelled, best,
  });
});

// ── 7c-bis. /v1/wca/sum-of-ranks/player-combos?wcaId=&isAvg=&cancelled=&offset=&limit= ──
// 某选手某口径下「达到最优名次的全部并列组合」分页(前端「展开全部」懒加载用).
// best_events 已存全量(sorcalc 去 KEEP 封顶),按 ';' 切片取 [offset, offset+limit) 这一页.
// 组合按「项目数最少优先」排好序(sorcalc 末尾 sort),故前面是最精简的组合.
wcaStatsExtraRoutes.get('/wca/sum-of-ranks/player-combos', async (c) => {
  const wcaId = (c.req.query('wcaId') ?? '').trim().toUpperCase();
  if (!/^[0-9]{4}[A-Z]{4}[0-9]{2}$/.test(wcaId)) return c.json({ error: 'Invalid wcaId' }, 400);
  const isAvg = c.req.query('isAvg') === '1' || c.req.query('isAvg') === 'true';
  const inclCancelled = c.req.query('cancelled') === '1' || c.req.query('cancelled') === 'true';
  const offset = Math.max(0, intParam(c.req.query('offset'), 0));
  const limit = Math.min(500, Math.max(1, intParam(c.req.query('limit'), 100)));

  // PG 一维数组切片 arr[lo:hi] 含两端(1-based);取 [offset, offset+limit) → [offset+1 : offset+limit].
  const rows = await query<{ page: string[] | null; combo_count: number }>(
    `SELECT (string_to_array(best_events, ';'))[?:?] AS page, combo_count
     FROM sor_player_best
     WHERE wca_id = ? AND is_avg = ? AND scope = 'world' AND incl_cancelled = ?`,
    [offset + 1, offset + limit, wcaId, isAvg, inclCancelled],
  );
  if (rows.length === 0) {
    return c.json({ wcaId, isAvg, inclCancelled, total: 0, offset, limit, combos: [] });
  }
  const r = rows[0]!;
  const combos = (r.page ?? []).map(s => s.split(','));
  c.header('Cache-Control', CACHE_HEADER);
  return c.json({ wcaId, isAvg, inclCancelled, total: r.combo_count ?? 0, offset, limit, combos });
});

// ── 7c-ter. /v1/wca/sum-of-ranks/person-subset?wcaId=&isAvg=&events= ──
// 自选组合计算器:给定项目子集,现算该选手的三个指标(与 Σ 块 SoWR/SoCR/SoNR 行同口径):
//   sowr = Σ世界名次(世界名次 + 本洲/本国子排名) / socr = Σ洲际名次(本洲名次 + 本国子排名) / sonr = Σ国家名次(本国名次)
// 口径与 builder 总和列逐字节一致:缺项 = 该 scope 该项「参赛人数+1」(world 全球计数,country/continent 该国/该洲计数);
// 名次 = 同 scope 池子里 COUNT 严格更小 + 1(并列共享).socr 依赖 ranks_continent 数组(migration 0040),
// 未灌数据(空数组)时 socr 返 null 且整响应 no-store(暂态,防钉缓存;灌上后自动恢复长缓存).
// 量级:1 遍全表 COUNT + 洲/国小池子若干遍(每项参赛人数向量走进程内缓存,不再每请求聚合扫),
// ~1.5-2s 冷,nginx 24h 按 URL 缓存;客户端按 RANK_EVENTS 顺序发 events 串保 URL 唯一 → 缓存命中.

// 「每项参赛人数」向量缓存(21 元素/桶,15min TTL):跟选手与所选组合都无关,只随每日灌库微动;
// 原版每请求用 3 个聚合 CTE 现算(占 ~40% 行扫),摘出来后 COUNT 变纯扫描.
const epVecCache = new Map<string, { t: number; p: number[] }>();
const EP_VEC_TTL = 15 * 60 * 1000;
async function participantVec(isAvg: boolean, col: 'ranks_world' | 'ranks_country' | 'ranks_continent', scopeCol?: 'country_id' | 'continent_id', scopeId?: string): Promise<number[]> {
  const key = `${isAvg}|${col}|${scopeId ?? ''}`;
  const hit = epVecCache.get(key);
  if (hit && Date.now() - hit.t < EP_VEC_TTL) return hit.p;
  const sel = RANK_EVENTS.map((_, i) => `SUM(CASE WHEN ${col}[${i + 1}] > 0 THEN 1 ELSE 0 END)::INTEGER AS p${i}`).join(', ');
  const rows = await query<Record<string, number>>(
    `SELECT ${sel} FROM wca_person_ranks WHERE is_avg = ?${scopeCol ? ` AND ${scopeCol} = ?` : ''}`,
    scopeCol ? [isAvg, scopeId] : [isAvg],
  );
  const p = RANK_EVENTS.map((_, i) => rows[0]?.[`p${i}`] ?? 0);
  epVecCache.set(key, { t: Date.now(), p });
  return p;
}

wcaStatsExtraRoutes.get('/wca/sum-of-ranks/person-subset', async (c) => {
  const wcaId = (c.req.query('wcaId') ?? '').trim().toUpperCase();
  if (!/^[0-9]{4}[A-Z]{4}[0-9]{2}$/.test(wcaId)) return c.json({ error: 'Invalid wcaId' }, 400);
  const isAvg = c.req.query('isAvg') === '1' || c.req.query('isAvg') === 'true';
  const idxSet = new Set<number>();
  for (const e of (c.req.query('events') ?? '').split(',').map(s => s.trim()).filter(Boolean)) {
    const i = RANK_EVENTS.indexOf(e as typeof RANK_EVENTS[number]);
    if (i >= 0) idxSet.add(i);
  }
  if (idxSet.size === 0) return c.json({ error: 'Invalid events list' }, 400);
  const idxs = [...idxSet].sort((a, b) => a - b);
  const events = idxs.map(i => RANK_EVENTS[i]);

  // 取该选手的三个名次数组 + scope 桶(轻查,顺带确认选手存在)
  const meRows = await query<{ country_id: string; continent_id: string; ranks_world: number[]; ranks_country: number[]; ranks_continent: number[] }>(
    `SELECT country_id, continent_id, ranks_world, ranks_country, ranks_continent
     FROM wca_person_ranks WHERE wca_id = ? AND is_avg = ?`,
    [wcaId, isAvg],
  );
  if (meRows.length === 0) {
    // 该选手该 type 无任何排名(如从无平均成绩)→ 名次无意义,返 null(不缓存)
    return c.json({ wcaId, isAvg, events, eventsDone: 0, sowr: null, socr: null, sonr: null, total: null, rank: null });
  }
  const m0 = meRows[0]!;
  const hasCtry = m0.country_id !== '';
  const hasContId = m0.continent_id !== '';                  // 洲桶存在 → SoWR 的本洲子排名可算(只要 continent_id + 世界和)
  const hasCont = hasContId && m0.ranks_continent.length > 0; // ranks_continent 已灌 → SoCR(洲际名次和)本身才可算

  // 参赛人数向量(进程内缓存)→ 我的三个和 + done 在 TS 里算,SQL 只剩 COUNT
  const [pw, pn, pk] = await Promise.all([
    participantVec(isAvg, 'ranks_world'),
    hasCtry ? participantVec(isAvg, 'ranks_country', 'country_id', m0.country_id) : null,
    hasCont ? participantVec(isAvg, 'ranks_continent', 'continent_id', m0.continent_id) : null,
  ]);
  const sumMe = (arr: number[], pvec: number[]) => idxs.reduce((s, i) => s + ((arr[i] ?? 0) > 0 ? arr[i]! : pvec[i]! + 1), 0);
  const tw = sumMe(m0.ranks_world, pw);
  const tn = pn ? sumMe(m0.ranks_country, pn) : null;
  const tk = pk ? sumMe(m0.ranks_continent, pk) : null;
  const done = idxs.reduce((s, i) => s + ((m0.ranks_world[i] ?? 0) > 0 ? 1 : 0), 0);

  // 求和表达式:罚分以字面量内联(server 算出的 int,无注入面);无 CTE join → 纯扫描
  const sumOf = (col: string, pvec: number[]) => idxs.map(i =>
    `(CASE WHEN ${col}[${i + 1}] > 0 THEN ${col}[${i + 1}] ELSE ${pvec[i]! + 1} END)`
  ).join(' + ');
  const sumW = sumOf('ranks_world', pw);

  const counts: string[] = [
    `(SELECT COUNT(*) FROM wca_person_ranks WHERE is_avg = ? AND (${sumW}) < ${tw}) AS w_world`,
  ];
  const params: unknown[] = [isAvg];
  if (hasContId) { counts.push(`(SELECT COUNT(*) FROM wca_person_ranks WHERE is_avg = ? AND continent_id = ? AND (${sumW}) < ${tw}) AS w_cont`); params.push(isAvg, m0.continent_id); }
  if (hasCtry) { counts.push(`(SELECT COUNT(*) FROM wca_person_ranks WHERE is_avg = ? AND country_id = ? AND (${sumW}) < ${tw}) AS w_ctry`); params.push(isAvg, m0.country_id); }
  if (hasCont && pk) {
    const sumK = sumOf('ranks_continent', pk);
    counts.push(`(SELECT COUNT(*) FROM wca_person_ranks WHERE is_avg = ? AND continent_id = ? AND (${sumK}) < ${tk}) AS k_cont`); params.push(isAvg, m0.continent_id);
    if (hasCtry) { counts.push(`(SELECT COUNT(*) FROM wca_person_ranks WHERE is_avg = ? AND country_id = ? AND (${sumK}) < ${tk}) AS k_ctry`); params.push(isAvg, m0.country_id); }
  }
  if (hasCtry && pn) {
    const sumN = sumOf('ranks_country', pn);
    counts.push(`(SELECT COUNT(*) FROM wca_person_ranks WHERE is_avg = ? AND country_id = ? AND (${sumN}) < ${tn}) AS n_ctry`); params.push(isAvg, m0.country_id);
  }

  const rows = await query<{
    w_world: string; w_cont?: string; w_ctry?: string; k_cont?: string; k_ctry?: string; n_ctry?: string;
  }>(
    `SELECT ${counts.join(',\n ')}`,
    params,
  );
  const r = rows[0]!;
  const rk = (s: string | undefined) => (s != null ? parseInt(s, 10) + 1 : undefined);

  const sowr = {
    total: tw, rank: rk(r.w_world)!,
    ...(r.w_cont != null ? { continentRank: rk(r.w_cont) } : {}),
    ...(r.w_ctry != null ? { countryRank: rk(r.w_ctry) } : {}),
  };
  const socr = hasCont && tk != null
    ? { total: tk, rank: rk(r.k_cont)!, ...(r.k_ctry != null ? { countryRank: rk(r.k_ctry) } : {}) }
    : null;
  const sonr = hasCtry && tn != null ? { total: tn, rank: rk(r.n_ctry)! } : null;

  // ranks_continent 未灌(socr 缺位)是暂态 → no-store,数据灌上后自动恢复长缓存(不钉空响应)
  c.header('Cache-Control', hasCont ? CACHE_HEADER : 'no-store');
  return c.json({
    wcaId, isAvg, events, eventsDone: done,
    sowr, socr, sonr,
    total: sowr.total, rank: sowr.rank, // legacy v1 字段(浏览器里旧 JS 过渡期用,客户端收敛后可删)
  });
});

// ── 7d. /v1/wca/sum-of-ranks/person?wcaId= ──
// 单个选手的「全项目排名(SOR)」摘要,给 /wca/persons/:id 页用.
//   ?cancelled=1 → 21 项口径(含 4 废止,读 total_*_rank_21 列;未填充时返 null);默认 17 现役项.
//   当前: total_*_rank(= 名次总和) + 各 scope SOR 名次(COUNT total<我 +1);单次 / 平均各一.
//   历史最佳: sor_historical_best 仅 17 口径 → cancelled=1 时 bestSingle/bestAverage 返 null.
// 选手无 SOR 数据(从未有成绩 / 只打废止项)时对应字段返 null,不报错.
wcaStatsExtraRoutes.get('/wca/sum-of-ranks/person', async (c) => {
  const wcaId = (c.req.query('wcaId') ?? '').trim().toUpperCase();
  if (!/^[0-9]{4}[A-Z]{4}[0-9]{2}$/.test(wcaId)) return c.json({ error: 'Invalid wcaId' }, 400);
  const inclCancelled = c.req.query('cancelled') === '1' || c.req.query('cancelled') === 'true';
  // 口径列(固定字符串,非用户输入):17 → total_*_rank;21 → total_*_rank_21(migration 0039,日更 builder 填充)
  const wCol = inclCancelled ? 'total_world_rank_21' : 'total_world_rank';
  const kCol = inclCancelled ? 'total_continent_rank_21' : 'total_continent_rank';
  const cCol = inclCancelled ? 'total_country_rank_21' : 'total_country_rank';

  const [prRowsRaw, bestRows] = await Promise.all([
    query<{
      is_avg: boolean; events_done: number;
      total_world_rank: number; total_continent_rank: number; total_country_rank: number;
      continent_id: string; country_id: string;
    }>(
      `SELECT is_avg, events_done, ${wCol} AS total_world_rank, ${kCol} AS total_continent_rank, ${cCol} AS total_country_rank, continent_id, country_id
       FROM wca_person_ranks WHERE wca_id = ?`,
      [wcaId],
    ),
    query<{ is_avg: boolean; scope: string; best_rank: number; best_year: number; best_total: number | null }>(
      `SELECT is_avg, scope, best_rank, best_year, best_total FROM sor_historical_best WHERE wca_id = ?`,
      [wcaId],
    ),
  ]);
  // 21 口径列未填充(builder 还没跑)时 total=0 → 该行按无数据处理,防止 COUNT(0<0) 全员误判
  const prRows = prRowsRaw.filter(pr => pr.total_world_rank > 0);

  // 当前 SOR 名次 = 同 scope 里 total_*_rank 严格更小者数 + 1(并列共享名次).~290k 行 × 6 COUNT,24h 缓存.
  // 对角线 3 个(各指标自身 scope)+ 子排名 3 个(SoWR 在本洲/本国、SoCR 在本国 — 同指标值换更窄池子重排).
  // world_ctry 走 pr_total(is_avg,country_id,total_world_rank)精确命中;world_cont / cont_ctry 走
  // pr_continent_total / pr_country_total 前缀(is_avg,洲/国)圈池子后过滤,池子最大 ~10 万行,可接受.
  const rankRows = await Promise.all(prRows.map(pr =>
    query<{ world: string; world_cont: string; world_ctry: string; continent: string; cont_ctry: string; country: string }>(
      `SELECT
         (SELECT COUNT(*) FROM wca_person_ranks WHERE is_avg = ? AND ${wCol} < ?) AS world,
         (SELECT COUNT(*) FROM wca_person_ranks WHERE is_avg = ? AND continent_id = ? AND ${wCol} < ?) AS world_cont,
         (SELECT COUNT(*) FROM wca_person_ranks WHERE is_avg = ? AND country_id = ? AND ${wCol} < ?) AS world_ctry,
         (SELECT COUNT(*) FROM wca_person_ranks WHERE is_avg = ? AND continent_id = ? AND ${kCol} < ?) AS continent,
         (SELECT COUNT(*) FROM wca_person_ranks WHERE is_avg = ? AND country_id = ? AND ${kCol} < ?) AS cont_ctry,
         (SELECT COUNT(*) FROM wca_person_ranks WHERE is_avg = ? AND country_id = ? AND ${cCol} < ?) AS country`,
      [pr.is_avg, pr.total_world_rank,
       pr.is_avg, pr.continent_id, pr.total_world_rank,
       pr.is_avg, pr.country_id, pr.total_world_rank,
       pr.is_avg, pr.continent_id, pr.total_continent_rank,
       pr.is_avg, pr.country_id, pr.total_continent_rank,
       pr.is_avg, pr.country_id, pr.total_country_rank],
    ),
  ));

  // 三个独立指标(都是 Σ 17 现役项,只是求和的 rank 不同):
  //   SoWR = Σ世界名次(值 total_world_rank,天然按世界排) / SoCR = Σ洲际名次(按本洲排) / SoNR = Σ国家名次(按本国排)
  // 每个指标各带「和值 + 自身 scope 的名次」.SoCR 数据未填充(total=0)时返 null → 前端显示 build 中.
  // 子排名(同指标值在更窄池子重排):SoWR 另带 continentRank/countryRank,SoCR 另带 countryRank.
  type MetricCell = { total: number; rank: number; continentRank?: number; countryRank?: number }; // 当前:和值 + 名次(+子排名)
  type MetricBest = { total: number | null; rank: number; year: number };
  type MetricTriple<T> = { sowr: T | null; socr: T | null; sonr: T | null };
  // 过渡兼容旧客户端(v2 读 .total/.rank.{world,continent,country}/.year);客户端 v3 收敛后可删这两块 legacy 字段.
  type LegacyRank = { world: number; continent: number | null; country: number | null };
  const out: {
    wcaId: string; countryId: string; continentId: string; inclCancelled: boolean;
    single: (MetricTriple<MetricCell> & { eventsDone: number; total: number; rank: LegacyRank }) | null;
    average: (MetricTriple<MetricCell> & { eventsDone: number; total: number; rank: LegacyRank }) | null;
    bestSingle: (MetricTriple<MetricBest> & { total: number | null; rank: LegacyRank; year: number }) | null;
    bestAverage: (MetricTriple<MetricBest> & { total: number | null; rank: LegacyRank; year: number }) | null;
  } = { wcaId, countryId: '', continentId: '', inclCancelled, single: null, average: null, bestSingle: null, bestAverage: null };

  prRows.forEach((pr, i) => {
    out.countryId = pr.country_id; out.continentId = pr.continent_id;
    const row = rankRows[i]?.[0];
    const sowr: MetricCell = {
      total: pr.total_world_rank, rank: (row ? parseInt(row.world, 10) : 0) + 1,
      ...(row && pr.continent_id ? { continentRank: parseInt(row.world_cont, 10) + 1 } : {}),
      ...(row && pr.country_id ? { countryRank: parseInt(row.world_ctry, 10) + 1 } : {}),
    };
    const socr: MetricCell | null = pr.total_continent_rank > 0 && pr.continent_id
      ? {
          total: pr.total_continent_rank, rank: (row ? parseInt(row.continent, 10) : 0) + 1,
          ...(row && pr.country_id ? { countryRank: parseInt(row.cont_ctry, 10) + 1 } : {}),
        } : null;
    const sonr: MetricCell | null = pr.total_country_rank > 0 && pr.country_id
      ? { total: pr.total_country_rank, rank: (row ? parseInt(row.country, 10) : 0) + 1 } : null;
    const cell = {
      sowr, socr, sonr, eventsDone: pr.events_done,
      total: sowr.total, rank: { world: sowr.rank, continent: socr?.rank ?? null, country: sonr?.rank ?? null }, // legacy
    };
    if (pr.is_avg) out.average = cell; else out.single = cell;
  });

  // 历史最佳:sor_historical_best 的 world/continent/country 三 scope 正好就是 SoWR/SoCR/SoNR 各自的历史最佳.
  const bestBy = { single: new Map<string, typeof bestRows[number]>(), average: new Map<string, typeof bestRows[number]>() };
  for (const b of bestRows) (b.is_avg ? bestBy.average : bestBy.single).set(b.scope, b);
  const cellOf = (b?: typeof bestRows[number]): MetricBest | null =>
    b ? { total: b.best_total ?? null, rank: b.best_rank, year: b.best_year } : null;
  const buildBest = (m: Map<string, typeof bestRows[number]>) => {
    if (m.size === 0) return null;
    const w = m.get('world');
    return {
      sowr: cellOf(m.get('world')), socr: cellOf(m.get('continent')), sonr: cellOf(m.get('country')),
      // legacy(过渡兼容旧客户端):
      total: w?.best_total ?? null, year: w?.best_year ?? 0,
      rank: { world: w?.best_rank ?? 0, continent: m.get('continent')?.best_rank ?? null, country: m.get('country')?.best_rank ?? null },
    };
  };
  // sor_historical_best 仅 17 口径,21 口径无历史数据 → cancelled=1 时不误返
  out.bestSingle = inclCancelled ? null : buildBest(bestBy.single);
  out.bestAverage = inclCancelled ? null : buildBest(bestBy.average);

  // 全空(21 口径 _21 未填充 / 选手两 type 都无排名)是暂态,禁 24h 缓存 —— 否则数据灌上后
  // nginx/客户端还要再瞎一天(2026-06-10 用户实际踩到).有数据才发长缓存.
  if (out.single || out.average) c.header('Cache-Control', CACHE_HEADER);
  else c.header('Cache-Control', 'no-store');
  return c.json(out);
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

// ── 10. /v1/wca/person-live-results ──
// 选手页「直播·非官方成绩」:官方 API 尚未收录的近期比赛成绩(cubing.com / WCA Live 源),
// 由 cubing_live.ts 的 prewarm 写穿 wca_live_person_results。客户端按比赛粒度与官方成绩去重后
// 内联进「全部成绩」,标「直播·非官方」。数据可变且短命 → 浏览器 60s,不进 nginx 长缓存。
wcaStatsExtraRoutes.get('/wca/person-live-results', async (c) => {
  const wcaId = (c.req.query('wcaId') ?? '').trim().toUpperCase();
  if (!/^[0-9]{4}[A-Z]{4}[0-9]{2}$/.test(wcaId)) {
    return c.json({ error: 'Invalid wcaId' }, 400);
  }
  try {
    const rows = await query<{
      comp_id: string; comp_name: string; comp_date: string | null;
      event_id: string; round_type_id: string; format_id: string;
      pos: number; best: number; average: number; attempts: number[] | null; source: string;
    }>(
      `SELECT comp_id, comp_name, comp_date, event_id, round_type_id, format_id,
              pos, best, average, attempts, source
         FROM wca_live_person_results
        WHERE wca_id = ?
          AND (comp_date IS NULL OR comp_date >= CURRENT_DATE - INTERVAL '60 days')
        ORDER BY comp_date DESC NULLS LAST, comp_id, event_id, round_type_id`,
      [wcaId],
    );

    const compsMap = new Map<string, { id: string; name: string; city: string; country_iso2: string; start_date: string; end_date: string }>();
    const results = rows.map((r, i) => {
      if (!compsMap.has(r.comp_id)) {
        compsMap.set(r.comp_id, {
          id: r.comp_id, name: r.comp_name, city: '', country_iso2: '',
          start_date: r.comp_date ?? '', end_date: r.comp_date ?? '',
        });
      }
      return {
        id: -(i + 1), // 合成负 id:避免与官方正 id 撞,且 React key 唯一
        competition_id: r.comp_id,
        event_id: r.event_id, round_type_id: r.round_type_id, format_id: r.format_id,
        best: r.best, average: r.average, pos: r.pos,
        attempts: Array.isArray(r.attempts) ? r.attempts : [],
        source: r.source,
      };
    });

    c.header('Cache-Control', 'public, max-age=60');
    return c.json({ wcaId, comps: [...compsMap.values()], results });
  } catch (e) {
    // 表缺失 / 查询异常 → 空响应,选手页只丢直播补充,官方成绩不受影响
    console.warn(`[person-live-results] ${wcaId}:`, (e as Error).message);
    return c.json({ wcaId, comps: [], results: [] });
  }
});
