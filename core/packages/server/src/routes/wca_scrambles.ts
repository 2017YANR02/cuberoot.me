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

// ── 按难度筛选(wca_scramble_steps,migration 0057)──────────────────────────
// 每条 3x3 真题存 steps[] 数组 = 各 (方法,阶段,底色) 最优步数;槽位偏移见 wca_scramble_steps_meta.layout
// (随管道重灌,内存缓存 10min)。子集 bin = 对所选底色槽取 LEAST;std 六色 cross/xcross 走预算的
// gm_cross6/gm_xcross6 列(有索引,飞镖 ~1ms),其余组合退化为分区扫描(可接受)。
type StepsLayout = { variants?: Record<string, Record<string, Record<string, number>>> };
let _stepsLayout: { at: number; v: StepsLayout | null } | null = null;
const LAYOUT_TTL_MS = 10 * 60 * 1000;
async function getStepsLayout(): Promise<StepsLayout | null> {
  const now = Date.now();
  if (_stepsLayout && now - _stepsLayout.at < LAYOUT_TTL_MS) return _stepsLayout.v;
  let v: StepsLayout | null = null;
  try {
    const rows = await query<{ layout: StepsLayout }>('SELECT layout FROM wca_scramble_steps_meta WHERE id = 1');
    v = rows[0]?.layout ?? null;
  } catch (err) {
    console.error('[wca-scrambles] steps layout read failed:', err);
  }
  _stepsLayout = { at: now, v };
  return v;
}

const VARIANT_RE = /^[a-z0-9_]{1,24}$/;
const STAGE_RE = /^[a-z0-9_]{1,32}$/;
const COLORS_RE = /^[BGORWY]{1,6}$/;
const STEP_COLORS6 = ['B', 'G', 'O', 'R', 'W', 'Y'] as const;
// steps s ↔ wca_scrambles ws 自然键 join(steps 表无 scramble 文本,需 join 取文本/optimal)。
const STEPS_WS_JOIN = `JOIN wca_scrambles ws
    ON ws.competition_id = s.competition_id AND ws.event_id = s.event_id
   AND ws.round_type_id = s.round_type_id AND ws.group_id = s.group_id
   AND ws.is_extra = s.is_extra AND ws.scramble_num = s.scramble_num`;

function parseStepList(s: string): number[] {
  const out = new Set<number>();
  for (const t of s.split(',')) { const n = Number(t); if (Number.isInteger(n) && n >= 0 && n <= 60) out.add(n); }
  return [...out].sort((a, b) => a - b);
}
function isAll6(colors: string): boolean { return [...colors].sort().join('') === 'BGORWY'; }

// 难度查询计划:predCol = 步数表达式(gm 列或 LEAST(选中底色槽));allSlots = 该 stage 6 底色槽
// (B,G,O,R,W,Y 顺序,供返回 cols 让前端挑 argmin 底色)。布局缺该 (方法,阶段) → null(数据未灌)。
// gmCol = 可用作「前过滤」的有索引 gm 列(仅 std/cross|xcross):因 gm = 六色最小 ≤ 任意子集最小,
//   故 子集最小 ∈ S ⟹ gmCol ≤ max(S),对子集底色查询加 `gmCol <= max(steps)` 谓词即可走
//   (event_id,gm_*,rnd) 索引区间扫描,把整分区扫描(~5s)降到小候选集(~几十 ms)。非 std 或非
//   cross/xcross stage 无对应 gm 列(gm_* 仅 std 六色十字/xcross),不可前过滤。
interface DiffPlan { predCol: string; allSlots: number[]; gmCol: string | null }
function planDifficulty(layout: StepsLayout | null, variant: string, stage: string, colors: string): DiffPlan | null {
  const st = layout?.variants?.[variant]?.[stage];
  if (!st || typeof st !== 'object') return null;
  const subset: number[] = [];
  for (const ch of colors) { const v = st[ch]; if (typeof v !== 'number') return null; subset.push(v); }
  if (subset.length === 0) return null;
  const allSlots: number[] = [];
  for (const ch of STEP_COLORS6) { const v = st[ch]; if (typeof v !== 'number') return null; allSlots.push(v); }
  // gmCol = 该 std 阶段「六色最优」的可索引表达式:cross/xcross 用预算列 gm_cross6/gm_xcross6;
  // xxcross/xxxcross/xxxxcross 用 LEAST(全 6 底色槽) —— 与 migration 0061 的表达式索引同形(slot 序
  // B,G,O,R,W,Y = allSlots),六色查询直接命中、子集查询作 `gmCol <= max(steps)` 前过滤。
  // 非 std(eo/pair/f2leo…)无预算 → null,走 (event_id,rnd) 通用飞镖索引。
  const gmCol = variant === 'std'
    ? (stage === 'cross' ? 's.gm_cross6'
      : stage === 'xcross' ? 's.gm_xcross6'
      : (stage === 'xxcross' || stage === 'xxxcross' || stage === 'xxxxcross')
        ? `LEAST(${allSlots.map((n) => `s.steps[${n}]`).join(',')})`
        : null)
    : null;
  let predCol: string;
  if (gmCol && isAll6(colors)) predCol = gmCol;
  else predCol = `LEAST(${subset.map((n) => `s.steps[${n}]`).join(',')})`;
  return { predCol, allSlots, gmCol };
}

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

  // 按难度出题(timer 复用):variant/stage/colors/steps 齐全 → 只抽 LEAST(所选底色) ∈ steps 的真题。
  const dVariant = c.req.query('variant') ?? '';
  const dStage = c.req.query('stage') ?? '';
  const dColors = c.req.query('colors') ?? '';
  const dSteps = parseStepList(c.req.query('steps') ?? '');
  const wantDifficulty = !!dVariant && !!dStage && !!dColors && dSteps.length > 0
    && VARIANT_RE.test(dVariant) && STAGE_RE.test(dStage) && COLORS_RE.test(dColors);

  try {
    if (wantDifficulty) {
      const plan = planDifficulty(await getStepsLayout(), dVariant, dStage, dColors);
      // 布局未就绪(冷启动 / meta 读取失败)是「暂态不可用」,非「该难度无真题」。用 503 而非 404,
      // 客户端据此重试而不是误判为空(404 专留给查询成功但 0 行的「确实无匹配」,见末尾)。
      if (!plan) return c.json({ error: 'difficulty data not available', event }, 503);
      const diffWhere = `${plan.predCol} IN (${dSteps.join(',')})`;
      // 子集底色前过滤:子集最小 ∈ steps ⟹ 六色最小 ≤ max(steps),加 `gmCol <= max` 走 gm 列 / std 深阶段
      // LEAST 表达式索引,把整分区扫描降到小候选集。dSteps 已由 parseStepList 校验为整数,内联安全。
      // 六色查询 predCol 即 gmCol(已直接命中索引)→ 不再重复加。
      const gmPrefilter = plan.gmCol && plan.predCol !== plan.gmCol ? ` AND ${plan.gmCol} <= ${Math.max(...dSteps)}` : '';
      let drows: RandomRow[];
      // 难度模式下,optimal 是「软偏好」而非硬过滤:稀有 bin(如 0 步十字,全表仅 2 条)可能命中真题,
      // 但它们都还没算出最优等态(wca_scramble_optimal 覆盖不全),硬加 `o IS NOT NULL` 会把本就存在的真题
      // 判成空 → 误报 404「无匹配」。故先带 optFilter 取;开了最优却 0 行时,回退到同难度的不带 optFilter
      // 查询(难度是主筛,拿到原打乱也好过死路)。客户端对无 o 字段的条目自动用原打乱。
      if (!hasFrom && !hasTo) {
        // 全时段统一飞镖采样:rnd>=dart 正向取 count,不足再 rnd<dart 环绕补齐。predCol/前过滤命中
        // gm_cross6/xcross6 列索引、std 深阶段六色 LEAST 表达式索引、或 (event_id,rnd) 通用索引过滤 —— 一律
        // LIMIT 提前停,毫秒级(替代旧 ORDER BY random() 整分区扫描:333 ~1.3M 行实测 2.5s,见 migration 0061)。
        const dart = Math.random();
        const dartSql = (cmp: '>=' | '<', opt: string) => `SELECT ${RANDOM_COLS}
             FROM wca_scramble_steps s
             ${STEPS_WS_JOIN}
             LEFT JOIN wca_competitions c ON c.id = s.competition_id
             ${OPT_JOIN}
            WHERE s.event_id = ?${gmPrefilter} AND ${diffWhere} AND s.rnd ${cmp} ? ${opt}
            ORDER BY s.rnd, ws.id LIMIT ?`;
        const runDart = async (opt: string): Promise<RandomRow[]> => {
          let r = await query<RandomRow>(dartSql('>=', opt), [event, dart, count]);
          if (r.length < count) {
            const more = await query<RandomRow>(dartSql('<', opt), [event, dart, count - r.length]);
            r = r.concat(more);
          }
          return r;
        };
        drows = await runDart(optFilter);
        if (optFilter && drows.length === 0) drows = await runDart('');
      } else {
        // 难度 + 日期:comp-sampling 叠难度谓词(+ gmPrefilter 缩候选)。
        const dWhere: string[] = []; const dParams: string[] = [];
        if (hasFrom) { dWhere.push('start_date >= ?'); dParams.push(from); }
        if (hasTo) { dWhere.push('start_date <= ?'); dParams.push(to); }
        const runComp = (opt: string) => query<RandomRow>(
          `SELECT ${RANDOM_COLS}
             FROM wca_scramble_steps s
             JOIN (SELECT id, name FROM wca_competitions WHERE ${dWhere.join(' AND ')}
                    ORDER BY random() LIMIT ${COMP_SAMPLE}) c ON c.id = s.competition_id
             ${STEPS_WS_JOIN}
             ${OPT_JOIN}
            WHERE s.event_id = ?${gmPrefilter} AND ${diffWhere} ${opt}
            ORDER BY random() LIMIT ?`,
          [...dParams, event, count],
        );
        drows = await runComp(optFilter);
        if (optFilter && drows.length === 0) drows = await runComp('');
      }
      if (drows.length === 0) return c.json({ error: 'no scrambles for difficulty', event }, 404);
      c.header('Cache-Control', 'no-store');
      return c.json({ event, scrambles: drows.map(toScrambleMeta) });
    }

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

// GET /wca/scrambles/by-difficulty?variant=&stage=&colors=&bin=&event=&q=&from=&to=&country=&page=&pageSize=
// 分布页「列举某步数的全部真题」+ 比赛名搜索 + 日期范围 + 国家(country_id)+ 分页。确定性(非随机)→ 可缓存。
// event 省略 = 全 3x3 族(合并池);传具体 event = 该项目(分开模式)。
type ByDiffRow = RandomRow & {
  comp_date: string | null;
  cb: number | null; cg: number | null; co: number | null; cr: number | null; cw: number | null; cy: number | null;
};
wcaScramblesRoutes.get('/wca/scrambles/by-difficulty', async (c) => {
  const variant = c.req.query('variant') ?? '';
  const stage = c.req.query('stage') ?? '';
  const colors = c.req.query('colors') ?? '';
  const bin = Number(c.req.query('bin'));
  if (!VARIANT_RE.test(variant) || !STAGE_RE.test(stage) || !COLORS_RE.test(colors)
      || !Number.isInteger(bin) || bin < 0 || bin > 60) {
    return c.json({ error: 'invalid params' }, 400);
  }
  const event = c.req.query('event') ?? '';
  const hasEvent = /^[0-9a-z]{2,6}$/.test(event);
  const q = (c.req.query('q') ?? '').trim().slice(0, 80);
  const from = c.req.query('from') ?? ''; const to = c.req.query('to') ?? '';
  const hasFrom = DATE_RE.test(from); const hasTo = DATE_RE.test(to);
  // 按国家筛选:值 = WCA country_id(如 USA / China / United Kingdom;参数化绑定,无注入风险,仅限长)。
  const country = (c.req.query('country') ?? '').trim().slice(0, 50);
  const hasCountry = country.length > 0;
  const page = Math.max(1, Number(c.req.query('page')) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(c.req.query('pageSize')) || 50));
  const offset = (page - 1) * pageSize;

  try {
    const plan = planDifficulty(await getStepsLayout(), variant, stage, colors);
    if (!plan) {
      // 布局/数据未就绪(管道还没灌)→ 优雅返回空,不 500。
      c.header('Cache-Control', 'no-store');
      return c.json({ total: 0, page, pageSize, scrambles: [] });
    }
    const where: string[] = [`${plan.predCol} = ${bin}`]; // bin 已校验为整数,内联安全
    // 子集底色前过滤:子集最小 = bin ⟹ gmCol <= bin → 走 (event_id,gm_*,rnd) 索引,避免整分区扫描。
    if (plan.gmCol && plan.predCol !== plan.gmCol) where.push(`${plan.gmCol} <= ${bin}`);
    const params: unknown[] = [];
    if (hasEvent) { where.push('s.event_id = ?'); params.push(event); }
    if (q) { where.push('c.name ILIKE ?'); params.push(`%${q}%`); }
    if (hasFrom) { where.push('c.start_date >= ?'); params.push(from); }
    if (hasTo) { where.push('c.start_date <= ?'); params.push(to); }
    if (hasCountry) { where.push('c.country_id = ?'); params.push(country); }
    const needComp = !!q || hasFrom || hasTo || hasCountry;
    const whereSql = where.join(' AND ');

    const cntRows = await query<{ n: string }>(
      `SELECT count(*)::text AS n
         FROM wca_scramble_steps s
         ${needComp ? 'JOIN wca_competitions c ON c.id = s.competition_id' : ''}
        WHERE ${whereSql}`,
      params,
    );
    const total = Number(cntRows[0]?.n ?? 0);

    const colSel = STEP_COLORS6
      .map((ch, i) => `s.steps[${plan.allSlots[i]}] AS c${ch.toLowerCase()}`)
      .join(', ');
    const rows = await query<ByDiffRow>(
      `SELECT ws.competition_id, ws.event_id, ws.round_type_id, ws.group_id,
              (ws.is_extra = 1) AS is_extra, ws.scramble_num, ws.scramble,
              c.name AS comp_name, c.start_date AS comp_date, o.optimal_scramble, ${colSel}
         FROM wca_scramble_steps s
         ${STEPS_WS_JOIN}
         LEFT JOIN wca_competitions c ON c.id = s.competition_id
         ${OPT_JOIN}
        WHERE ${whereSql}
        ORDER BY c.start_date DESC NULLS LAST, ws.competition_id, ws.scramble_num
        LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    );
    const scrambles = rows.map((r) => ({
      ...toScrambleMeta(r),
      cd: r.comp_date ?? '',
      cols: [r.cb, r.cg, r.co, r.cr, r.cw, r.cy], // B,G,O,R,W,Y(前端挑 argmin 底色)
    }));
    c.header('Cache-Control', total > 0 ? 'public, max-age=300, s-maxage=86400' : 'no-store');
    return c.json({ total, page, pageSize, scrambles });
  } catch (err) {
    console.error('[wca-scrambles] by-difficulty failed:', err);
    return c.json({ error: 'query failed' }, 500);
  }
});
