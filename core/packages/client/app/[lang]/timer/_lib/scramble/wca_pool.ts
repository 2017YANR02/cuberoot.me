/**
 * WCA real-scramble pool — feeds the timer with actual past WCA competition
 * scrambles. Two source modes (chosen in settings → WcaSourceConfig):
 *
 *   'date': uniformly random across official scrambles in a date range. Fetched
 *           from /v1/wca/scrambles/random (server samples ~30 random comps in
 *           range → random scrambles), refilled in the background.
 *   'comp': one specific competition, optionally narrowed to a round / group.
 *           Loaded once via fetchWcaScrambles (cached) and served in competition
 *           order (round → group → number), looping.
 *
 * generateScramble() is synchronous, so each source keeps an in-memory queue
 * keyed by its spec; the SoloView shows a brief loading state when a queue is
 * momentarily empty. Each scramble carries its source metadata (ci/cn/e/r/g/n/x,
 * same shape as the landing RecentScrambles meta), keyed by the normalized
 * scramble string and looked up via wcaMetaFor().
 */
import { apiUrl } from '@/lib/api-base';
import { statsUrl } from '@/lib/stats-base';
import { fetchWcaScrambles } from '@/lib/wca-results-api';
import { fetchByDifficulty } from '@/lib/scramble-by-difficulty';
import { groupIdxOf } from '@/lib/wca-scramble-group';
import { fetchPuzzleExamples, type PuzzleExamplesJson } from '@/lib/puzzle-examples';
import { scrambleStepMetric } from './gen-by-steps';
import type { EventId } from '../types';

// timer EventId → WCA scrambles event_id. Events absent here have no real
// competition scrambles (relays / CFOP-step training / 6-7 BLD / magic) and
// always fall back to locally generated scrambles.
const EVENT_MAP: Partial<Record<EventId, string>> = {
  '222': '222', '333': '333', '444': '444', '555': '555', '666': '666', '777': '777',
  '333oh': '333oh', '333fm': '333fm', '333mr': '333', '333ni': '333',
  '333bld': '333bf', '333mbld': '333mbf', '444bld': '444bf', '555bld': '555bf',
  pyra: 'pyram', skewb: 'skewb', sq1: 'sq1', mega: 'minx', clock: 'clock',
};

// WCA event_ids (mapped values above) with a God's-number optimal-equivalent scramble available
// (see wca_scramble_optimal in the DB, computed by an exact solver for these homogeneous events
// only). Single source of truth — both the "最优打乱" toggle's visibility (WcaSourceConfig) and
// the pool's actual filtering here must agree, or a stale wcaUseOptimal=true left over from
// switching away from one of these events would silently filter out every real scramble of an
// event that has no optimal data (e.g. clock) — filtering here is what actually matters; the UI
// toggle is just a convenience that mirrors this set.
export const WCA_OPTIMAL_EVENTS = new Set(['333', '333oh', '333ft', '333fm', '222', 'pyram', 'skewb']);
function supportsOptimal(w: string): boolean { return WCA_OPTIMAL_EVENTS.has(w); }

// 一次向 /random 要几条。服务端把 count 钳在 SERVER_MAX_COUNT 内,本值必须 <= 它,
// 否则「回得比要的少」不再等价于「已穷尽」,封闭集判定(见 closedFor)会误判。
const SERVER_MAX_COUNT = 50; // 与 server routes/wca_scrambles.ts 的 Math.min(50, ...) 对齐
const FETCH_COUNT = Math.min(50, SERVER_MAX_COUNT);
const REFILL_AT = 8;
const META_CAP = 1000; // 元数据 Map 软上限,超出按插入序丢最旧。

// 比赛轮次先后(初赛→决赛),用于 comp 模式按真实赛程顺序排打乱。
const ROUND_SEQ: Record<string, number> = {
  '1': 0, 'd': 0, 'h': 0, '2': 1, 'e': 1, 'g': 1, '3': 2, 'b': 3, 'c': 3, 'f': 3,
};

/** Where the timer should draw real scrambles from (derived from TimerSettings). */
export interface WcaSourceSpec {
  event: EventId;
  mode: 'date' | 'comp';
  comp: string;        // competition_id (comp mode)
  compName: string;    // competition display name (comp mode)
  round: string;       // round_type_id filter, '' = all (comp mode)
  group: string;       // group_id filter, '' = all (comp mode)
  from: string;        // 'YYYY-MM-DD', '' = no lower bound (date mode)
  to: string;          // 'YYYY-MM-DD', '' = no upper bound (date mode)
  optimal: boolean;    // 用 God's-number 最短等态打乱(同态项目 333/oh/ft/fm 才有,无则回退原打乱)
  // 按难度过滤(3x3 族):date 模式服务端 /random 直接筛;comp 模式走 by-difficulty 端点按本场逐 bin 拉。
  // steps 为空 = 不过滤。variant/stage/colors 同 /scramble/stats 的口径。
  // merged = 跨 3x3 族取题(/random 传 family=1;by-difficulty 省略 event —— 两端都是「合并池」口径,
  // 与 /scramble/stats 难度 tab 一致)。关掉则只在当前项目里找。
  diff?: { variant: string; stage: string; colors: string; steps: number[]; merged: boolean };
  // 「按步数」过滤(2×2 / 金字塔):客户端算每条真题的度量步数,只留 [lo,hi] 内的。
  // date + comp 两种模式都生效(真题分布近上帝数,低步数可能全被过滤 → knownEmpty → UI 提示)。
  stepFilter?: { metric: string; lo: number; hi: number };
}

/** 一条真实打乱的来源元数据(键名对齐首页 RecentScrambles 的 ScrMeta)。 */
export interface WcaScrambleMeta {
  ci: string; cn: string; e: string; r: string; g: string; n: number; x: 0 | 1;
  // 开了「最优打乱」却拿到原打乱(该难度档无最优等态,服务器回退)→ UI 标「非最优」。
  nonOptimal?: boolean;
}
interface RandomItem extends WcaScrambleMeta { scramble: string; o?: string } // o = 最优打乱(server 带,见 wca_scramble_optimal)

const pools: Record<string, string[]> = {};
const inflight: Record<string, Promise<void> | undefined> = {};
const metaByScramble = new Map<string, WcaScrambleMeta>();
// comp 模式:过滤 + 排序后的整场打乱(按 specKey 缓存,refill 时循环灌回队列)。
const compRows: Record<string, { scramble: string; meta: WcaScrambleMeta }[]> = {};
// 已确认「确实没有真题」的来源 key:难度组合无匹配(端点 404)/ 选定比赛缺此项目。
// 用于让 UI 显式提示,而不是悄悄伪造一条本地生成打乱(无比赛来源、且不符所选难度)。
// 与「瞬时空(还在加载 / 网络失败)」区分:后者不进此集合,稍后重取。
const knownEmpty = new Set<string>();
// comp + 难度:某场比赛此(方法/阶段/配色)在难度库(wca_scramble_steps)是否有任何步数数据。
// true=已入库(空只是此难度档无匹配)/ false=未入库(离线管道还没算这场,常见于新赛)。
// 让 UI 区分「换步数/配色」与「改用日期模式/等回填」两种提示(见 compHasAnyStepData)。undetermined 不入。
const compCoverage = new Map<string, boolean>();
// 「按步数」date 模式客户端过滤:一次 fillDate 内最多连抓这么多批(每批 FETCH_COUNT 条)找匹配,
// 命中即停(常见区间一批即够,秒出);全空才判 knownEmpty。放在同一次 fill 内连抓(而非拆成
// SoloView 的退避重试)避免累计几秒才提示。批数上限要够大以覆盖稀有但真实存在的区间:实测 2000 条
// 真题里 2×2 底层=0 占 ~1/400、底层=1 占 ~1/180,4 批(200 条)会 ~60% 概率漏掉 → 误报「无匹配」;
// 30 批(1500 条)对 1/400 有 ~98% 命中率。命中即停,所以常见区间仍是一批秒出、稀有区间平均抓 ~8 批
// 即出;只有真正空的区间(如底层=7、htm≤3)才抓满 30 批才提示「无匹配」(~3s,之后 knownEmpty 缓存)。
const MAX_FILTER_BATCHES = 30;

// 「按步数」预计算真题桶:stats/scramble/puzzle_examples.json 的 metrics.<度量>.bins 存了每个步数值的
// 真实比赛打乱(稀有值全量,≤300)。稀有区间(如 2×2 底层=0)live 采样难命中,直接播种这些预计算真题
// → 即时+可靠;常见区间再用 live 补充变化。timer event → puzzle_examples.json 的 puzzle key。
const EXAMPLES_KEY: Record<string, string> = { '222': '222', pyra: 'pyraminx' };
let examplesCache: PuzzleExamplesJson | null = null;
let examplesPromise: Promise<PuzzleExamplesJson | null> | null = null;
function loadExamples(): Promise<PuzzleExamplesJson | null> {
  if (examplesCache) return Promise.resolve(examplesCache);
  if (!examplesPromise) {
    examplesPromise = fetchPuzzleExamples()
      .then((j) => { examplesCache = j; return j; })
      .catch(() => { examplesPromise = null; return null; }); // 失败重置,下次可重试
  }
  return examplesPromise;
}
// 难度直方图(distribution.json):每 (方法,阶段,底色) 的真实步数 min/max —— 用作 comp 覆盖探测的 bin 全域。
// 与 WcaSourceConfig 用同一份 JSON(浏览器缓存命中),这里只在 comp+难度为空的兜底路径按需拉一次(模块缓存)。
interface DiffHist { min: number; max: number }
interface DiffDistJson { sets: Record<string, { variants: Record<string, { data: Record<string, Record<string, DiffHist>> }> }> }
let distCache: DiffDistJson | null = null;
let distPromise: Promise<DiffDistJson | null> | null = null;
function loadDist(): Promise<DiffDistJson | null> {
  if (distCache) return Promise.resolve(distCache);
  if (!distPromise) {
    distPromise = fetch(statsUrl('/stats/scramble/distribution.json'))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.sets) distCache = j as DiffDistJson; return distCache; })
      .catch(() => { distPromise = null; return null; }); // 失败重置,下次可重试
  }
  return distPromise;
}

const precomputedSeeded = new Set<string>();       // 已建过预计算桶的 key(每 key 只 seed 一次)
const precomputedFor = new Map<string, string[]>(); // key -> 区间内预计算真题打乱串(refill 洗牌灌回池)

// 封闭集:该 key 的匹配全集(已确认穷尽)。稀有难度档(如 0 步十字 / 8 步双色十字)全库仅 2-4 条,
// 而 /random 每次都要全分区扫才捞得到它们(生产实测 1.4-2.6s)—— 队列一见底就联网、又只补回同样
// 那几条,于是每两三次出题就卡一次转圈。服务端在「全时段(无 from/to)」两条路径都是扫完全集再
// LIMIT(飞镖正向 rnd>=dart + 环绕 rnd<dart;稀有侧表 ORDER BY random()),所以「要 FETCH_COUNT
// 条却回得更少」严格等价于「匹配全集就这么多」。据此把全集存下,之后本地洗牌循环,永不再联网。
// 有 from/to 时不成立(那条路是 comp-sampling,只抽 30 场,回得少 ≠ 穷尽),故仅全时段登记。
const closedFor = new Map<string, string[]>();

// 已端出过的真题(按 key),用于封闭集的「已练 n/N」提示。上限就是封闭集可能的最大条数,
// 非封闭 key(常见档全库上万条,永不展示进度)加到上限即停,不再增长。
const servedFor = new Map<string, Set<string>>();
function noteServed(key: string, s: string): void {
  let set = servedFor.get(key);
  if (!set) { set = new Set(); servedFor.set(key, set); }
  if (set.size < SERVER_MAX_COUNT) set.add(s);
}

/** 封闭集(真题总数已知且有限,见 closedFor)的遍历进度 { total, seen };非封闭 / 未知 → null。
 *  UI 据此在稀有档提示「共几条、已练几条、练完后开始重复」——不必等用户自己发现打乱在转圈复现。
 *  seen 取交集而非 servedFor.size:池子换 key 前后 served 可能混入不属于当前全集的条目。 */
export function wcaPoolProgress(spec: WcaSourceSpec): { total: number; seen: number } | null {
  const key = specKey(spec);
  if (!key) return null;
  const closed = closedFor.get(key);
  if (!closed || closed.length === 0) return null;
  const set = servedFor.get(key);
  let seen = 0;
  for (const s of closed) if (set?.has(s)) seen++;
  return { total: closed.length, seen };
}

// localStorage persistence — so reopening the timer (or returning to a source /
// setting used before) serves the first scramble instantly from cache and tops
// up in the background, instead of waiting on the cold network fetch. Only a
// never-before-fetched context still needs the one round trip. SSR / node (tests)
// have no localStorage; every access is guarded.
const STORE_KEY = 'cuberoot.wca-pool.v1';
const STORE_TTL = 7 * 24 * 3600 * 1000; // 7 天后视为过期,丢弃
const STORE_KEYS_CAP = 8;               // 最多缓存几个来源(按 pools 顺序保留最近的)
const STORE_PER_KEY = 50;               // 每个来源最多缓存几条
let hydrated = false;

function lsAvailable(): Storage | null {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

/** Restore queued scrambles + their metadata from a previous session (once). */
function hydrate(): void {
  if (hydrated) return;
  hydrated = true;
  const ls = lsAvailable();
  if (!ls) return;
  try {
    const raw = ls.getItem(STORE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw) as { t: number; pools: Record<string, string[]>; meta: [string, WcaScrambleMeta][] };
    if (!data || typeof data.t !== 'number' || Date.now() - data.t > STORE_TTL) return;
    for (const [k, q] of Object.entries(data.pools ?? {})) if (Array.isArray(q) && q.length) pools[k] ??= q.slice();
    for (const [s, m] of data.meta ?? []) if (!metaByScramble.has(s)) metaByScramble.set(s, m);
  } catch { /* corrupt / unavailable — ignore */ }
}

let persistTimer = 0;
/** Debounced write of the current queues + the metadata they reference. */
function persist(): void {
  const ls = lsAvailable();
  if (!ls || persistTimer) return;
  persistTimer = (setTimeout as typeof window.setTimeout)(() => {
    persistTimer = 0;
    try {
      const keys = Object.keys(pools).filter((k) => pools[k]?.length).slice(-STORE_KEYS_CAP);
      const out: Record<string, string[]> = {};
      const meta: [string, WcaScrambleMeta][] = [];
      const seen = new Set<string>();
      for (const k of keys) {
        const q = pools[k]!.slice(0, STORE_PER_KEY);
        out[k] = q;
        for (const s of q) { if (!seen.has(s)) { const m = metaByScramble.get(s); if (m) { meta.push([s, m]); seen.add(s); } } }
      }
      ls.setItem(STORE_KEY, JSON.stringify({ t: Date.now(), pools: out, meta }));
    } catch { /* quota / unavailable — ignore */ }
  }, 600);
}

/** Normalize stray non-ASCII punctuation (e.g. a Pyraminx scramble that used ’
 *  instead of ') so cubing.js / renderers accept the move string. */
function normalize(s: string): string {
  return s.replace(/[‘’ʼ′]/g, "'");
}

function wev(spec: WcaSourceSpec): string | undefined {
  return EVENT_MAP[spec.event];
}

/** Stable cache key for this source. null = no real scrambles possible (event
 *  unmapped, or comp mode with no competition picked yet). */
function specKey(spec: WcaSourceSpec): string | null {
  const w = wev(spec);
  if (!w) return null;
  // 该项目不支持最优等态(见 supportsOptimal)时忽略 spec.optimal —— 否则粘滞的 wcaUseOptimal=true
  // 残留到切换后的项目,会算出一个「最优池」key,而这个项目永远没有 optimal_scramble,查回空。
  const opt = spec.optimal && supportsOptimal(w) ? '|opt' : ''; // 原始/最优打乱用不同池,切换即重灌
  // 「按步数」过滤两种模式都生效,进 key(切换度量/区间即重灌)。
  const sf = spec.stepFilter ? `|S:${spec.stepFilter.metric}:${spec.stepFilter.lo}.${spec.stepFilter.hi}` : '';
  // 难度过滤 date + comp 两模式都生效;steps 非空才计入池 key(切换难度即重灌)。
  // merged 也进 key:同一组难度参数在合并/分开两种口径下是两个不同的池,不进 key 会切换后吃到旧池。
  const d = spec.diff && spec.diff.steps.length > 0
    ? `|D:${spec.diff.variant}:${spec.diff.stage}:${spec.diff.colors}:${[...spec.diff.steps].sort((a, b) => a - b).join('.')}${spec.diff.merged ? ':m' : ''}`
    : '';
  if (spec.mode === 'comp') return spec.comp ? `c|${spec.comp}|${w}|${spec.round}|${spec.group}${opt}${sf}${d}` : null;
  return `d|${w}|${spec.from}|${spec.to}${opt}${d}${sf}`;
}

function rememberMeta(s: string, m: WcaScrambleMeta): void {
  metaByScramble.set(s, m);
  while (metaByScramble.size > META_CAP) {
    const oldest = metaByScramble.keys().next().value;
    if (oldest === undefined) break;
    metaByScramble.delete(oldest);
  }
}

/** 「按步数」过滤:该条真题的度量步数是否落在 [lo,hi] 内。无 stepFilter 或无法度量(非 2×2/金字塔、
 *  记号超出 gauge)时放行(不误杀)。 */
function stepPass(spec: WcaSourceSpec, scramble: string): boolean {
  if (!spec.stepFilter) return true;
  const d = scrambleStepMetric(spec.event, spec.stepFilter.metric, scramble);
  if (d == null) return true;
  return d >= spec.stepFilter.lo && d <= spec.stepFilter.hi;
}

type CompRow = { scramble: string; meta: WcaScrambleMeta };

/** 比赛序比较器(初赛→决赛 → 组别 → 正式在前额外在后 → 把序号)。 */
function compOrder(a: WcaScrambleMeta, b: WcaScrambleMeta): number {
  const ra = ROUND_SEQ[a.r] ?? 9, rb = ROUND_SEQ[b.r] ?? 9;
  if (ra !== rb) return ra - rb;
  if (a.g !== b.g) return groupIdxOf(a.g) - groupIdxOf(b.g);
  if (a.x !== b.x) return a.x ? 1 : -1;
  return a.n - b.n;
}

/** comp 全量(默认):拉整场打乱 → 过滤 event/round/group(+ 可选最优)→ 竞赛序。 */
async function compRowsAll(spec: WcaSourceSpec, w: string, useOptimal: boolean): Promise<CompRow[]> {
  const all = await fetchWcaScrambles(spec.comp);
  return (all ?? [])
    .filter((r) => r.event_id === w
      && (!spec.round || r.round_type_id === spec.round)
      && (!spec.group || r.group_id === spec.group)
      // 最优模式:只留有最优等态的真题,不再静默回退原打乱(无则该比赛队列空 -> 回退随机生成)。
      && (!useOptimal || !!r.optimal_scramble))
    .map((r) => ({
      // 最优模式且该打乱有最优等态(同态项目)→ 用最优打乱,否则原打乱。
      scramble: normalize(useOptimal && r.optimal_scramble ? r.optimal_scramble : r.scramble),
      meta: { ci: spec.comp, cn: spec.compName || spec.comp, e: w, r: r.round_type_id, g: r.group_id, n: r.scramble_num, x: (r.is_extra ? 1 : 0) as 0 | 1 },
    }))
    .filter((it) => stepPass(spec, it.scramble)) // 「按步数」过滤(该比赛此步数无匹配 → rows 空 → 提示)
    .sort((A, B) => compOrder(A.meta, B.meta));
}

/** comp + 难度(3x3 族):by-difficulty 端点按 (方法,阶段,底色) 逐 bin 拉本场真题 → 过滤 round/group → 竞赛序。
 *  端点按精确官方名(names)+ event + bin 查;再用 ci===comp 收敛到本场(防撞名),用 o 支持最优模式。
 *  全部请求失败(网络)→ 抛出让 fill 不缓存、不判空,稍后重取;只要有一个成功即视作权威(可为空)。 */
async function compRowsByDifficulty(spec: WcaSourceSpec, w: string, useOptimal: boolean): Promise<CompRow[]> {
  const d = spec.diff!;
  const bins = [...new Set(d.steps)].sort((a, b) => a - b);
  // 合并口径下省略 event = 本场所有 3x3 族轮次的真题都算(与 /random 的 family=1 同义);
  // 分开则只要本项目的。
  const results = await Promise.all(bins.map((bin) => fetchByDifficulty({
    variant: d.variant, stage: d.stage, colors: d.colors, bin, event: d.merged ? undefined : w,
    names: spec.compName ? [spec.compName] : undefined, pageSize: 200,
  })));
  if (results.every((r) => r == null)) throw new Error('by-difficulty unavailable');
  const seen = new Set<string>();
  const out: CompRow[] = [];
  for (const res of results) {
    for (const row of res?.scrambles ?? []) {
      if (row.ci !== spec.comp) continue;                    // 精确到本场(names 可能撞号)
      if (spec.round && row.r !== spec.round) continue;
      if (spec.group && row.g !== spec.group) continue;
      if (useOptimal && !row.o) continue;                    // 最优模式:只留有最优等态的
      // 合并口径下同一 (轮次,组,序号) 在不同项目里各有一条,去重键必须带 event,否则会互相吞掉。
      const dk = `${row.e}|${row.r}|${row.g}|${row.x}|${row.n}`;
      if (seen.has(dk)) continue;
      seen.add(dk);
      out.push({
        scramble: normalize(useOptimal && row.o ? row.o : row.scramble),
        // e 取真实来源项目(合并时可能不是当前练习的项目),来源角标才不会张冠李戴。
        meta: { ci: spec.comp, cn: spec.compName || spec.comp, e: row.e || w, r: row.r, g: row.g, n: row.n, x: row.x },
      });
    }
  }
  return out.sort((A, B) => compOrder(A.meta, B.meta));
}

// comp 覆盖探测用 canonical std/cross/六色:难度库对一场比赛要么全有(所有 方法/阶段 同布局一起回填)、
// 要么全无,用最基础的 std/cross 即可判「这场是否入库」,不必逐 变体/阶段 探。键只按 (comp, event)。
const COV_VARIANT = 'std', COV_STAGE = 'cross', COV_COLORS = 'BGORWY';
function coverageKey(comp: string, w: string): string { return `${comp}|${w}`; }
const coverageInflight = new Map<string, Promise<boolean | null>>();

/** 该场此 event 在难度库(wca_scramble_steps)里有无任何步数数据。拉直方图全域 [min,max]、按本场官方名
 *  逐 bin 探(pageSize=1 只判有无),任一 bin 有真题即已入库。
 *  true=已入库 / false=未入库(离线难度管道还没算这场)/ null=判不了(直方图或全部请求不可用,不缓存)。 */
async function fetchCompCoverage(compName: string, w: string): Promise<boolean | null> {
  const dist = await loadDist();
  const h = dist?.sets?.wca?.variants?.[COV_VARIANT]?.data?.[COV_STAGE]?.[COV_COLORS];
  if (!h || !Number.isFinite(h.min) || !Number.isFinite(h.max) || h.max < h.min) return null;
  const bins: number[] = [];
  for (let b = h.min; b <= h.max; b++) bins.push(b);
  const results = await Promise.all(bins.map((bin) => fetchByDifficulty({
    variant: COV_VARIANT, stage: COV_STAGE, colors: COV_COLORS, bin, event: w,
    names: compName ? [compName] : undefined, pageSize: 1,
  })));
  if (results.every((r) => r == null)) return null;      // 全失败 → 判不了,稍后重试
  return results.some((r) => (r?.total ?? 0) > 0);        // 官方名唯一,total>0 即本场有数据
}

/** 主动探测并缓存 comp 覆盖(inflight 去重,已缓存直接返回)。UI 在选中比赛时提前调,好在难度开关上分诊。 */
export async function probeCompCoverage(comp: string, compName: string, wcaEvent: string): Promise<boolean | null> {
  if (!comp || !wcaEvent) return null;
  const ck = coverageKey(comp, wcaEvent);
  if (compCoverage.has(ck)) return compCoverage.get(ck)!;
  let p = coverageInflight.get(ck);
  if (!p) {
    p = fetchCompCoverage(compName, wcaEvent)
      .then((r) => { if (r !== null) compCoverage.set(ck, r); return r; })
      .catch(() => null)
      .finally(() => { coverageInflight.delete(ck); });
    coverageInflight.set(ck, p);
  }
  return p;
}

/** 同步读已探测的 comp 覆盖:true=已入库 / false=未入库 / null=未知(尚未探测 / 判不了)。 */
export function getCompCoverage(comp: string, wcaEvent: string): boolean | null {
  const v = compCoverage.get(coverageKey(comp, wcaEvent));
  return v === undefined ? null : v;
}

/** comp mode: load the comp once (cached), filter to event + round + group (+ 可选难度),
 *  sort in competition order, and (re)fill the queue — loops indefinitely. */
async function fillComp(spec: WcaSourceSpec, key: string): Promise<void> {
  const w = wev(spec);
  if (!w) return;
  const useOptimal = spec.optimal && supportsOptimal(w);
  let rows = compRows[key];
  if (!rows) {
    rows = spec.diff && spec.diff.steps.length > 0
      ? await compRowsByDifficulty(spec, w, useOptimal)
      : await compRowsAll(spec, w, useOptimal);
    compRows[key] = rows;
  }
  if (rows.length === 0) {
    // comp + 难度为空:探测该场在难度库有无任何步数数据,区分「已入库但此难度无匹配」vs「新赛未入库」。
    // 覆盖按 (comp, event) 缓存(与步数/方法档无关),与 UI 的主动探测共用结论,只做一次。
    if (spec.diff && spec.diff.steps.length > 0) await probeCompCoverage(spec.comp, spec.compName, w);
    knownEmpty.add(key); return; // 该比赛没有此 event / 该难度无匹配 → 显式提示,不伪造生成
  }
  knownEmpty.delete(key);
  const q = (pools[key] ??= []);
  for (const it of rows) { q.push(it.scramble); rememberMeta(it.scramble, it.meta); }
  persist();
}

/** 「按步数」:从 puzzle_examples.json 的 metrics.<度量>.bins 收集 [lo,hi] 内真题,登记来源元数据,
 *  存进 precomputedFor[key]。返回收集到的条数(0 = 该度量/区间无预计算,回退 live 采样)。 */
async function seedPrecomputed(spec: WcaSourceSpec, key: string): Promise<number> {
  const sf = spec.stepFilter;
  if (!sf) return 0;
  const exKey = EXAMPLES_KEY[spec.event];
  if (!exKey) return 0;
  const j = await loadExamples();
  const entry = j?.puzzles?.[exKey];
  const bins = entry?.metrics?.[sf.metric]?.bins;
  if (!entry || !bins) return 0;
  // 最优模式与 live 语义一致:只端有最优等态的示例(最优打乱同态,度量值不变),不静默回退原打乱。
  const useOptimal = !!spec.optimal && supportsOptimal(wev(spec)!);
  const list: string[] = [];
  for (let v = sf.lo; v <= sf.hi; v++) {
    const samples = bins[String(v)];
    if (!samples) continue;
    for (const smp of samples) {
      const raw = useOptimal ? smp[2] : smp[1];
      if (!raw) continue;
      const s = normalize(raw);
      list.push(s);
      const m = entry.idMeta[smp[0]];
      if (m) rememberMeta(s, { ci: m[0], cn: entry.comps[m[0]]?.[0] ?? m[0], e: m[1], r: m[3], g: m[4], n: m[2], x: m[5] as 0 | 1 });
    }
  }
  precomputedFor.set(key, list);
  return list.length;
}

/** Fisher–Yates 洗牌拷贝(每次 refill 换序端出,避免固定顺序)。 */
function shuffledCopy(src: string[]): string[] {
  const a = src.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** 有限真题集(预计算桶 / 封闭集)洗牌灌回队列,循环用不会耗尽。优先端还没在队列里的,
 *  桶太小(如仅 2 条)全在队列时只能整桶循环,再防「洗牌头 == 队尾」的背靠背重复。 */
function refillFrom(q: string[], src: string[]): void {
  const inQ = new Set(q);
  let arr = shuffledCopy(src).filter((s) => !inQ.has(s));
  if (arr.length === 0) arr = shuffledCopy(src);
  if (q.length > 0 && arr.length > 1 && arr[0] === q[q.length - 1]) arr.push(arr.shift()!);
  for (const s of arr) q.push(s);
}

/** date mode: top up from the server's random sampler (optionally date-bounded). */
async function fillDate(spec: WcaSourceSpec, key: string): Promise<void> {
  const w = wev(spec);
  if (!w) return;
  const useOptimal = spec.optimal && supportsOptimal(w);
  const buildQs = () => {
    const qs = new URLSearchParams({ event: w, count: String(FETCH_COUNT) });
    if (spec.from) qs.set('from', spec.from);
    if (spec.to) qs.set('to', spec.to);
    if (useOptimal) qs.set('optimal', '1'); // 服务端只回有最优等态的真题,池内每条都可切最优
    // 难度过滤(date 模式):只回该 (方法,阶段,配色) 最优步数 ∈ steps 的真题。
    if (spec.diff && spec.diff.steps.length > 0) {
      qs.set('variant', spec.diff.variant);
      qs.set('stage', spec.diff.stage);
      qs.set('colors', spec.diff.colors);
      qs.set('steps', [...spec.diff.steps].sort((a, b) => a - b).join(','));
      if (spec.diff.merged) qs.set('family', '1'); // 跨 3x3 族取题(非 3x3 族服务端忽略)
    }
    return qs;
  };
  const q = (pools[key] ??= []);
  // 封闭集已确认(该 spec 的真题就这几条)→ 本地洗牌灌回,零网络。稀有难度档常态走这条。
  const closed = closedFor.get(key);
  if (closed && closed.length > 0) { refillFrom(q, closed); knownEmpty.delete(key); persist(); return; }
  // 「按步数」:先用预计算真题桶播种(稀有区间即时+可靠,如 2×2 底层=0),再 live 补充变化。
  let hasPrecomputed = false;
  // 预计算真题桶是全时段的,只在无日期范围时播种(有 from/to 时 live 采样才尊重日期过滤)。
  if (spec.stepFilter && !spec.from && !spec.to) {
    if (!precomputedSeeded.has(key)) {
      await seedPrecomputed(spec, key);
      if (examplesCache) precomputedSeeded.add(key); // examples 读到了才不再重试;fetch 失败留待下次
    }
    const pre = precomputedFor.get(key);
    if (pre && pre.length) {
      hasPrecomputed = true;
      // 只在队列见底时才把预计算桶洗牌灌回(循环用,不会耗尽):常见区间靠 live 批次保持变化,
      // 每次 refill 全量重灌会造成队内重复 + 出题被固定采样集垄断。灌回时跳过仍在队列里的,
      // 桶太小(如仅 3 条)全在队列 → 只能整桶循环,再防洗牌头 == 队尾的背靠背重复。
      if (q.length <= 2) refillFrom(q, pre);
      knownEmpty.delete(key);
    }
  }
  // live 采样:无 stepFilter → 1 批(原行为);有 stepFilter 且无预计算 → MAX_FILTER_BATCHES 批找稀有匹配,
  // 全空才判 knownEmpty;有预计算 → 只补 3 批变化(常见区间一批即中并短路,稀有区间靠预计算不硬搜),永不判空。
  const maxBatches = spec.stepFilter ? (hasPrecomputed ? 3 : MAX_FILTER_BATCHES) : 1;
  // 封闭集只在「全时段 + 无 stepFilter」时可判(见 closedFor):有 from/to 走 comp-sampling(抽 30 场,
  // 回得少不代表穷尽);stepFilter 有自己的预计算桶 + 多批采样路径,回条数与匹配数不对应。
  const canClose = !spec.stepFilter && !spec.from && !spec.to;
  let totalAdded = 0;
  for (let batch = 0; batch < maxBatches; batch++) {
    const res = await fetch(apiUrl(`/v1/wca/scrambles/random?${buildQs().toString()}`));
    // 难度无匹配时端点回 404 → 确认空(非瞬时错误),让 UI 显式提示。有预计算则不判空。
    if (res.status === 404) { if (!hasPrecomputed) knownEmpty.add(key); return; }
    if (!res.ok) return; // 其它失败(5xx / 网络)= 瞬时,不标空,稍后重取
    const data = (await res.json()) as { scrambles?: RandomItem[] };
    const items = Array.isArray(data.scrambles) ? data.scrambles : [];
    if (items.length === 0) { if (!hasPrecomputed) knownEmpty.add(key); return; }
    let added = 0;
    const got: string[] = [];
    for (const it of items) {
      if (!it?.scramble) continue;
      // 最优模式且该条带最优等态 → 用最优打乱(同态,更短);否则用原打乱(服务器在稀有难度档无最优时回退)。
      const useOpt = useOptimal && !!it.o;
      const s = normalize(useOpt ? it.o! : it.scramble);
      if (!stepPass(spec, s)) continue; // 「按步数」客户端过滤(服务端不懂 2×2/金字塔度量)
      q.push(s);
      got.push(s);
      added++;
      rememberMeta(s, {
        ci: it.ci, cn: it.cn, e: it.e, r: it.r, g: it.g, n: it.n, x: it.x,
        ...(useOptimal && !useOpt ? { nonOptimal: true } : {}),
      });
    }
    // 要 FETCH_COUNT 条却回得更少 = 服务端已扫完全集 → 这批就是匹配全集,登记后不再联网。
    // 常见档恒回满 FETCH_COUNT,永远不会进这里;只有稀有档(全库个位数)才封闭。
    if (canClose && items.length < FETCH_COUNT && got.length > 0) closedFor.set(key, [...new Set(got)]);
    totalAdded += added;
    if (added > 0) break; // 已找到匹配,不再多抓(短路,常态一批即够)
  }
  // 连抓 maxBatches 批仍一条不落且无预计算(仅 stepFilter 会到此)→ 该步数区间在真题里没有 → 确认空。
  if (spec.stepFilter && !hasPrecomputed && totalAdded === 0) { knownEmpty.add(key); return; }
  knownEmpty.delete(key);
  persist();
}

function fill(spec: WcaSourceSpec): Promise<void> {
  const key = specKey(spec);
  if (!key) return Promise.resolve();
  // 已确认无匹配(404 / 空 / 按步数区间在真题里不存在)就别再抓 —— 否则每次 peek(池空恒 < REFILL_AT)
  // 都会再打一轮网络。改设置/度量/区间会得到新 key,自然不在此集合、重新尝试。
  if (knownEmpty.has(key)) return Promise.resolve();
  const existing = inflight[key];
  if (existing) return existing;
  const p = (async () => {
    try {
      if (spec.mode === 'comp') await fillComp(spec, key);
      else await fillDate(spec, key);
    } catch {
      /* network error — caller falls back to a generated scramble */
    } finally {
      inflight[key] = undefined;
    }
  })();
  inflight[key] = p;
  return p;
}

/** Whether this source can yield real scrambles (event mapped + comp picked in
 *  comp mode). Whether the picked comp actually has the event is resolved async;
 *  an empty result falls back to a generated scramble. */
export function hasWcaSource(spec: WcaSourceSpec): boolean {
  return specKey(spec) !== null;
}

/** Whether this source was *confirmed* to have zero real scrambles — a difficulty
 *  combo with no matches (endpoint 404) or a comp lacking the event. Distinct from
 *  "still loading / transient failure" (those don't set this). Only meaningful after
 *  at least one fill attempt; lets the UI show a clear notice instead of silently
 *  substituting a locally generated scramble (which has no comp source and won't
 *  match the requested difficulty). */
export function isWcaSourceEmpty(spec: WcaSourceSpec): boolean {
  const key = specKey(spec);
  return key !== null && knownEmpty.has(key);
}

/** comp + 难度为空时,该场是否「压根没进难度库」(离线管道还没算,常见于新赛)——用于把提示
 *  从「换步数/配色」升级为「改用日期模式/等回填」。仅在 fillComp 探测确认 false(无数据)后为真;
 *  已入库(空只是此难度档无匹配)或尚未探测 → false(走默认「换步数/配色」提示)。 */
export function isWcaCompUnindexed(spec: WcaSourceSpec): boolean {
  const w = wev(spec);
  if (!w || spec.mode !== 'comp' || !spec.comp) return false;
  return compCoverage.get(coverageKey(spec.comp, w)) === false;
}

/** Warm the pool ahead of time (on spec change / when WCA mode turns on). */
export function prefetchWca(spec: WcaSourceSpec): void {
  hydrate();
  const key = specKey(spec);
  if (!key) return;
  if ((pools[key]?.length ?? 0) < REFILL_AT) void fill(spec);
}

/** Synchronous take — returns a scramble if the queue has one (and tops it up in
 *  the background), else null so the caller can show loading and await nextWca. */
export function peekWca(spec: WcaSourceSpec): string | null {
  hydrate();
  const key = specKey(spec);
  if (!key) return null;
  const s = pools[key]?.shift() ?? null;
  if (s) { noteServed(key, s); persist(); } // 反映已消费,避免重开时端出同一条
  if ((pools[key]?.length ?? 0) < REFILL_AT) void fill(spec);
  return s;
}

/** Async take — ensures the queue is filled, then returns one. null if the source
 *  has no real scrambles (e.g. picked comp lacks the event) or the fetch failed. */
export async function nextWca(spec: WcaSourceSpec): Promise<string | null> {
  hydrate();
  const key = specKey(spec);
  if (!key) return null;
  if ((pools[key]?.length ?? 0) === 0) await fill(spec);
  const s = pools[key]?.shift() ?? null;
  if (s) { noteServed(key, s); persist(); }
  return s;
}

/** Source metadata for a scramble previously dispensed by this pool, else null
 *  (locally generated scramble, or one evicted from the capped meta map). */
export function wcaMetaFor(scramble: string): WcaScrambleMeta | null {
  hydrate();
  return metaByScramble.get(normalize(scramble)) ?? null;
}

/** timer EventId → WCA scrambles event_id (undefined if this event has no real
 *  competition scrambles). Exposed for the source-config UI (round/group derivation). */
export function wcaEventId(event: EventId): string | undefined {
  return EVENT_MAP[event];
}
