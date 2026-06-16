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
}

/** 一条真实打乱的来源元数据(键名对齐首页 RecentScrambles 的 ScrMeta)。 */
export interface WcaScrambleMeta {
  ci: string; cn: string; e: string; r: string; g: string; n: number; x: 0 | 1;
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
  const opt = spec.optimal ? '|opt' : ''; // 原始/最优打乱用不同池,切换即重灌
  if (spec.mode === 'comp') return spec.comp ? `c|${spec.comp}|${w}|${spec.round}|${spec.group}${opt}` : null;
  // 难度过滤只在 date 模式生效;steps 非空才计入池 key(切换难度即重灌)。
  const d = spec.diff && spec.diff.steps.length > 0
    ? `|D:${spec.diff.variant}:${spec.diff.stage}:${spec.diff.colors}:${[...spec.diff.steps].sort((a, b) => a - b).join('.')}`
    : '';
  return `d|${w}|${spec.from}|${spec.to}${opt}${d}`;
}

function rememberMeta(s: string, m: WcaScrambleMeta): void {
  metaByScramble.set(s, m);
  while (metaByScramble.size > META_CAP) {
    const oldest = metaByScramble.keys().next().value;
    if (oldest === undefined) break;
    metaByScramble.delete(oldest);
  }
}

/** comp mode: load the comp once (cached), filter to event + round + group,
 *  sort in competition order, and (re)fill the queue — loops indefinitely. */
async function fillComp(spec: WcaSourceSpec, key: string): Promise<void> {
  const w = wev(spec);
  if (!w) return;
  let rows = compRows[key];
  if (!rows) {
    const all = await fetchWcaScrambles(spec.comp);
    rows = (all ?? [])
      .filter((r) => r.event_id === w
        && (!spec.round || r.round_type_id === spec.round)
        && (!spec.group || r.group_id === spec.group)
        // 最优模式:只留有最优等态的真题,不再静默回退原打乱(无则该比赛队列空 -> 回退随机生成)。
        && (!spec.optimal || !!r.optimal_scramble))
      .sort((a, b) => {
        const ra = ROUND_SEQ[a.round_type_id] ?? 9, rb = ROUND_SEQ[b.round_type_id] ?? 9;
        if (ra !== rb) return ra - rb;
        if (a.group_id !== b.group_id) return a.group_id < b.group_id ? -1 : 1;
        if (a.is_extra !== b.is_extra) return a.is_extra ? 1 : -1;
        return a.scramble_num - b.scramble_num;
      })
      .map((r) => ({
        // 最优模式且该打乱有最优等态(同态项目)→ 用最优打乱,否则原打乱。
        scramble: normalize(spec.optimal && r.optimal_scramble ? r.optimal_scramble : r.scramble),
        meta: { ci: spec.comp, cn: spec.compName || spec.comp, e: w, r: r.round_type_id, g: r.group_id, n: r.scramble_num, x: (r.is_extra ? 1 : 0) as 0 | 1 },
      }));
    compRows[key] = rows;
  }
  if (rows.length === 0) { knownEmpty.add(key); return; } // 该比赛没有此 event → 显式提示,不伪造生成
  knownEmpty.delete(key);
  const q = (pools[key] ??= []);
  for (const it of rows) { q.push(it.scramble); rememberMeta(it.scramble, it.meta); }
}

/** date mode: top up from the server's random sampler (optionally date-bounded). */
async function fillDate(spec: WcaSourceSpec, key: string): Promise<void> {
  const w = wev(spec);
  if (!w) return;
  const qs = new URLSearchParams({ event: w, count: String(FETCH_COUNT) });
  if (spec.from) qs.set('from', spec.from);
  if (spec.to) qs.set('to', spec.to);
  if (spec.optimal) qs.set('optimal', '1'); // 服务端只回有最优等态的真题,池内每条都可切最优
  // 难度过滤(date 模式):只回该 (方法,阶段,配色) 最优步数 ∈ steps 的真题。
  if (spec.diff && spec.diff.steps.length > 0) {
    qs.set('variant', spec.diff.variant);
    qs.set('stage', spec.diff.stage);
    qs.set('colors', spec.diff.colors);
    qs.set('steps', [...spec.diff.steps].sort((a, b) => a - b).join(','));
  }
  const res = await fetch(apiUrl(`/v1/wca/scrambles/random?${qs.toString()}`));
  // 难度无匹配时端点回 404 → 确认空(非瞬时错误),让 UI 显式提示。
  if (res.status === 404) { knownEmpty.add(key); return; }
  if (!res.ok) return; // 其它失败(5xx / 网络)= 瞬时,不标空,稍后重取
  const data = (await res.json()) as { scrambles?: RandomItem[] };
  const items = Array.isArray(data.scrambles) ? data.scrambles : [];
  if (items.length === 0) { knownEmpty.add(key); return; }
  knownEmpty.delete(key);
  const q = (pools[key] ??= []);
  for (const it of items) {
    if (!it?.scramble) continue;
    // 最优模式且该条带最优等态 → 用最优打乱(同态,更短),否则原打乱。
    const s = normalize(spec.optimal && it.o ? it.o : it.scramble);
    q.push(s);
    rememberMeta(s, { ci: it.ci, cn: it.cn, e: it.e, r: it.r, g: it.g, n: it.n, x: it.x });
  }
}

function fill(spec: WcaSourceSpec): Promise<void> {
  const key = specKey(spec);
  if (!key) return Promise.resolve();
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
  const key = specKey(spec);
  if (!key) return;
  if ((pools[key]?.length ?? 0) < REFILL_AT) void fill(spec);
}

/** Synchronous take — returns a scramble if the queue has one (and tops it up in
 *  the background), else null so the caller can show loading and await nextWca. */
export function peekWca(spec: WcaSourceSpec): string | null {
  const key = specKey(spec);
  if (!key) return null;
  const s = pools[key]?.shift() ?? null;
  if ((pools[key]?.length ?? 0) < REFILL_AT) void fill(spec);
  return s;
}

/** Async take — ensures the queue is filled, then returns one. null if the source
 *  has no real scrambles (e.g. picked comp lacks the event) or the fetch failed. */
export async function nextWca(spec: WcaSourceSpec): Promise<string | null> {
  const key = specKey(spec);
  if (!key) return null;
  if ((pools[key]?.length ?? 0) === 0) await fill(spec);
  return pools[key]?.shift() ?? null;
}

/** Source metadata for a scramble previously dispensed by this pool, else null
 *  (locally generated scramble, or one evicted from the capped meta map). */
export function wcaMetaFor(scramble: string): WcaScrambleMeta | null {
  return metaByScramble.get(normalize(scramble)) ?? null;
}

/** timer EventId → WCA scrambles event_id (undefined if this event has no real
 *  competition scrambles). Exposed for the source-config UI (round/group derivation). */
export function wcaEventId(event: EventId): string | undefined {
  return EVENT_MAP[event];
}
