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
  recs: SrsRecs;
  daily: SrsDaily;
  /** 本场已评分次数(用于「今天练了多少」的即时反馈)。 */
  sessionCount: number;
  /** 进 run 页调用:装本地,登录则拉云端合并。 */
  loadSrs: (puzzle: string, set: string) => void;
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
  recs: {},
  daily: {},
  sessionCount: 0,

  loadSrs: (puzzle, setSlug) => {
    const token = ++loadToken;
    set({ puzzle, set: setSlug, recs: loadLocalRecs(puzzle, setSlug), daily: loadDaily() });
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

  grade: (key, g) => {
    const { puzzle, set: setSlug, recs, daily } = get();
    const now = Date.now();
    const rec = scheduleNext(recs[key], g, now, Math.random() * 2 - 1);
    const nextRecs = { ...recs, [key]: rec };
    const nextDaily = bumpDaily(daily, now, g);
    if (puzzle && setSlug) {
      persistLocalRecs(puzzle, setSlug, nextRecs);
      queueUpload(puzzle, setSlug, [{ k: key, ...rec }]);
    }
    persistDaily(nextDaily);
    set({ recs: nextRecs, daily: nextDaily, sessionCount: get().sessionCount + 1 });
    return rec;
  },

  restore: (key, prev) => {
    const { puzzle, set: setSlug, recs } = get();
    const nextRecs = { ...recs };
    if (prev) nextRecs[key] = prev;
    else delete nextRecs[key];
    if (puzzle && setSlug) {
      persistLocalRecs(puzzle, setSlug, nextRecs);
      // 撤销也要上云,否则别的设备还留着那一次误评
      queueUpload(puzzle, setSlug, [{ k: key, ...(prev ?? { d: 0, iv: 0, ef: 2.4, n: 0, l: 0, st: 0, t: Date.now(), h: 0 }) }]);
    }
    set({ recs: nextRecs, sessionCount: Math.max(0, get().sessionCount - 1) });
  },

  reset: (key) => {
    const { puzzle, set: setSlug, recs } = get();
    const blank: SrsRec = { d: 0, iv: 0, ef: 2.4, n: 0, l: 0, st: 0, t: Date.now(), h: 0 };
    const nextRecs = { ...recs, [key]: blank };
    if (puzzle && setSlug) {
      persistLocalRecs(puzzle, setSlug, nextRecs);
      queueUpload(puzzle, setSlug, [{ k: key, ...blank }]);
    }
    set({ recs: nextRecs });
  },
}));

// ── 记忆进展 → 学习标记的自动升降 ───────────────────────────────────

/**
 * 按记忆进展维护「学习中 / 已掌握」标记(记忆模式与计时训练共用这一份):
 *   第一次记住 → 学习中;间隔涨过 MASTER_DAYS → 已掌握;已掌握的忘了 → 打回学习中。
 * 「搁置」是用户明确表达的意愿,任何情况下都不动。调用方负责判断偏好开关。
 */
export function autoMarkFromSrs(key: string, next: SrsRec, grade: SrsGrade): void {
  const mk = useTrainerMarks.getState();
  const cur = markStatus(mk.marks, key);
  if (cur === 'paused') return;
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
