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

// ── 按难度筛选(wca_scramble_steps,migration 0057/0061/0062)────────────────
// 每条 3x3 真题存 steps[] 数组 = 各 (方法,阶段,底色) 最优步数;槽位偏移见 wca_scramble_steps_meta.layout
// (随管道重灌,内存缓存 10min)。子集 bin = 对所选底色槽取 LEAST。三层查询计划:
//   1) std 六色 cross/xcross 走预算 gm_cross6/gm_xcross6 列索引、深阶段走 LEAST 表达式索引(飞镖 ~1ms);
//   2) 稀有档(所选各底色槽的该步数值全库计数 ≤ K,尾部值表 = layout.tails)按色拆分支直查
//      wca_scramble_steps_rare 侧表((slot,val) PK 直达,候选 ≤ 6×K;先 LIMIT 再 join 取文本);
//   3) 其余走 (event_id,rnd) 覆盖索引 index-only 飞镖扫描(0062;常见 bin LIMIT 提前停,ms 级)。
type StepsLayout = {
  variants?: Record<string, Record<string, Record<string, number>>>;
  tails?: Record<string, number[]>; // 1-based slot → 侧表覆盖的步数值(与 rare 表同事务替换)
  rare_k?: number;
};
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

// 3x3 族合并池(family=1):这些项目的打乱都是同一颗 3x3 的随机态,只是当年被用在不同项目的轮次里。
// 难度筛可选合并 —— 稀有档往往整族只有个位数条(BG 十字 8 步全库仅 1 条,还恰好落在 333bf 决赛),
// 分项目查会把它们全筛掉,与 /scramble/stats 难度 tab 的合并口径也对不上(用户看图有、计时器查无)。
// 333mbf 不在 wca_scramble_steps 里(build_scramble_steps.ts 的 EXCLUDE_EVENTS:多盲拆子打乱会
// 撞自然键主键),且多盲要成组出题,故不列入 —— 传 family=1 对它是无操作。
const FAMILY_333 = ['333', '333oh', '333bf', '333ft', '333fm'];
/** 合并开启且该 event 属 3x3 族 → 整族;否则单查原 event(合并对其它项目无意义)。 */
function poolEvents(event: string, merged: boolean): string[] {
  return merged && FAMILY_333.includes(event) ? FAMILY_333 : [event];
}
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
interface DiffPlan {
  predCol: string; allSlots: number[]; gmCol: string | null;
  /** 去重后的所选底色槽(1-based)与其在 stage6/steps 六色序(B,G,O,R,W,Y)里的 1-based 位置,
   *  平行数组 —— rare 侧表按色拆分支用。 */
  subsetSlots: number[]; subsetPos: number[];
}
function planDifficulty(layout: StepsLayout | null, variant: string, stage: string, colors: string): DiffPlan | null {
  const st = layout?.variants?.[variant]?.[stage];
  if (!st || typeof st !== 'object') return null;
  const subset: number[] = [];
  const subsetSlots: number[] = []; const subsetPos: number[] = [];
  const seen = new Set<string>();
  for (const ch of colors) {
    const v = st[ch];
    if (typeof v !== 'number') return null;
    subset.push(v);
    if (!seen.has(ch)) { seen.add(ch); subsetSlots.push(v); subsetPos.push(STEP_COLORS6.indexOf(ch as typeof STEP_COLORS6[number]) + 1); }
  }
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
  return { predCol, allSlots, gmCol, subsetSlots, subsetPos };
}

// ── 稀有档侧表路由(wca_scramble_steps_rare,migration 0062)──────────────────
// 所选每个底色槽在每个查询 bin 上都命中 layout.tails(该 (slot,val) 全库计数 ≤ K,其全部行
// 已在侧表)→ 子集最小值 = bin 的候选行必然在侧表里,可(slot,val)直达,免大表扫描。
function rareCovers(layout: StepsLayout | null, plan: DiffPlan, bins: number[]): boolean {
  const tails = layout?.tails;
  if (!tails || bins.length === 0) return false;
  return bins.every((v) => plan.subsetSlots.every((slot) => tails[String(slot)]?.includes(v)));
}

// min(所选底色) = v 按色拆不重不漏分支:第 i 色 = v,且前面的色 > v、后面的色 ≥ v
// (同为 v 的行归属其第一个达到 min 的色)。兄弟色判据用行内 stage6 快照(B,G,O,R,W,Y 序),
// NULL(该槽无数据)按 +∞ 处理(与大表 LEAST 忽略 NULL 的语义一致)。全部数值为服务端推导整数,内联安全。
function rareBranchSql(plan: DiffPlan, bins: number[]): string {
  const parts: string[] = [];
  for (const v of bins) {
    for (let i = 0; i < plan.subsetSlots.length; i++) {
      const conds = [`r.slot = ${plan.subsetSlots[i]}`, `r.val = ${v}`];
      for (let j = 0; j < plan.subsetSlots.length; j++) {
        if (j === i) continue;
        conds.push(`COALESCE(r.stage6[${plan.subsetPos[j]}], 32767) ${j < i ? '>' : '>='} ${v}`);
      }
      parts.push(`(${conds.join(' AND ')})`);
    }
  }
  return parts.join(' OR ');
}

// steps 行 → wca_scramble_optimal 自然键 join(飞镖分支用)。「最优打乱」软偏好必须在 per-event
// LIMIT 之前生效,否则先取 count 条再过滤会把结果打空 —— 故内联进 LATERAL 子查询而非外层 WHERE。
const STEPS_OPT_JOIN = `JOIN wca_scramble_optimal so
    ON so.competition_id = s.competition_id AND so.event_id = s.event_id
   AND so.round_type_id = s.round_type_id AND so.group_id = s.group_id
   AND so.is_extra = s.is_extra AND so.scramble_num = s.scramble_num`;

// 侧表行 → wca_scramble_optimal 自然键 join(「最优打乱」软偏好在 LIMIT 前生效用)。
const RARE_OPT_JOIN = `JOIN wca_scramble_optimal ro
    ON ro.competition_id = r.competition_id AND ro.event_id = r.event_id
   AND ro.round_type_id = r.round_type_id AND ro.group_id = r.group_id
   AND ro.is_extra = r.is_extra AND ro.scramble_num = r.scramble_num`;

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

// GET /wca/scrambles/random?event=333&count=5&from=&to=&family= — 随机真实打乱(timer 练习池)。
// family=1 且难度筛开启 → 跨 3x3 族取题(见 FAMILY_333),与 /scramble/stats 难度 tab 同口径。
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
  // family=1:难度筛跨整个 3x3 族取题(见 FAMILY_333)。只作用于难度分支 —— 不筛难度时按项目出题
  // 本来就是对的,合并没有意义。
  const events = poolEvents(event, c.req.query('family') === '1');

  try {
    if (wantDifficulty) {
      const layout = await getStepsLayout();
      const plan = planDifficulty(layout, dVariant, dStage, dColors);
      // 布局未就绪(冷启动 / meta 读取失败)是「暂态不可用」,非「该难度无真题」。用 503 而非 404,
      // 客户端据此重试而不是误判为空(404 专留给查询成功但 0 行的「确实无匹配」,见末尾)。
      if (!plan) return c.json({ error: 'difficulty data not available', event }, 503);

      // 稀有档:所选 bins 全部命中侧表尾部 → 直查侧表(候选 ≤ 6×K×|bins|,先 LIMIT 再 join 取文本)。
      // tails 按全 event 合并计数 → 按 events 过滤后 0 行 = 该(些)项目在此难度档确实无真题(可靠 404)。
      // 侧表主键是 (slot,val,...),event_id 不是前导列 —— 合并与否都走同一段 (slot,val) 直达,代价相同。
      if (rareCovers(layout, plan, dSteps)) {
        const cond = rareBranchSql(plan, dSteps);
        const rWhere: string[] = [`r.event_id IN (${events.map(() => '?').join(',')})`, `(${cond})`];
        const rParams: unknown[] = [...events];
        if (hasFrom) { rWhere.push('cd.start_date >= ?'); rParams.push(from); }
        if (hasTo) { rWhere.push('cd.start_date <= ?'); rParams.push(to); }
        const needDates = hasFrom || hasTo;
        const runRare = (withOpt: boolean) => query<RandomRow>(
          `SELECT ${RANDOM_COLS}
             FROM (SELECT r.competition_id, r.event_id, r.round_type_id, r.group_id, r.is_extra, r.scramble_num
                     FROM wca_scramble_steps_rare r
                     ${needDates ? 'JOIN wca_competitions cd ON cd.id = r.competition_id' : ''}
                     ${withOpt ? RARE_OPT_JOIN : ''}
                    WHERE ${rWhere.join(' AND ')}
                    ORDER BY random() LIMIT ?) s
             ${STEPS_WS_JOIN}
             LEFT JOIN wca_competitions c ON c.id = s.competition_id
             ${OPT_JOIN}`,
          [...rParams, count],
        );
        let drows = await runRare(!!optFilter);
        if (optFilter && drows.length === 0) drows = await runRare(false);
        if (drows.length === 0) return c.json({ error: 'no scrambles for difficulty', event }, 404);
        c.header('Cache-Control', 'no-store');
        return c.json({ event, scrambles: drows.map(toScrambleMeta) });
      }
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
        // 逐 event 各取前 count 条再归并,而不是把 events 塞进一个 IN:覆盖索引是 (event_id, rnd),
        // event_id 一旦不再是等值前导列,ORDER BY rnd 就没索引可用 —— 实测直接去掉 event 谓词会从
        // 8.5ms 退化成 3.1s 的全表 parallel seq scan。归并结果精确而非近似:全局按 rnd 的前 count 条
        // 必然是各 event 各自前 count 条的子集。单 event 时退化成一次索引扫描,不比原来贵。
        // 另外先在 steps 表 LIMIT、再 join 文本/比赛表,比原先平铺 join 更快(全热实测 26ms → 6ms)。
        const evPlaceholders = events.map(() => '?').join(',');
        const dartSql = (cmp: '>=' | '<', withOpt: boolean) => `SELECT ${RANDOM_COLS}
             FROM (SELECT m.competition_id, m.event_id, m.round_type_id, m.group_id,
                          m.is_extra, m.scramble_num, m.rnd
                     FROM unnest(ARRAY[${evPlaceholders}]::varchar[]) AS ev(e)
                     CROSS JOIN LATERAL (
                       SELECT s.competition_id, s.event_id, s.round_type_id, s.group_id,
                              s.is_extra, s.scramble_num, s.rnd
                         FROM wca_scramble_steps s
                         ${withOpt ? STEPS_OPT_JOIN : ''}
                        WHERE s.event_id = ev.e${gmPrefilter} AND ${diffWhere} AND s.rnd ${cmp} ?
                        ORDER BY s.rnd LIMIT ?) m
                    ORDER BY m.rnd LIMIT ?) s
             ${STEPS_WS_JOIN}
             LEFT JOIN wca_competitions c ON c.id = s.competition_id
             ${OPT_JOIN}
            ORDER BY s.rnd, ws.id LIMIT ?`;
        const runDart = async (withOpt: boolean): Promise<RandomRow[]> => {
          let r = await query<RandomRow>(dartSql('>=', withOpt), [...events, dart, count, count, count]);
          if (r.length < count) {
            const need = count - r.length;
            const more = await query<RandomRow>(dartSql('<', withOpt), [...events, dart, need, need, need]);
            r = r.concat(more);
          }
          return r;
        };
        drows = await runDart(!!optFilter);
        if (optFilter && drows.length === 0) drows = await runDart(false);
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
            WHERE s.event_id IN (${events.map(() => '?').join(',')})${gmPrefilter} AND ${diffWhere} ${opt}
            ORDER BY random() LIMIT ?`,
          [...dParams, ...events, count],
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
  // names: \n-joined exact WCA competition names — used by the client to search
  // by localized (Chinese) comp name, which the DB doesn't store: the client
  // resolves the CJK query to matching WCA names via comp_names_zh and sends them here.
  const names = (c.req.query('names') ?? '').split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 300);
  const hasNames = names.length > 0;
  const from = c.req.query('from') ?? ''; const to = c.req.query('to') ?? '';
  const hasFrom = DATE_RE.test(from); const hasTo = DATE_RE.test(to);
  // 按国家筛选:值 = WCA country_id(如 USA / China / United Kingdom;参数化绑定,无注入风险,仅限长)。
  const country = (c.req.query('country') ?? '').trim().slice(0, 50);
  const hasCountry = country.length > 0;
  // facet=country → 返回各国计数(聚合,不分页);否则走常规列表。
  const facet = (c.req.query('facet') ?? '').trim();
  const page = Math.max(1, Number(c.req.query('page')) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(c.req.query('pageSize')) || 50));
  const offset = (page - 1) * pageSize;

  try {
    const layout = await getStepsLayout();
    const plan = planDifficulty(layout, variant, stage, colors);
    if (!plan) {
      // 布局/数据未就绪(管道还没灌)→ 优雅返回空,不 500。
      c.header('Cache-Control', 'no-store');
      return c.json({ total: 0, page, pageSize, scrambles: [] });
    }

    // 稀有档:该 bin 在所选各底色槽都命中侧表尾部 → 全部查询(facet/count/列表)直查侧表,
    // 免大表扫描(此前稀有 bin 列举 = 全表扫只捞几条,实测 8s)。列表先 LIMIT 再 join 取文本。
    if (rareCovers(layout, plan, [bin])) {
      const rWhere: string[] = [`(${rareBranchSql(plan, [bin])})`];
      const rParams: unknown[] = [];
      if (hasEvent) { rWhere.push('r.event_id = ?'); rParams.push(event); }
      if (facet === 'country') {
        const rows = await query<{ id: string; n: string }>(
          `SELECT c.country_id AS id, count(*)::text AS n
             FROM wca_scramble_steps_rare r
             JOIN wca_competitions c ON c.id = r.competition_id
            WHERE ${rWhere.join(' AND ')} AND c.country_id IS NOT NULL
            GROUP BY c.country_id
            ORDER BY count(*) DESC, c.country_id`,
          rParams,
        );
        const countries = rows.map((r) => ({ id: r.id, n: Number(r.n) }));
        const facetTotal = countries.reduce((a, r) => a + r.n, 0);
        c.header('Cache-Control', facetTotal > 0 ? 'public, max-age=300, s-maxage=86400' : 'no-store');
        return c.json({ facet: 'country', total: facetTotal, countries });
      }
      if (q) { rWhere.push('c.name ILIKE ?'); rParams.push(`%${q}%`); }
      if (hasNames) { rWhere.push('c.name = ANY(?)'); rParams.push(names); }
      if (hasFrom) { rWhere.push('c.start_date >= ?'); rParams.push(from); }
      if (hasTo) { rWhere.push('c.start_date <= ?'); rParams.push(to); }
      if (hasCountry) { rWhere.push('c.country_id = ?'); rParams.push(country); }
      const cntRows = await query<{ n: string }>(
        `SELECT count(*)::text AS n
           FROM wca_scramble_steps_rare r
           LEFT JOIN wca_competitions c ON c.id = r.competition_id
          WHERE ${rWhere.join(' AND ')}`,
        rParams,
      );
      const total = Number(cntRows[0]?.n ?? 0);
      const rareColSel = STEP_COLORS6.map((ch, i) => `s.stage6[${i + 1}] AS c${ch.toLowerCase()}`).join(', ');
      const rows = await query<ByDiffRow>(
        `SELECT ws.competition_id, ws.event_id, ws.round_type_id, ws.group_id,
                (ws.is_extra = 1) AS is_extra, ws.scramble_num, ws.scramble,
                s.comp_name, s.comp_date, o.optimal_scramble, ${rareColSel}
           FROM (SELECT r.*, c.name AS comp_name, c.start_date AS comp_date
                   FROM wca_scramble_steps_rare r
                   LEFT JOIN wca_competitions c ON c.id = r.competition_id
                  WHERE ${rWhere.join(' AND ')}
                  ORDER BY c.start_date DESC NULLS LAST, r.competition_id, r.scramble_num
                  LIMIT ? OFFSET ?) s
           ${STEPS_WS_JOIN}
           ${OPT_JOIN}
          ORDER BY s.comp_date DESC NULLS LAST, s.competition_id, s.scramble_num`,
        [...rParams, pageSize, offset],
      );
      const scrambles = rows.map((r) => ({
        ...toScrambleMeta(r),
        cd: r.comp_date ?? '',
        cols: [r.cb, r.cg, r.co, r.cr, r.cw, r.cy], // B,G,O,R,W,Y(前端挑 argmin 底色)
      }));
      c.header('Cache-Control', total > 0 ? 'public, max-age=300, s-maxage=86400' : 'no-store');
      return c.json({ total, page, pageSize, scrambles });
    }

    const where: string[] = [`${plan.predCol} = ${bin}`]; // bin 已校验为整数,内联安全
    // 子集底色前过滤:子集最小 = bin ⟹ gmCol <= bin → 走 (event_id,gm_*,rnd) 索引,避免整分区扫描。
    if (plan.gmCol && plan.predCol !== plan.gmCol) where.push(`${plan.gmCol} <= ${bin}`);
    const params: unknown[] = [];
    if (hasEvent) { where.push('s.event_id = ?'); params.push(event); }

    // facet=country:该 (变体,阶段,底色,步数[,项目]) 下各国真题计数(与列表同源,前端下拉计数用)。
    // 只按 bin/subset/event 聚合(忽略 q/from/to/country),GROUP BY 比赛所属国。确定性 → 可缓存。
    if (facet === 'country') {
      const rows = await query<{ id: string; n: string }>(
        `SELECT c.country_id AS id, count(*)::text AS n
           FROM wca_scramble_steps s
           JOIN wca_competitions c ON c.id = s.competition_id
          WHERE ${where.join(' AND ')} AND c.country_id IS NOT NULL
          GROUP BY c.country_id
          ORDER BY count(*) DESC, c.country_id`,
        params,
      );
      const countries = rows.map((r) => ({ id: r.id, n: Number(r.n) }));
      const facetTotal = countries.reduce((a, r) => a + r.n, 0);
      c.header('Cache-Control', facetTotal > 0 ? 'public, max-age=300, s-maxage=86400' : 'no-store');
      return c.json({ facet: 'country', total: facetTotal, countries });
    }

    if (q) { where.push('c.name ILIKE ?'); params.push(`%${q}%`); }
    if (hasNames) { where.push('c.name = ANY(?)'); params.push(names); }
    if (hasFrom) { where.push('c.start_date >= ?'); params.push(from); }
    if (hasTo) { where.push('c.start_date <= ?'); params.push(to); }
    if (hasCountry) { where.push('c.country_id = ?'); params.push(country); }
    const needComp = !!q || hasNames || hasFrom || hasTo || hasCountry;
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
