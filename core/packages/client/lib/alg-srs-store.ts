'use client';

/**
 * 公式记忆(间隔重复)的存取层:localStorage 落地 + 登录后云端同步 + zustand store。
 * 调度算法本身在 `alg-srs.ts`(纯函数)。
 *
 * 同步策略与 `trainer-marks.ts` 一致:进页装本地 → 拉云端逐条 last-write-wins 合并 →
 * 写操作乐观更新本地 + 防抖批量 PUT。
 *
 * **云端是可选的**:`/v1/alg/srs` 若尚未上线(404 / 网络失败),整套功能退化成纯本地,
 * 不弹错、不阻塞 —— 记忆数据一天都不能因为后端没跟上而丢。
 */
import { create } from 'zustand';
import { apiUrl } from './api-base';
import { authHeaders, handleApi } from './admin-api';
import { getSessionToken } from './auth-store';
import { persistItem } from './safe-storage';
import { useTrainerMarks, markStatus } from './trainer-marks';
import { splitCaseKey } from './trainer-case-key';
import {
  scheduleNext, bumpDaily, mergeSrs, mergeDaily, summarizeSrs, dayKey, MASTER_DAYS,
  type SrsRecs, type SrsRec, type SrsGrade, type SrsDaily, type SrsPutItem, type SrsSetStat,
} from './alg-srs';

const recsKey = (p: string, s: string) => `srs:recs:${p}/${s}`;
const DAILY_KEY = 'srs:daily';
/** 每日日志保留天数(热力图画一年 + 一点余量)。 */
const DAILY_KEEP_DAYS = 400;

// ── localStorage ────────────────────────────────────────────────────

const loadLocalRecs = (p: string, s: string): SrsRecs => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(recsKey(p, s));
    if (raw) return JSON.parse(raw) as SrsRecs;
  } catch { /* 坏 JSON 当空 */ }
  return {};
};

const persistLocalRecs = (p: string, s: string, recs: SrsRecs) => {
  if (typeof window === 'undefined') return;
  persistItem(recsKey(p, s), JSON.stringify(recs));
};

export const loadDaily = (): SrsDaily => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    if (raw) return JSON.parse(raw) as SrsDaily;
  } catch { /* ignore */ }
  return {};
};

/** 写每日日志,顺手裁掉过老的天(否则常年累月无限长)。 */
const persistDaily = (daily: SrsDaily) => {
  if (typeof window === 'undefined') return;
  const cutoff = dayKey(Date.now() - DAILY_KEEP_DAYS * 86_400_000);
  const kept: SrsDaily = {};
  for (const k in daily) if (k >= cutoff) kept[k] = daily[k];
  persistItem(DAILY_KEY, JSON.stringify(kept));
};

// ── 云端同步(端点缺失即静默降级为纯本地)────────────────────────────

/** 云端不可用(未部署 / 离线)后不再重试,免得每次操作都打一串失败请求。 */
let cloudDown = false;

const cloudEnabled = () => !cloudDown && !!getSessionToken();

async function cloudGet<T>(path: string): Promise<T | null> {
  if (!cloudEnabled()) return null;
  try {
    return await handleApi<T>(await fetch(apiUrl(path), { headers: authHeaders(false) }));
  } catch (e) {
    cloudDown = true;
    console.warn('[alg-srs] cloud unavailable, local only', e);
    return null;
  }
}

async function cloudPut(path: string, body: unknown): Promise<boolean> {
  if (!cloudEnabled()) return false;
  try {
    await handleApi(await fetch(apiUrl(path), {
      method: 'PUT', headers: authHeaders(), body: JSON.stringify(body),
    }));
    return true;
  } catch (e) {
    console.warn('[alg-srs] cloud put failed, will retry later', e);
    return false;
  }
}

/** 防抖上传队列:key = `${puzzle}/${set}|${caseKey}`。 */
let pending = new Map<string, { p: string; s: string; item: SrsPutItem }>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let dailyDirty = false;

async function flushPending(): Promise<void> {
  flushTimer = null;
  if (dailyDirty) {
    dailyDirty = false;
    const daily = loadDaily();
    const days = Object.entries(daily).map(([d, [n, again]]) => [d, n, again]);
    if (days.length > 0 && !(await cloudPut('/v1/alg/srs/daily', { days }))) dailyDirty = true;
  }
  if (pending.size === 0) return;
  const batch = pending;
  pending = new Map();
  const groups = new Map<string, { p: string; s: string; items: SrsPutItem[] }>();
  for (const [, v] of batch) {
    const gk = `${v.p}/${v.s}`;
    const g = groups.get(gk) ?? { p: v.p, s: v.s, items: [] };
    g.items.push(v.item);
    groups.set(gk, g);
  }
  await Promise.all([...groups.values()].map(async (g) => {
    const ok = await cloudPut(`/v1/alg/srs/${g.p}/${g.s}`, { items: g.items });
    // 失败塞回队列,下一次写操作连带重试(不覆盖期间产生的新版本)
    if (!ok) for (const it of g.items) {
      const key = `${g.p}/${g.s}|${it.k}`;
      if (!pending.has(key)) pending.set(key, { p: g.p, s: g.s, item: it });
    }
  }));
}

function queueUpload(puzzle: string, set: string, items: SrsPutItem[]) {
  if (!cloudEnabled()) return;
  for (const it of items) pending.set(`${puzzle}/${set}|${it.k}`, { p: puzzle, s: set, item: it });
  dailyDirty = true;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => { void flushPending(); }, 1200);
}

/** 立即冲队列(进度总览页拉聚合前调,避免刚打的分还没上云)。 */
export async function flushSrs(): Promise<void> {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  await flushPending();
}

// ── store ───────────────────────────────────────────────────────────

interface AlgSrsState {
  puzzle: string | null;
  set: string | null;
  /**
   * 合练会话的成员 set(单集为 null)。非空时 `recs` 的键带 set 前缀,
   * 但排期仍落各自 set 的命名空间 —— 合练里复习过的卡,单独进那一套也算复习过。
   */
  sets: string[] | null;
  recs: SrsRecs;
  daily: SrsDaily;
  /** 本场已评分次数(用于「今天练了多少」的即时反馈)。 */
  sessionCount: number;
  /** 进 run 页调用:装本地,登录则拉云端合并。 */
  loadSrs: (puzzle: string, set: string) => void;
  /** 合练版:一次装 N 个 set,合并成一张带前缀的表。 */
  loadSrsMulti: (puzzle: string, sets: string[]) => void;
  /** 打一次分,返回新的记录(供 UI 显示「下次 N 天后」)。 */
  grade: (key: string, g: SrsGrade) => SrsRec;
  /** 撤销:把记录还原成传入的旧值(评错分时用)。 */
  restore: (key: string, prev: SrsRec | undefined) => void;
  /** 重置一张卡的记忆(当新卡处理)。 */
  reset: (key: string) => void;
}

let loadToken = 0;

export const useAlgSrs = create<AlgSrsState>((set, get) => ({
  puzzle: null,
  set: null,
  sets: null,
  recs: {},
  daily: {},
  sessionCount: 0,

  loadSrs: (puzzle, setSlug) => {
    const token = ++loadToken;
    set({ puzzle, set: setSlug, sets: null, recs: loadLocalRecs(puzzle, setSlug), daily: loadDaily() });
    if (!cloudEnabled()) return;
    void (async () => {
      const data = await cloudGet<{ recs: SrsRecs; daily?: Array<[string, number, number]> }>(
        `/v1/alg/srs/${puzzle}/${setSlug}`,
      );
      if (!data || token !== loadToken) return;
      const st = get();
      if (st.puzzle !== puzzle || st.set !== setSlug) return;
      const { merged, toUpload } = mergeSrs(st.recs, data.recs ?? {});
      persistLocalRecs(puzzle, setSlug, merged);
      let daily = st.daily;
      if (data.daily) {
        const cloudDaily: SrsDaily = {};
        for (const [d, n, again] of data.daily) cloudDaily[d] = [n, again];
        daily = mergeDaily(st.daily, cloudDaily);
        persistDaily(daily);
      }
      set({ recs: merged, daily });
      if (toUpload.length > 0) queueUpload(puzzle, setSlug, toUpload);
    })();
  },

  loadSrsMulti: (puzzle, sets) => {
    const token = ++loadToken;
    const prefixed = (slug: string, r: SrsRecs): SrsRecs => {
      const out: SrsRecs = {};
      for (const k in r) out[`${slug}:${k}`] = r[k];
      return out;
    };
    const local: SrsRecs = {};
    for (const slug of sets) Object.assign(local, prefixed(slug, loadLocalRecs(puzzle, slug)));
    set({ puzzle, set: sets.join('+'), sets: [...sets], recs: local, daily: loadDaily() });
    if (!cloudEnabled()) return;
    void (async () => {
      // 每个成员 set 各自合并回自己那张表 —— 云端结构不变,合练不引入新表
      const results = await Promise.all(sets.map(async slug => ({
        slug,
        data: await cloudGet<{ recs: SrsRecs; daily?: Array<[string, number, number]> }>(
          `/v1/alg/srs/${puzzle}/${slug}`,
        ),
      })));
      if (token !== loadToken) return;
      const merged: SrsRecs = { ...get().recs };
      let daily = get().daily;
      for (const { slug, data } of results) {
        if (!data) continue;
        const r = mergeSrs(loadLocalRecs(puzzle, slug), data.recs ?? {});
        persistLocalRecs(puzzle, slug, r.merged);
        Object.assign(merged, prefixed(slug, r.merged));
        if (r.toUpload.length > 0) queueUpload(puzzle, slug, r.toUpload);
        if (data.daily) {
          const cloudDaily: SrsDaily = {};
          for (const [d, n, again] of data.daily) cloudDaily[d] = [n, again];
          daily = mergeDaily(daily, cloudDaily);
        }
      }
      persistDaily(daily);
      if (token === loadToken) set({ recs: merged, daily });
    })();
  },

  grade: (key, g) => {
    const { recs, daily } = get();
    const now = Date.now();
    const rec = scheduleNext(recs[key], g, now, Math.random() * 2 - 1);
    const nextRecs = { ...recs, [key]: rec };
    const nextDaily = bumpDaily(daily, now, g);
    writeRec(get(), key, rec, nextRecs);
    persistDaily(nextDaily);
    set({ recs: nextRecs, daily: nextDaily, sessionCount: get().sessionCount + 1 });
    return rec;
  },

  restore: (key, prev) => {
    const { recs } = get();
    const nextRecs = { ...recs };
    if (prev) nextRecs[key] = prev;
    else delete nextRecs[key];
    // 撤销也要上云,否则别的设备还留着那一次误评
    writeRec(get(), key, prev ?? blankRec(), nextRecs);
    set({ recs: nextRecs, sessionCount: Math.max(0, get().sessionCount - 1) });
  },

  reset: (key) => {
    const { recs } = get();
    const blank = blankRec();
    const nextRecs = { ...recs, [key]: blank };
    writeRec(get(), key, blank, nextRecs);
    set({ recs: nextRecs });
  },
}));

const blankRec = (): SrsRec => ({ d: 0, iv: 0, ef: 2.4, n: 0, l: 0, st: 0, t: Date.now(), h: 0 });

/**
 * 落一条记录 + 排队上云。
 * 单集:整张表照旧落当前 set。合练:按 key 前缀落到那个成员 set 自己的命名空间,
 * 存的是去掉前缀的原始 key —— 单独进那一套时读到的就是同一条排期。
 */
function writeRec(st: AlgSrsState, key: string, rec: SrsRec, nextRecs: SrsRecs): void {
  const { puzzle, set: setSlug, sets } = st;
  if (!puzzle || !setSlug) return;
  if (!sets) {
    persistLocalRecs(puzzle, setSlug, nextRecs);
    queueUpload(puzzle, setSlug, [{ k: key, ...rec }]);
    return;
  }
  const { set: slug, raw } = splitCaseKey(key, sets);
  if (!slug) return; // 合练里的无前缀 key = 脏数据,不猜它属于谁
  const cur = loadLocalRecs(puzzle, slug);
  cur[raw] = rec;
  persistLocalRecs(puzzle, slug, cur);
  queueUpload(puzzle, slug, [{ k: raw, ...rec }]);
}

// ── 记忆进展 → 学习标记的自动升降 ───────────────────────────────────

/**
 * 按记忆进展维护「不熟 / 已掌握」标记(记忆模式与计时训练共用这一份):
 *   第一次记住 → 不熟;间隔涨过 MASTER_DAYS → 已掌握;已掌握的忘了 → 打回不熟。
 * 调用方负责判断偏好开关。
 */
export function autoMarkFromSrs(key: string, next: SrsRec, grade: SrsGrade): void {
  const mk = useTrainerMarks.getState();
  const cur = markStatus(mk.marks, key);
  if (grade === 0) {
    if (cur === 'mastered') mk.applyMarks([key], { s: 'learning' });
    return;
  }
  if (next.iv >= MASTER_DAYS) {
    if (cur !== 'mastered') mk.applyMarks([key], { s: 'mastered' });
  } else if (!cur) {
    mk.applyMarks([key], { s: 'learning' });
  }
}

// ── 跨 set 总览(/alg/progress)────────────────────────────────────

/** key = `${puzzle}/${set}`。 */
export type SrsOverview = Record<string, SrsSetStat>;

/** 扫本地所有 `srs:recs:*`。 */
export function scanLocalSrsOverview(now: number): { overview: SrsOverview; recs: Record<string, SrsRecs> } {
  const overview: SrsOverview = {};
  const all: Record<string, SrsRecs> = {};
  if (typeof window === 'undefined') return { overview, recs: all };
  const prefix = 'srs:recs:';
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
    }
  } catch { return { overview, recs: all }; }
  for (const k of keys) {
    const ps = k.slice(prefix.length);
    try {
      const recs = JSON.parse(localStorage.getItem(k) ?? '{}') as SrsRecs;
      const stat = summarizeSrs(recs, now);
      if (stat.tracked > 0) { overview[ps] = stat; all[ps] = recs; }
    } catch { /* 坏 JSON 跳过 */ }
  }
  return { overview, recs: all };
}

// ── 重置(/alg/progress 的「重置进度」)────────────────────────────────

/** 一次 PUT 最多带几条(服务端上限 2000,留余量)。 */
const MAX_ITEMS_PER_PUT = 1000;

/** 丢掉某一套还没发出的防抖条目(重置前调:否则队列里的旧排期会在清空之后又飞上去)。 */
function dropPendingSrs(puzzle: string, setSlug: string): void {
  for (const [key, v] of [...pending]) if (v.p === puzzle && v.s === setSlug) pending.delete(key);
}

/**
 * 重置一套 set 的记忆排期:每张卡回到「没练过」。
 *
 * 云端不删行,而是写一条空白记录(`n=0`,`t=now`)—— 与单卡 `reset()` 同一套表达:
 * LWW 下它比任何旧记录新,别的设备下次合并就跟着清干净;`n=0` 在统计/队列里一律当新卡。
 * 先云后本地:云端没写成功就整个失败,免得本地清了、下次进页又被合并回来。
 */
export async function resetSetSrs(puzzle: string, setSlug: string): Promise<void> {
  dropPendingSrs(puzzle, setSlug);
  // 用户显式点了重置 → 给云端一次干净的机会。cloudDown 可能是本次会话早先某个瞬时
  // 失败留下的粘滞状态,不清掉的话 cloudPut 直接返回 false,重置会永远「失败」。
  cloudDown = false;
  const local = loadLocalRecs(puzzle, setSlug);
  let keys = Object.keys(local);

  if (cloudEnabled()) {
    const data = await cloudGet<{ recs: SrsRecs }>(`/v1/alg/srs/${puzzle}/${setSlug}`);
    if (data?.recs) keys = [...new Set([...keys, ...Object.keys(data.recs)])];
    const t = Date.now();
    const blanks = keys.map(k => ({ k, ...blankRec(), t }));
    for (let i = 0; i < blanks.length; i += MAX_ITEMS_PER_PUT) {
      const ok = await cloudPut(`/v1/alg/srs/${puzzle}/${setSlug}`, {
        items: blanks.slice(i, i + MAX_ITEMS_PER_PUT),
      });
      if (!ok) throw new Error('srs reset: cloud write failed');
    }
  }

  if (typeof window !== 'undefined') localStorage.removeItem(recsKey(puzzle, setSlug));
  const st = useAlgSrs.getState();
  if (st.puzzle === puzzle && st.set === setSlug && !st.sets) useAlgSrs.setState({ recs: {} });
}

// ── 折叠(整轮过完后丢掉那一轮的排期,见 `alg-sweep.ts` 文件头)────────────

/**
 * 本地丢掉这批 case 的记忆记录。**只动本地** —— 云端那一半由
 * `POST /v1/alg/sweep/:p/:s/fold` 真删行(它会再查一次标记做保险)。
 *
 * 顺手把这批 key 从防抖队列里摘掉:否则刚删完,队列里那几条又飞上去把行建回来。
 */
export function foldLocalSrs(puzzle: string, setSlug: string, keys: readonly string[]): number {
  if (keys.length === 0) return 0;
  const drop = new Set(keys);
  for (const [pk, v] of [...pending]) {
    if (v.p === puzzle && v.s === setSlug && drop.has(v.item.k)) pending.delete(pk);
  }
  const local = loadLocalRecs(puzzle, setSlug);
  let n = 0;
  for (const k of drop) if (k in local) { delete local[k]; n++; }
  if (n === 0) return 0;
  persistLocalRecs(puzzle, setSlug, local);
  const st = useAlgSrs.getState();
  if (st.puzzle === puzzle && st.set === setSlug && !st.sets) {
    const next = { ...st.recs };
    for (const k of drop) delete next[k];
    useAlgSrs.setState({ recs: next });
  }
  return n;
}

/**
 * 多设备收敛:折叠是**真删行**,而另一台设备本地还留着那 302 条 —— 下次合并它会把这些
 * 「本地独有」的记录原样传回云端,折叠就白做了。
 *
 * 所以拿服务器记的「最后一次折叠时刻」当界:上次复习早于它、且**没有手动标记**的本地
 * 记录,判定为属于已折叠的轮,直接丢弃、不回传。返回丢了几条。
 *
 * 已知边界:两台设备同时在练不同轮时,A 完成第 7 轮触发折叠,B 在那之前打的第 8 轮的分
 * 也会被这条规则误伤(t < foldedAt)。代价是那一轮的排期,「过完了」本身不丢;
 * 换掉它要给每条记录加 4-8 字节的轮次标签,不值。
 */
export function pruneFoldedSrs(
  puzzle: string, setSlug: string, foldedAt: number, marked: ReadonlySet<string>,
): number {
  if (foldedAt <= 0) return 0;
  const local = loadLocalRecs(puzzle, setSlug);
  const gone: string[] = [];
  for (const k in local) {
    if (marked.has(k)) continue;
    if (local[k].t < foldedAt) gone.push(k);
  }
  return foldLocalSrs(puzzle, setSlug, gone);
}

/**
 * 清空复习日历 / 连续天数(每日日志)。只有「重置全部」才动它 —— 单套重置不碰,
 * 那是跨 set 的活动流水。云端合并语义是同日取较大值,归零写不掉,只能真删。
 *
 * 返回云端那一份是否也清掉了。删不掉不阻断本地清空(与本模块「云端是可选的」一致),
 * 但要如实告诉调用方 —— 下次同步日历会从云端合并回来。不置 cloudDown:
 * DELETE 端点没上线不代表读写也挂了。
 */
export async function resetSrsDaily(): Promise<{ cloudCleared: boolean }> {
  let cloudCleared = true;
  cloudDown = false;   // 同 resetSetSrs:显式操作不受早先瞬时失败的粘滞状态影响
  if (cloudEnabled()) {
    try {
      await handleApi(await fetch(apiUrl('/v1/alg/srs/daily'), {
        method: 'DELETE', headers: authHeaders(),
      }));
    } catch (e) {
      console.warn('[alg-srs] daily delete failed, cleared locally only', e);
      cloudCleared = false;
    }
  }
  if (typeof window !== 'undefined') localStorage.removeItem(DAILY_KEY);
  useAlgSrs.setState({ daily: {}, sessionCount: 0 });
  return { cloudCleared };
}

export interface SrsDashboardData {
  overview: SrsOverview;
  /** 每套 set 的完整记录(算到期预测 / 薄弱卡用)。 */
  recs: Record<string, SrsRecs>;
  daily: SrsDaily;
  /** 云端是否供了数据(false = 纯本地,UI 提示登录同步)。 */
  fromCloud: boolean;
}

/**
 * 进度总览页的数据源:登录则先冲队列再拉云端,失败/未登录退回纯本地扫描。
 * 永不抛。
 */
export async function loadSrsDashboard(now: number): Promise<SrsDashboardData> {
  const local = scanLocalSrsOverview(now);
  const localDaily = loadDaily();
  if (!cloudEnabled()) {
    return { overview: local.overview, recs: local.recs, daily: localDaily, fromCloud: false };
  }
  await flushSrs();
  const data = await cloudGet<{
    sets: Array<{ puzzle: string; set: string; recs: SrsRecs }>;
    daily: Array<[string, number, number]>;
  }>('/v1/alg/srs');
  if (!data) return { overview: local.overview, recs: local.recs, daily: localDaily, fromCloud: false };

  const recs: Record<string, SrsRecs> = { ...local.recs };
  for (const s of data.sets ?? []) {
    const ps = `${s.puzzle}/${s.set}`;
    recs[ps] = mergeSrs(local.recs[ps] ?? {}, s.recs ?? {}).merged;
  }
  const overview: SrsOverview = {};
  for (const ps in recs) {
    const stat = summarizeSrs(recs[ps], now);
    if (stat.tracked > 0) overview[ps] = stat;
  }
  const cloudDaily: SrsDaily = {};
  for (const [d, n, again] of data.daily ?? []) cloudDaily[d] = [n, again];
  return { overview, recs, daily: mergeDaily(localDaily, cloudDaily), fromCloud: true };
}
