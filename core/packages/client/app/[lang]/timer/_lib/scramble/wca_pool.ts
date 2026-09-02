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
 * momentarily empty. Each dispensed occurrence carries its source metadata and
 * official slot identity (ci/e/r/g/x/n); text-only wcaMetaFor() remains a
 * backwards-compatible lookup for consumers that do not retain the row.
 */
import { apiUrl } from '@/lib/api-base';
import { fetchWcaScrambles } from '@/lib/wca-results-api';
import { webTimerWcaDifficultyAdapter } from '@/lib/timer-wca-difficulty-adapter';
import { fetchPuzzleExamples, type PuzzleExampleSample, type PuzzleExamplesJson } from '@/lib/puzzle-examples';
import { cube222StateTypeMatchesScramble, type Cube222StateType } from '@cuberoot/puzzle-solvers/cube222';
import {
  compareTimerWcaCompetitionScrambleOrder,
  decodeTimerWcaCompetitionScrambleSlot,
  TimerWcaFinitePoolProgressTracker,
  timerWcaCompetitionScrambleSlotIdentity,
  normalizeTimerWcaSourceSettings,
  timerWcaOptimalRequested,
  timerWcaRandomRequestQuery,
  timerWcaScrambleEventId,
  timerWcaSourceIdentity,
  type TimerWcaSourceSettings,
} from '@cuberoot/shared/timer';
import { scrambleStepMetric } from './gen-by-steps';
import { filterWebNon222BySteps } from './non222-steps-pool';
import type { TimerNon222StepPuzzle } from '@cuberoot/shared/timer';
import type { EventId } from '../types';

// WCA event_ids (mapped values above) with a God's-number optimal-equivalent scramble available
// (see wca_scramble_optimal in the DB, computed by an exact solver for these homogeneous events
// only). Single source of truth — both the "最优打乱" toggle's visibility (WcaSourceConfig) and
// the pool's actual filtering here must agree, or a stale wcaUseOptimal=true left over from
// switching away from one of these events would silently filter out every real scramble of an
// event that has no optimal data (e.g. clock) — filtering here is what actually matters; the UI
// toggle is just a convenience that mirrors this set.
function sourceSettings(spec: WcaSourceSpec): TimerWcaSourceSettings {
  return normalizeTimerWcaSourceSettings({
    wcaScrambleMode: spec.mode,
    wcaComp: spec.comp,
    wcaCompName: spec.compName,
    wcaCompCountry: '',
    wcaRound: spec.round,
    wcaGroup: spec.group,
    wcaDateFrom: spec.from,
    wcaDateTo: spec.to,
    wcaUseOptimal: spec.optimal,
    wcaDifficultyOn: !!spec.diff?.steps.length,
    wcaDiffVariant: spec.diff?.variant,
    wcaDiffStage: spec.diff?.stage,
    wcaDiffColors: spec.diff?.colors,
    wcaDiffSteps: spec.diff?.steps,
    wcaDiffMerged: spec.diff?.merged,
  });
}

const wantOptimal = (spec: WcaSourceSpec, wcaEventId: string): boolean => (
  timerWcaOptimalRequested(wcaEventId, sourceSettings(spec))
);

// 一次向 /random 要几条。服务端把 count 钳在 SERVER_MAX_COUNT 内,本值必须 <= 它,
// 否则「回得比要的少」不再等价于「已穷尽」,封闭集判定(见 closedFor)会误判。
const SERVER_MAX_COUNT = 50; // 与 server routes/wca_scrambles.ts 的 Math.min(50, ...) 对齐
const FETCH_COUNT = Math.min(50, SERVER_MAX_COUNT);
const REFILL_AT = 8;
const META_CAP = 1000; // 元数据 Map 软上限,超出按插入序丢最旧。

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
  // 「按步数」过滤(2×2 / 金字塔 / 斜转):客户端算每条真题的度量步数,只留 [lo,hi] 内的。
  // date + comp 两种模式都生效。date 随机采样未命中只是 transient,不能推导全集为空。
  stepFilter?: { metric: string; lo: number; hi: number };
  // 二阶专项状态过滤。只接受能从最终状态精确判定的类型；3-gen 不属于这个集合。
  typeFilter?: Cube222StateType;
}

/** 一条真实打乱的来源元数据(键名对齐首页 RecentScrambles 的 ScrMeta)。 */
export interface WcaScrambleMeta {
  ci: string; cn: string; e: string; r: string; g: string; n: number; x: 0 | 1;
  // 开了「最优打乱」却拿到原打乱(该难度档无最优等态,服务器回退)→ UI 标「非最优」。
  nonOptimal?: boolean;
}
/** One dispensed occurrence. Keep this object in UI history: scramble text is
 * not an occurrence identity because separate official slots may be equal. */
export interface WcaDispensedScramble {
  readonly scramble: string;
  readonly slot: string | null;
  readonly meta: WcaScrambleMeta | null;
}
interface RandomItem extends WcaScrambleMeta { scramble: string; o?: string } // o = 最优打乱(server 带,见 wca_scramble_optimal)
type CompRow = { slot: string; scramble: string; meta: WcaScrambleMeta };

// Date queues also retain official occurrence identity. Scramble text is not a
// key: two distinct official slots are allowed to contain the same moves.
const pools: Record<string, CompRow[]> = {};
const inflight: Record<string, Promise<void> | undefined> = {};
const metaByScramble = new Map<string, WcaScrambleMeta>();
const metaBySlot = new Map<string, WcaScrambleMeta>();
// comp 模式:过滤 + 排序后的整场打乱(按 specKey 缓存,refill 时循环灌回队列)。
const compRows: Record<string, CompRow[]> = {};
// comp 队列不能只存字符串:不同官方 slot 可能有完全相同的打乱文本。队列携带 slot + meta,
// 只有真正端出一条时才把它登记给 wcaMetaFor,避免后面的同文本 slot 提前覆盖当前出处。
const compQueues: Record<string, CompRow[]> = {};
// 最后一次排入 comp 队列的官方 slot。持久化只保留队首 50 条；重启后以缓存窗口末尾为锚点,
// 重新拉整场时先续上未缓存的尾部,而不是从第一题重复。
const compAppendAfter: Record<string, string | undefined> = {};
// 已确认「确实没有真题」的来源 key:难度组合无匹配(端点 404)/ 选定比赛缺此项目。
// 用于让 UI 显式提示,而不是悄悄伪造一条本地生成打乱(无比赛来源、且不符所选难度)。
// 与「瞬时空(还在加载 / 网络失败)」区分:后者不进此集合,稍后重取。
const knownEmpty = new Set<string>();
// comp + 难度:某场比赛此(方法/阶段/配色)在难度库(wca_scramble_steps)是否有任何步数数据。
// true=已入库(空只是此难度档无匹配)/ false=未入库(离线管道还没算这场,常见于新赛)。
// 让 UI 区分「换步数/配色」与「改用日期模式/等回填」两种提示(见 compHasAnyStepData)。undetermined 不入。
// 「按步数」date 模式客户端过滤:一次 fillDate 内最多连抓这么多批(每批 FETCH_COUNT 条)找匹配,
// 命中即停(常见区间一批即够,秒出);全部未命中仍只是有界采样 miss,不能判 knownEmpty。放在同一次 fill 内连抓(而非拆成
// SoloView 的退避重试)避免累计几秒才提示。批数上限要够大以覆盖稀有但真实存在的区间:实测 2000 条
// 真题里 2×2 底层=0 占 ~1/400、底层=1 占 ~1/180,4 批(200 条)会 ~60% 概率漏掉 → 误报「无匹配」;
// 30 批(1500 条)对 1/400 有 ~98% 命中率。命中即停,所以常见区间仍是一批秒出、稀有区间平均抓 ~8 批
// 即出;抓满 30 批后保持 transient,下一次可继续采样。只有端点 404 或 comp 有限全集过滤为空才确认无题。
const MAX_FILTER_BATCHES = 30;

// 「按步数」预计算真题桶:stats/scramble/puzzle_examples.json 的 metrics.<度量>.bins 存了每个步数值的
// 真实比赛打乱(稀有值全量,≤300)。稀有区间(如 2×2 底层=0)live 采样难命中,直接播种这些预计算真题
// → 即时+可靠;常见区间再用 live 补充变化。timer event → puzzle_examples.json 的 puzzle key。
const EXAMPLES_KEY: Record<string, string> = { '222': '222', pyra: 'pyraminx', skewb: 'skewb' };
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

const precomputedSeeded = new Set<string>();       // 已建过预计算桶的 key(每 key 只 seed 一次)
const precomputedFor = new Map<string, CompRow[]>(); // key -> 区间内预计算官方题(refill 洗牌灌回池)

// 封闭集:该 key 的匹配全集(已确认穷尽)。稀有难度档(如 0 步十字 / 8 步双色十字)全库仅 2-4 条,
// 而 /random 每次都要全分区扫才捞得到它们(生产实测 1.4-2.6s)—— 队列一见底就联网、又只补回同样
// 那几条,于是每两三次出题就卡一次转圈。服务端在「全时段(无 from/to)」两条路径都是扫完全集再
// LIMIT(飞镖正向 rnd>=dart + 环绕 rnd<dart;稀有侧表 ORDER BY random()),所以「要 FETCH_COUNT
// 条却回得更少」严格等价于「匹配全集就这么多」。据此把全集存下,之后本地洗牌循环,永不再联网。
// 有 from/to 时不成立(那条路是 comp-sampling,只抽 30 场,回得少 ≠ 穷尽),故仅全时段登记。
const closedFor = new Map<string, CompRow[]>();
const finitePoolProgress = new TimerWcaFinitePoolProgressTracker();

function noteServed(key: string, slot: string | null): void {
  // Common pools are unbounded, so never retain their entire served history.
  if (slot && closedFor.has(key)) finitePoolProgress.noteServed(key, slot);
}

/** 封闭集(真题总数已知且有限,见 closedFor)的遍历进度 { total, seen };非封闭 / 未知 → null。
 *  UI 据此在稀有档提示「共几条、已练几条、练完后开始重复」——不必等用户自己发现打乱在转圈复现。
 *  Shared tracker intersects official slot identities; equal scramble text in
 *  different official slots therefore advances twice. */
export function wcaPoolProgress(spec: WcaSourceSpec): { total: number; seen: number } | null {
  const key = specKey(spec);
  if (!key) return null;
  const progress = finitePoolProgress.get(key);
  return progress ? { total: progress.total, seen: progress.seen } : null;
}

// localStorage persistence — so reopening the timer (or returning to a source /
// setting used before) serves the first scramble instantly from cache and tops
// up in the background, instead of waiting on the cold network fetch. Only a
// never-before-fetched context still needs the one round trip. SSR / node (tests)
// have no localStorage; every access is guarded.
const STORE_KEY = 'cuberoot.wca-pool.v1';
const STORE_TTL = 7 * 24 * 3600 * 1000; // 7 天后视为过期,丢弃
const STORE_KEYS_CAP = 8;               // date + comp 合计最多缓存几个来源
const STORE_PER_KEY = 50;               // 每个来源最多缓存几条
let hydrated = false;

type PersistedCompRow = [scramble: string, meta: WcaScrambleMeta];
interface PersistedWcaPools {
  t: number;
  pools?: Record<string, PersistedCompRow[]>;
  meta?: [string, WcaScrambleMeta][];
  comp?: Record<string, PersistedCompRow[]>;
}

function compSlot(meta: WcaScrambleMeta): string {
  return timerWcaCompetitionScrambleSlotIdentity({
    competitionId: meta.ci,
    eventId: meta.e,
    roundTypeId: meta.r,
    groupId: meta.g,
    isExtra: meta.x === 1,
    scrambleNumber: meta.n,
  });
}

function decodeCompRow(scramble: unknown, value: unknown): CompRow | null {
  if (typeof scramble !== 'string' || !value || typeof value !== 'object') return null;
  const meta = value as Partial<WcaScrambleMeta>;
  if (typeof meta.cn !== 'string'
    || (meta.nonOptimal !== undefined && typeof meta.nonOptimal !== 'boolean')) return null;
  const slot = decodeTimerWcaCompetitionScrambleSlot({
    competitionId: meta.ci,
    eventId: meta.e,
    roundTypeId: meta.r,
    groupId: meta.g,
    isExtra: meta.x === 1,
    scrambleNumber: meta.n,
  });
  if (!slot || (meta.x !== 0 && meta.x !== 1)) return null;
  const normalizedMeta: WcaScrambleMeta = {
    ci: slot.competitionId,
    cn: meta.cn,
    e: slot.eventId,
    r: slot.roundTypeId,
    g: slot.groupId,
    n: slot.scrambleNumber,
    x: slot.isExtra ? 1 : 0,
    ...(meta.nonOptimal !== undefined ? { nonOptimal: meta.nonOptimal } : {}),
  };
  return {
    slot: timerWcaCompetitionScrambleSlotIdentity(slot),
    scramble,
    meta: normalizedMeta,
  };
}

function restoreCompRow(value: unknown): CompRow | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  return decodeCompRow(value[0], value[1]);
}

// Legacy v1 payloads stored queues as string[]. Those entries lack official-slot
// identity, so restoreCompRow rejects them and forces one cold refetch instead
// of reintroducing duplicate-text provenance bugs.
function isCompetitionPoolKey(key: string): boolean {
  return key.startsWith('["c",');
}

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
    const data = JSON.parse(raw) as PersistedWcaPools;
    if (!data || typeof data.t !== 'number' || Date.now() - data.t > STORE_TTL) return;
    for (const [k, values] of Object.entries(data.pools ?? {})) {
      if (isCompetitionPoolKey(k) || !Array.isArray(values) || values.length === 0) continue;
      const restored = values.slice(0, STORE_PER_KEY)
        .map(restoreCompRow)
        .filter((row): row is CompRow => row !== null);
      if (restored.length > 0) pools[k] ??= restored;
    }
    for (const [s, m] of data.meta ?? []) {
      const row = decodeCompRow(s, m);
      if (row && !metaByScramble.has(row.scramble)) rememberMeta(row.scramble, row.meta);
    }
    for (const [k, values] of Object.entries(data.comp ?? {})) {
      if (!Array.isArray(values) || values.length === 0) continue;
      const restored = values.slice(0, STORE_PER_KEY)
        .map(restoreCompRow)
        .filter((row): row is CompRow => row !== null);
      if (restored.length === 0) continue;
      compQueues[k] ??= restored;
      compAppendAfter[k] = restored[restored.length - 1]!.slot;
    }
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
      const dateKeys = Object.keys(pools)
        .filter((k) => !isCompetitionPoolKey(k) && pools[k]?.length);
      const compKeys = Object.keys(compQueues).filter((k) => compQueues[k]?.length);
      const keys = [...dateKeys, ...compKeys].slice(-STORE_KEYS_CAP);
      const selected = new Set(keys);
      const out: Record<string, PersistedCompRow[]> = {};
      const comp: Record<string, PersistedCompRow[]> = {};
      for (const k of dateKeys) {
        if (!selected.has(k)) continue;
        out[k] = pools[k]!.slice(0, STORE_PER_KEY)
          .map((row): PersistedCompRow => [row.scramble, row.meta]);
      }
      for (const k of compKeys) {
        if (!selected.has(k)) continue;
        comp[k] = compQueues[k]!.slice(0, STORE_PER_KEY)
          .map((row): PersistedCompRow => [row.scramble, row.meta]);
      }
      ls.setItem(STORE_KEY, JSON.stringify({ t: Date.now(), pools: out, comp }));
    } catch { /* quota / unavailable — ignore */ }
  }, 600);
}

/** Normalize stray non-ASCII punctuation (e.g. a Pyraminx scramble that used ’
 *  instead of ') so cubing.js / renderers accept the move string. */
function normalize(s: string): string {
  return s.replace(/[‘’ʼ′]/g, "'");
}

function wev(spec: WcaSourceSpec): string | undefined {
  return timerWcaScrambleEventId(spec.event) ?? undefined;
}

/** Stable cache key for this source. null = no real scrambles possible (event
 *  unmapped, or comp mode with no competition picked yet). */
function specKey(spec: WcaSourceSpec): string | null {
  const w = wev(spec);
  if (!w) return null;
  const source = timerWcaSourceIdentity(spec.event, w, sourceSettings(spec), {
    competitionUnindexed: spec.mode === 'comp' && !!spec.comp
      && webTimerWcaDifficultyAdapter.getCompetitionCoverage(spec.comp, w) === false,
  });
  if (!source) return null;
  // 「按步数」过滤两种模式都生效,进 key(切换度量/区间即重灌)。
  const sf = spec.stepFilter ? `|S:${spec.stepFilter.metric}:${spec.stepFilter.lo}.${spec.stepFilter.hi}` : '';
  const tf = spec.typeFilter ? `|T:${spec.typeFilter}` : '';
  return `${source}${sf}${tf}`;
}

function rememberMeta(s: string, m: WcaScrambleMeta): void {
  metaByScramble.set(s, m);
  metaBySlot.set(compSlot(m), m);
  while (metaByScramble.size > META_CAP) {
    const oldest = metaByScramble.keys().next().value;
    if (oldest === undefined) break;
    metaByScramble.delete(oldest);
  }
  while (metaBySlot.size > META_CAP) {
    const oldest = metaBySlot.keys().next().value;
    if (oldest === undefined) break;
    metaBySlot.delete(oldest);
  }
}

/** 「按步数」过滤:该条真题的度量步数是否落在 [lo,hi] 内。
 *  开启了精确过滤却无法度量时必须 fail closed,不能把错记号当作符合。 */
function usesWorkerStepFilter(spec: WcaSourceSpec): spec is WcaSourceSpec & {
  event: TimerNon222StepPuzzle;
  stepFilter: NonNullable<WcaSourceSpec['stepFilter']>;
} {
  return !!spec.stepFilter && (spec.event === 'pyra' || spec.event === 'skewb');
}

function stepPassSync(spec: WcaSourceSpec, scramble: string): boolean {
  if (!spec.stepFilter) return true;
  if (usesWorkerStepFilter(spec)) return true;
  const d = scrambleStepMetric(spec.event, spec.stepFilter.metric, scramble);
  if (d == null) return false;
  return d >= spec.stepFilter.lo && d <= spec.stepFilter.hi;
}

function localPass(spec: WcaSourceSpec, scramble: string): boolean {
  if (!stepPassSync(spec, scramble)) return false;
  return !spec.typeFilter || cube222StateTypeMatchesScramble(scramble, spec.typeFilter);
}

async function localFilterRows<T extends { scramble: string }>(
  spec: WcaSourceSpec,
  rows: readonly T[],
): Promise<T[]> {
  const locallyValid = rows.filter((row) => localPass(spec, row.scramble));
  if (!usesWorkerStepFilter(spec)) return locallyValid;
  return filterWebNon222BySteps(
    spec.event,
    locallyValid,
    spec.stepFilter,
    new AbortController().signal,
  );
}

/** 比赛序比较器(初赛→决赛 → 组别 → 正式在前额外在后 → 把序号)。 */
function compOrder(a: WcaScrambleMeta, b: WcaScrambleMeta): number {
  return compareTimerWcaCompetitionScrambleOrder({
    roundTypeId: a.r,
    groupId: a.g,
    isExtra: a.x === 1,
    scrambleNumber: a.n,
  }, {
    roundTypeId: b.r,
    groupId: b.g,
    isExtra: b.x === 1,
    scrambleNumber: b.n,
  });
}

/** comp 全量(默认):拉整场打乱 → 过滤 event/round/group(+ 可选最优)→ 竞赛序。 */
async function compRowsAll(spec: WcaSourceSpec, w: string, useOptimal: boolean): Promise<CompRow[]> {
  const all = await fetchWcaScrambles(spec.comp);
  if (all === null) throw new Error('competition scrambles unavailable');
  const rows = all
    .filter((r) => r.event_id === w
      && (!spec.round || r.round_type_id === spec.round)
      && (!spec.group || r.group_id === spec.group)
      // 最优模式:只留有最优等态的真题,不再静默回退原打乱(无则该比赛队列空 -> 回退随机生成)。
      && (!useOptimal || !!r.optimal_scramble))
    .map((r) => {
      // 最优模式且该打乱有最优等态(同态项目)→ 用最优打乱,否则原打乱。
      const scramble = normalize(useOptimal && r.optimal_scramble ? r.optimal_scramble : r.scramble);
      const meta: WcaScrambleMeta = {
        ci: spec.comp,
        cn: spec.compName || spec.comp,
        e: w,
        r: r.round_type_id,
        g: r.group_id,
        n: r.scramble_num,
        x: (r.is_extra ? 1 : 0) as 0 | 1,
      };
      return decodeCompRow(scramble, meta);
    });
  return (await localFilterRows(spec, rows.filter((row): row is CompRow => row !== null)))
    .sort((A, B) => compOrder(A.meta, B.meta));
}

/** comp + 难度(3x3 族):by-difficulty 端点按 (方法,阶段,底色) 逐 bin 拉本场真题 → 过滤 round/group → 竞赛序。
 *  端点按精确官方名(names)+ event + bin 查;再用 ci===comp 收敛到本场(防撞名),用 o 支持最优模式。
 *  任一请求失败(网络/契约)→ 抛出让 fill 不缓存、不判空,稍后整组重取。 */
async function compRowsByDifficulty(spec: WcaSourceSpec, w: string, useOptimal: boolean): Promise<CompRow[]> {
  const d = spec.diff!;
  const bins = [...new Set(d.steps)].sort((a, b) => a - b);
  // 合并口径下省略 event = 本场所有 3x3 族轮次的真题都算(与 /random 的 family=1 同义);
  // 分开则只要本项目的。
  const results = await Promise.all(bins.map((bin) => webTimerWcaDifficultyAdapter.fetchByDifficulty({
    variant: d.variant, stage: d.stage, colors: d.colors, bin, event: d.merged ? undefined : w,
    names: spec.compName ? [spec.compName] : undefined, pageSize: 200,
  })));
  if (results.some((r) => r == null)) throw new Error('by-difficulty unavailable');
  const seen = new Set<string>();
  const out: CompRow[] = [];
  for (const res of results) {
    for (const row of res?.scrambles ?? []) {
      if (row.ci !== spec.comp) continue;                    // 精确到本场(names 可能撞号)
      if (spec.round && row.r !== spec.round) continue;
      if (spec.group && row.g !== spec.group) continue;
      if (useOptimal && !row.o) continue;                    // 最优模式:只留有最优等态的
      // 合并口径下同一 (轮次,组,序号) 在不同项目里各有一条,去重键必须带 event,否则会互相吞掉。
      const meta: WcaScrambleMeta = {
        ci: spec.comp,
        cn: spec.compName || spec.comp,
        e: row.e || w,
        r: row.r,
        g: row.g,
        n: row.n,
        x: row.x,
      };
      // e 取真实来源项目(合并时可能不是当前练习的项目),来源角标才不会张冠李戴。
      const decoded = decodeCompRow(
        normalize(useOptimal && row.o ? row.o : row.scramble),
        meta,
      );
      if (!decoded || seen.has(decoded.slot)) continue;
      seen.add(decoded.slot);
      out.push(decoded);
    }
  }
  return (await localFilterRows(spec, out)).sort((A, B) => compOrder(A.meta, B.meta));
}

/** 主动探测并缓存 comp 覆盖(inflight 去重,已缓存直接返回)。UI 在选中比赛时提前调,好在难度开关上分诊。 */
export async function probeCompCoverage(comp: string, compName: string, wcaEvent: string): Promise<boolean | null> {
  return webTimerWcaDifficultyAdapter.probeCompetitionCoverage(comp, compName, wcaEvent);
}

/** 同步读已探测的 comp 覆盖:true=已入库 / false=未入库 / null=未知(尚未探测 / 判不了)。 */
export function getCompCoverage(comp: string, wcaEvent: string): boolean | null {
  return webTimerWcaDifficultyAdapter.getCompetitionCoverage(comp, wcaEvent);
}

/** comp mode: load the comp once (cached), filter to event + round + group (+ 可选难度),
 *  sort in competition order, and (re)fill the queue — loops indefinitely. */
async function fillComp(spec: WcaSourceSpec, key: string): Promise<void> {
  const w = wev(spec);
  if (!w) return;
  const useOptimal = wantOptimal(spec, w);
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
  const q = (compQueues[key] ??= []);
  const anchor = compAppendAfter[key];
  const anchorIndex = anchor ? rows.findIndex((row) => row.slot === anchor) : -1;
  const start = anchorIndex >= 0 ? (anchorIndex + 1) % rows.length : 0;
  // Append exactly one official cycle. A hydrated queue contains at most the
  // first 50 pending rows; starting after its final cached slot restores the
  // uncached competition tail before cycling to slot one.
  for (let offset = 0; offset < rows.length; offset++) {
    q.push(rows[(start + offset) % rows.length]!);
  }
  compAppendAfter[key] = q[q.length - 1]!.slot;
  persist();
}

/** 从 puzzle_examples.json 的步数桶或二阶状态桶收集真题并登记来源元数据。
 *  返回收集到的条数(0 = 无预计算,回退 live 采样)。 */
async function seedPrecomputed(spec: WcaSourceSpec, key: string): Promise<number> {
  const sf = spec.stepFilter;
  const tf = spec.typeFilter;
  if (!sf && !tf) return 0;
  const exKey = EXAMPLES_KEY[spec.event];
  if (!exKey) return 0;
  const j = await loadExamples();
  const entry = j?.puzzles?.[exKey];
  if (!entry) return 0;
  const samples: PuzzleExampleSample[] = [];
  if (tf) {
    samples.push(...(entry.types?.[tf] ?? []));
  } else if (sf) {
    const bins = entry.metrics?.[sf.metric]?.bins ?? (sf.metric === 'htm' ? entry.bins : undefined);
    if (!bins) return 0;
    for (let v = sf.lo; v <= sf.hi; v++) samples.push(...(bins[String(v)] ?? []));
  }
  if (samples.length === 0) return 0;
  // 最优模式与 live 语义一致:只端有最优等态的示例(最优打乱同态,度量值不变),不静默回退原打乱。
  const useOptimal = wantOptimal(spec, wev(spec)!);
  const candidates: Array<{ scramble: string; sample: PuzzleExampleSample }> = [];
  for (const smp of samples) {
    const raw = useOptimal ? smp[2] : smp[1];
    if (!raw) continue;
    candidates.push({ scramble: normalize(raw), sample: smp });
  }
  const filtered = await localFilterRows(spec, candidates);
  const list: CompRow[] = [];
  const seenSlots = new Set<string>();
  for (const candidate of filtered) {
    const m = entry.idMeta[candidate.sample[0]];
    if (!m) continue;
    const meta: WcaScrambleMeta = {
      ci: m[0], cn: entry.comps[m[0]]?.[0] ?? m[0], e: m[1], r: m[3], g: m[4], n: m[2], x: m[5] as 0 | 1,
    };
    const row = decodeCompRow(candidate.scramble, meta);
    if (!row) continue;
    if (seenSlots.has(row.slot)) continue;
    seenSlots.add(row.slot);
    list.push(row);
    rememberMeta(row.scramble, row.meta);
  }
  precomputedFor.set(key, list);
  return list.length;
}

/** Fisher–Yates 洗牌拷贝(每次 refill 换序端出,避免固定顺序)。 */
function shuffledCopy<T>(src: readonly T[]): T[] {
  const a = src.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** 有限真题集(预计算桶 / 封闭集)洗牌灌回队列,循环用不会耗尽。优先端还没在队列里的,
 *  桶太小(如仅 2 条)全在队列时只能整桶循环,再防「洗牌头 == 队尾」的背靠背重复。 */
function refillFrom(q: CompRow[], src: CompRow[]): void {
  const inQ = new Set(q.map((row) => row.slot));
  let arr = shuffledCopy(src).filter((row) => !inQ.has(row.slot));
  if (arr.length === 0) arr = shuffledCopy(src);
  if (q.length > 0 && arr.length > 1 && arr[0]!.slot === q[q.length - 1]!.slot) arr.push(arr.shift()!);
  q.push(...arr);
}

/** date mode: top up from the server's random sampler (optionally date-bounded). */
async function fillDate(spec: WcaSourceSpec, key: string): Promise<void> {
  const w = wev(spec);
  if (!w) return;
  const useOptimal = wantOptimal(spec, w);
  const buildQs = () => {
    return timerWcaRandomRequestQuery(w, sourceSettings(spec), FETCH_COUNT);
  };
  const q = (pools[key] ??= []);
  const hasLocalFilter = !!spec.stepFilter || !!spec.typeFilter;
  // 封闭集已确认(该 spec 的真题就这几条)→ 本地洗牌灌回,零网络。稀有难度档常态走这条。
  const closed = closedFor.get(key);
  if (closed && closed.length > 0) { refillFrom(q, closed); knownEmpty.delete(key); persist(); return; }
  // 本地精确筛选先用预计算真题桶播种(稀有步数区间 / 二阶状态族即时可靠),再 live 补充变化。
  let hasPrecomputed = false;
  // 预计算真题桶是全时段的,只在无日期范围时播种(有 from/to 时 live 采样才尊重日期过滤)。
  if (hasLocalFilter && !spec.from && !spec.to) {
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
  // live 采样:无本地过滤 → 1 批(原行为);有本地过滤且无预计算 → MAX_FILTER_BATCHES 批找稀有匹配,
  // 全空才判 knownEmpty;有预计算 → 只补 3 批变化(常见区间一批即中并短路,稀有区间靠预计算不硬搜),永不判空。
  const maxBatches = hasLocalFilter ? (hasPrecomputed ? 3 : MAX_FILTER_BATCHES) : 1;
  // 封闭集只在「全时段 + 无本地过滤」时可判(见 closedFor):有 from/to 走 comp-sampling(抽 30 场,
  // 回得少不代表穷尽);本地过滤有自己的预计算桶 + 多批采样路径,回条数与匹配数不对应。
  const canClose = !hasLocalFilter && !spec.from && !spec.to;
  let totalAdded = 0;
  for (let batch = 0; batch < maxBatches; batch++) {
    const res = await fetch(apiUrl(`/v1/wca/scrambles/random?${buildQs().toString()}`));
    // 难度无匹配时端点回 404 → 确认空(非瞬时错误),让 UI 显式提示。有预计算则不判空。
    if (res.status === 404) { if (!hasPrecomputed) knownEmpty.add(key); return; }
    if (!res.ok) return; // 其它失败(5xx / 网络)= 瞬时,不标空,稍后重取
    const data = (await res.json()) as { scrambles?: RandomItem[] };
    const items = Array.isArray(data.scrambles) ? data.scrambles : [];
    if (items.length === 0) return; // 200 + 空批没有全集证明:保持 transient,下次重试。
    const candidates: Array<{
      scramble: string;
      item: RandomItem;
      usedOptimal: boolean;
    }> = [];
    for (const item of items) {
      if (!item?.scramble) continue;
      const usedOptimal = useOptimal && !!item.o;
      candidates.push({
        scramble: normalize(usedOptimal ? item.o! : item.scramble),
        item,
        usedOptimal,
      });
    }
    const accepted = await localFilterRows(spec, candidates);
    const got: CompRow[] = [];
    for (const candidate of accepted) {
      const item = candidate.item;
      const meta: WcaScrambleMeta = {
        ci: item.ci, cn: item.cn, e: item.e, r: item.r, g: item.g, n: item.n, x: item.x,
        ...(useOptimal && !candidate.usedOptimal ? { nonOptimal: true } : {}),
      };
      const row = decodeCompRow(candidate.scramble, meta);
      if (!row) continue;
      q.push(row);
      got.push(row);
      rememberMeta(row.scramble, row.meta);
    }
    const added = got.length;
    // 要 FETCH_COUNT 条却回得更少 = 服务端已扫完全集 → 这批就是匹配全集,登记后不再联网。
    // 常见档恒回满 FETCH_COUNT,永远不会进这里;只有稀有档(全库个位数)才封闭。
    if (canClose && items.length < FETCH_COUNT && got.length > 0) {
      const closed = [...new Map(got.map((row) => [row.slot, row])).values()];
      closedFor.set(key, closed);
      finitePoolProgress.registerClosedSet(key, closed.map((row) => row.slot));
    }
    totalAdded += added;
    if (added > 0) break; // 已找到匹配,不再多抓(短路,常态一批即够)
  }
  // 连抓 maxBatches 批仍一条不落 = 有界采样 miss,不是全集为空的证明。
  // 保持 transient,让 nextWca / 退避重试继续找;严禁写入 knownEmpty 永久锁死。
  if (hasLocalFilter && !hasPrecomputed && totalAdded === 0) return;
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
      /* Transient failure stays distinguishable from an empty source; the
         caller keeps the real-source slot empty and retries without substitution. */
    } finally {
      inflight[key] = undefined;
    }
  })();
  inflight[key] = p;
  return p;
}

/** Whether this source can yield real scrambles (event mapped + comp picked in
 *  comp mode). Whether the picked comp actually has the event is resolved async;
 *  an empty result is reported explicitly and never replaced with generated data. */
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
  return webTimerWcaDifficultyAdapter.getCompetitionCoverage(spec.comp, w) === false;
}

function queuedCount(spec: WcaSourceSpec, key: string): number {
  return spec.mode === 'comp'
    ? (compQueues[key]?.length ?? 0)
    : (pools[key]?.length ?? 0);
}

function shiftQueued(spec: WcaSourceSpec, key: string): WcaDispensedScramble | null {
  if (spec.mode === 'comp') {
    const row = compQueues[key]?.shift();
    if (!row) return null;
    // Register provenance at dispense time. Registering an entire competition
    // by scramble text would let a later identical-text slot overwrite this one.
    const meta = { ...row.meta };
    rememberMeta(row.scramble, meta);
    return { scramble: row.scramble, slot: row.slot, meta };
  }
  const row = pools[key]?.shift();
  if (!row) return null;
  const meta = { ...row.meta };
  rememberMeta(row.scramble, meta);
  return { scramble: row.scramble, slot: row.slot, meta };
}

/** Warm the pool ahead of time (on spec change / when WCA mode turns on). */
export function prefetchWca(spec: WcaSourceSpec): void {
  hydrate();
  const key = specKey(spec);
  if (!key) return;
  if (queuedCount(spec, key) < REFILL_AT) void fill(spec);
}

/** Synchronous occurrence take. Consumers with history must retain this row so
 * duplicate scramble text never loses its official-slot provenance. */
export function peekWcaRow(spec: WcaSourceSpec): WcaDispensedScramble | null {
  hydrate();
  const key = specKey(spec);
  if (!key) return null;
  const row = shiftQueued(spec, key);
  if (row) { noteServed(key, row.slot); persist(); } // 反映已消费,避免重开时端出同一条
  if (queuedCount(spec, key) < REFILL_AT) void fill(spec);
  return row;
}

/** Backwards-compatible text-only take for consumers without navigation. */
export function peekWca(spec: WcaSourceSpec): string | null {
  return peekWcaRow(spec)?.scramble ?? null;
}

/** Async occurrence take; see peekWcaRow for the history contract. */
export async function nextWcaRow(spec: WcaSourceSpec): Promise<WcaDispensedScramble | null> {
  hydrate();
  const key = specKey(spec);
  if (!key) return null;
  if (queuedCount(spec, key) === 0) await fill(spec);
  const row = shiftQueued(spec, key);
  if (row) { noteServed(key, row.slot); persist(); }
  return row;
}

/** Backwards-compatible text-only async take. */
export async function nextWca(spec: WcaSourceSpec): Promise<string | null> {
  return (await nextWcaRow(spec))?.scramble ?? null;
}

/** Source metadata for a scramble previously dispensed by this pool, else null
 *  (locally generated scramble, or one evicted from the capped meta map). */
export function wcaMetaFor(scramble: string | WcaDispensedScramble): WcaScrambleMeta | null {
  if (typeof scramble !== 'string') return scramble.meta;
  hydrate();
  return metaByScramble.get(normalize(scramble)) ?? null;
}

/** Stable lookup for a persisted Solve.scrambleSource identity. */
export function wcaMetaForSlot(slot: string): WcaScrambleMeta | null {
  hydrate();
  return metaBySlot.get(slot) ?? null;
}

/** timer EventId → WCA scrambles event_id (undefined if this event has no real
 *  competition scrambles). Exposed for the source-config UI (round/group derivation). */
export function wcaEventId(event: EventId): string | undefined {
  return timerWcaScrambleEventId(event) ?? undefined;
}
