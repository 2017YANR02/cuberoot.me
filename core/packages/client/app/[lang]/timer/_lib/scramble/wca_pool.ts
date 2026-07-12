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
import { fetchWcaScrambles } from '@/lib/wca-results-api';
import { groupIdxOf } from '@/lib/wca-scramble-group';
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

const FETCH_COUNT = 50;
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
  // 按难度过滤:只在 date 模式生效(随机采样端点支持);comp 模式按比赛原序,忽略。
  // steps 为空 = 不过滤。variant/stage/colors 同 /scramble/stats 的口径。
  diff?: { variant: string; stage: string; colors: string; steps: number[] };
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
// 「按步数」date 模式客户端过滤:一次 fillDate 内最多连抓这么多批(每批 FETCH_COUNT 条)找匹配,
// 命中即停(常见区间一批即够,秒出);全空才判 knownEmpty。放在同一次 fill 内连抓(而非拆成
// SoloView 的退避重试)避免累计几秒才提示。批数上限要够大以覆盖稀有但真实存在的区间:实测 2000 条
// 真题里 2×2 底层=0 占 ~1/400、底层=1 占 ~1/180,4 批(200 条)会 ~60% 概率漏掉 → 误报「无匹配」;
// 30 批(1500 条)对 1/400 有 ~98% 命中率。命中即停,所以常见区间仍是一批秒出、稀有区间平均抓 ~8 批
// 即出;只有真正空的区间(如底层=7、htm≤3)才抓满 30 批才提示「无匹配」(~3s,之后 knownEmpty 缓存)。
const MAX_FILTER_BATCHES = 30;

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
  if (spec.mode === 'comp') return spec.comp ? `c|${spec.comp}|${w}|${spec.round}|${spec.group}${opt}${sf}` : null;
  // 难度过滤只在 date 模式生效;steps 非空才计入池 key(切换难度即重灌)。
  const d = spec.diff && spec.diff.steps.length > 0
    ? `|D:${spec.diff.variant}:${spec.diff.stage}:${spec.diff.colors}:${[...spec.diff.steps].sort((a, b) => a - b).join('.')}`
    : '';
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

/** comp mode: load the comp once (cached), filter to event + round + group,
 *  sort in competition order, and (re)fill the queue — loops indefinitely. */
async function fillComp(spec: WcaSourceSpec, key: string): Promise<void> {
  const w = wev(spec);
  if (!w) return;
  const useOptimal = spec.optimal && supportsOptimal(w);
  let rows = compRows[key];
  if (!rows) {
    const all = await fetchWcaScrambles(spec.comp);
    rows = (all ?? [])
      .filter((r) => r.event_id === w
        && (!spec.round || r.round_type_id === spec.round)
        && (!spec.group || r.group_id === spec.group)
        // 最优模式:只留有最优等态的真题,不再静默回退原打乱(无则该比赛队列空 -> 回退随机生成)。
        && (!useOptimal || !!r.optimal_scramble))
      .sort((a, b) => {
        const ra = ROUND_SEQ[a.round_type_id] ?? 9, rb = ROUND_SEQ[b.round_type_id] ?? 9;
        if (ra !== rb) return ra - rb;
        if (a.group_id !== b.group_id) return groupIdxOf(a.group_id) - groupIdxOf(b.group_id);
        if (a.is_extra !== b.is_extra) return a.is_extra ? 1 : -1;
        return a.scramble_num - b.scramble_num;
      })
      .map((r) => ({
        // 最优模式且该打乱有最优等态(同态项目)→ 用最优打乱,否则原打乱。
        scramble: normalize(useOptimal && r.optimal_scramble ? r.optimal_scramble : r.scramble),
        meta: { ci: spec.comp, cn: spec.compName || spec.comp, e: w, r: r.round_type_id, g: r.group_id, n: r.scramble_num, x: (r.is_extra ? 1 : 0) as 0 | 1 },
      }))
      .filter((it) => stepPass(spec, it.scramble)); // 「按步数」过滤(该比赛此步数无匹配 → rows 空 → 提示)
    compRows[key] = rows;
  }
  if (rows.length === 0) { knownEmpty.add(key); return; } // 该比赛没有此 event → 显式提示,不伪造生成
  knownEmpty.delete(key);
  const q = (pools[key] ??= []);
  for (const it of rows) { q.push(it.scramble); rememberMeta(it.scramble, it.meta); }
  persist();
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
    }
    return qs;
  };
  const q = (pools[key] ??= []);
  // 「按步数」客户端过滤时真题近上帝数、低步数区间可能整批被滤掉。同一次 fill 内连抓最多
  // MAX_FILTER_BATCHES 批找匹配,命中即停;全空才判 knownEmpty —— 避免几秒退避后才提示无匹配。
  // 无 stepFilter 时只抓一批(原行为)。
  const maxBatches = spec.stepFilter ? MAX_FILTER_BATCHES : 1;
  let totalAdded = 0;
  for (let batch = 0; batch < maxBatches; batch++) {
    const res = await fetch(apiUrl(`/v1/wca/scrambles/random?${buildQs().toString()}`));
    // 难度无匹配时端点回 404 → 确认空(非瞬时错误),让 UI 显式提示。
    if (res.status === 404) { knownEmpty.add(key); return; }
    if (!res.ok) return; // 其它失败(5xx / 网络)= 瞬时,不标空,稍后重取
    const data = (await res.json()) as { scrambles?: RandomItem[] };
    const items = Array.isArray(data.scrambles) ? data.scrambles : [];
    if (items.length === 0) { knownEmpty.add(key); return; }
    let added = 0;
    for (const it of items) {
      if (!it?.scramble) continue;
      // 最优模式且该条带最优等态 → 用最优打乱(同态,更短);否则用原打乱(服务器在稀有难度档无最优时回退)。
      const useOpt = useOptimal && !!it.o;
      const s = normalize(useOpt ? it.o! : it.scramble);
      if (!stepPass(spec, s)) continue; // 「按步数」客户端过滤(服务端不懂 2×2/金字塔度量)
      q.push(s);
      added++;
      rememberMeta(s, {
        ci: it.ci, cn: it.cn, e: it.e, r: it.r, g: it.g, n: it.n, x: it.x,
        ...(useOptimal && !useOpt ? { nonOptimal: true } : {}),
      });
    }
    totalAdded += added;
    if (added > 0) break; // 已找到匹配,不再多抓(短路,常态一批即够)
  }
  // 连抓 maxBatches 批仍一条不落(仅 stepFilter 会到此)→ 该步数区间在真题里没有 → 确认空。
  if (spec.stepFilter && totalAdded === 0) { knownEmpty.add(key); return; }
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
  if (s) persist(); // 反映已消费,避免重开时端出同一条
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
  if (s) persist();
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
