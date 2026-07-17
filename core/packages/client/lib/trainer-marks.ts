'use client';

// 公式训练器 per-case 学习标记(学习中/已掌握/搁置 + 难点星标)。
// 未登录:localStorage 本地存;登录:本地 + 云端(/v1/alg/marks)双写,
// 进页时拉云端做单条 last-write-wins 合并(本地较新的差异回传),之后写操作
// 乐观更新本地 + 防抖批量 PUT。清除标记留 { t } 墓碑,否则合并会从云端复活。
import { create } from 'zustand';
import { apiUrl } from './api-base';
import { authHeaders, handleApi } from './admin-api';
import { getSessionToken } from './auth-store';
import { persistItem } from './safe-storage';
import { tr } from '@/i18n/tr';

export type CaseMarkStatus = 'learning' | 'mastered' | 'paused';

export const MARK_STATUS_LABEL: Record<CaseMarkStatus, () => string> = {
  learning: () => tr({ zh: '学习中', en: 'Learning' }),
  mastered: () => tr({ zh: '已掌握', en: 'Mastered' }),
  paused: () => tr({ zh: '搁置', en: 'Paused' }),
};

/** select 页画笔:三个状态 + 星标 + 清除(null = 普通选择模式)。 */
export type TrainerMarkBrush = CaseMarkStatus | 'star' | 'clear';

/** 一条标记:s = 状态(无 = 未学),f = 星标,t = 最后修改时间(LWW 用)。s/f 全空 = 墓碑。 */
export interface CaseMark {
  s?: CaseMarkStatus;
  f?: 1;
  t: number;
}
export type CaseMarks = Record<string, CaseMark>;

const marksKey = (p: string, s: string) => `trainer:marks:${p}/${s}`;

const loadLocal = (p: string, s: string): CaseMarks => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(marksKey(p, s));
    if (raw) return JSON.parse(raw) as CaseMarks;
  } catch { /* ignore */ }
  return {};
};

const persistLocal = (p: string, s: string, marks: CaseMarks) => {
  if (typeof window === 'undefined') return;
  persistItem(marksKey(p, s), JSON.stringify(marks));
};

/** 服务器批量 PUT 的一条(k=caseKey;s=null 且 f=false ⟹ 服务器删行)。 */
interface PutItem { k: string; s: CaseMarkStatus | null; f: boolean; t: number }

const toPutItem = (k: string, m: CaseMark): PutItem => ({ k, s: m.s ?? null, f: m.f === 1, t: m.t });

/**
 * 本地 vs 云端单条 LWW 合并(纯函数,tests/trainer-marks.test.ts 直测):
 * 每个 key 取 t 大的一边;本地更新(含本地墓碑但云端有行)的差异集回传服务器。
 * 云端没有该 key 时,本地墓碑不用回传(服务器本来就没有这行)。
 */
export function mergeMarks(local: CaseMarks, cloud: CaseMarks): { merged: CaseMarks; toUpload: PutItem[] } {
  const merged: CaseMarks = {};
  const toUpload: PutItem[] = [];
  const keys = new Set([...Object.keys(local), ...Object.keys(cloud)]);
  for (const k of keys) {
    const l = local[k];
    const c = cloud[k];
    if (l && c) {
      if (l.t > c.t) {
        merged[k] = l;
        toUpload.push(toPutItem(k, l));
      } else {
        merged[k] = c;
      }
    } else if (l) {
      merged[k] = l;
      // 本地实标记 → 上云;本地墓碑而云端无行 → 不用传
      if (l.s || l.f) toUpload.push(toPutItem(k, l));
    } else if (c) {
      merged[k] = c;
    }
  }
  return { merged, toUpload };
}

/** 防抖批量上云的待发队列。键带 set 前缀:防抖窗口内切 set,旧 set 的条目不能发错路径。 */
let pending = new Map<string, { p: string; s: string; item: PutItem }>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

async function putItems(puzzle: string, set: string, items: PutItem[]): Promise<void> {
  await handleApi(await fetch(apiUrl(`/v1/alg/marks/${puzzle}/${set}`), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ items }),
  }));
}

/** 把当前 pending 队列按 (puzzle,set) 分组发出;失败的塞回队列等下次连带重试。 */
async function flushPending(): Promise<void> {
  flushTimer = null;
  if (pending.size === 0) return;
  const batch = pending;
  pending = new Map();
  // 按 (puzzle, set) 分组发送(防抖窗口内切了 set 会出现多组)
  const groups = new Map<string, { p: string; s: string; items: PutItem[] }>();
  for (const [, v] of batch) {
    const gk = `${v.p}/${v.s}`;
    const g = groups.get(gk) ?? { p: v.p, s: v.s, items: [] };
    g.items.push(v.item);
    groups.set(gk, g);
  }
  await Promise.all([...groups.values()].map((g) =>
    putItems(g.p, g.s, g.items).catch((e) => {
      // 失败塞回队列,下一次写操作会连带重试;不覆盖期间产生的更新版本
      console.warn('[trainer-marks] sync failed, will retry on next change', e);
      for (const it of g.items) {
        const key = `${g.p}/${g.s}|${it.k}`;
        if (!pending.has(key)) pending.set(key, { p: g.p, s: g.s, item: it });
      }
    }),
  ));
}

function queueUpload(puzzle: string, set: string, items: PutItem[]) {
  if (!getSessionToken()) return; // 未登录:纯本地
  for (const it of items) pending.set(`${puzzle}/${set}|${it.k}`, { p: puzzle, s: set, item: it });
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => { void flushPending(); }, 800);
}

/** 立即冲掉防抖队列并等待落库(进度总览页拉聚合前调,避免刚标的没上云)。 */
export async function flushMarks(): Promise<void> {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  await flushPending();
}

interface TrainerMarksState {
  puzzle: string | null;
  set: string | null;
  marks: CaseMarks;
  /** 进 select/run 页调用:装本地,登录则再拉云端合并(带竞态 token)。 */
  loadMarks: (puzzle: string, set: string) => void;
  /** 单个/批量写标记:patch.s = null 清状态,f = false 清星标;两者全空 → 墓碑。 */
  applyMarks: (keys: string[], patch: { s?: CaseMarkStatus | null; f?: boolean }) => void;
}

let loadToken = 0;

export const useTrainerMarks = create<TrainerMarksState>((set, get) => ({
  puzzle: null,
  set: null,
  marks: {},

  loadMarks: (puzzle, setSlug) => {
    const token = ++loadToken;
    set({ puzzle, set: setSlug, marks: loadLocal(puzzle, setSlug) });
    if (!getSessionToken()) return;
    (async () => {
      const data = await handleApi<{ marks: CaseMarks }>(
        await fetch(apiUrl(`/v1/alg/marks/${puzzle}/${setSlug}`), { headers: authHeaders(false) }),
      );
      if (token !== loadToken) return; // 已切到别的 set
      // 合并基准用「此刻」的本地(拉取期间用户可能已经涂了几个)
      const st = get();
      if (st.puzzle !== puzzle || st.set !== setSlug) return;
      const { merged, toUpload } = mergeMarks(st.marks, data.marks);
      persistLocal(puzzle, setSlug, merged);
      set({ marks: merged });
      if (toUpload.length > 0) queueUpload(puzzle, setSlug, toUpload);
    })().catch((e) => console.warn('[trainer-marks] cloud load failed, local only', e));
  },

  applyMarks: (keys, patch) => {
    const { puzzle, set: setSlug, marks } = get();
    if (!puzzle || !setSlug || keys.length === 0) return;
    const t = Date.now();
    const next = { ...marks };
    const items: PutItem[] = [];
    for (const k of keys) {
      const cur = next[k];
      const m: CaseMark = { t };
      const s = patch.s === undefined ? cur?.s : (patch.s ?? undefined);
      const f = patch.f === undefined ? cur?.f === 1 : patch.f;
      if (s) m.s = s;
      if (f) m.f = 1;
      // 无变化不写(避免把 t 推新触发无谓上云)
      if ((cur?.s ?? undefined) === m.s && (cur?.f === 1) === (m.f === 1)) continue;
      next[k] = m; // s/f 全空也保留 —— 墓碑,防云端复活
      items.push(toPutItem(k, m));
    }
    if (items.length === 0) return;
    persistLocal(puzzle, setSlug, next);
    set({ marks: next });
    queueUpload(puzzle, setSlug, items);
  },
}));

/** 展示态便捷读取:未标记与墓碑都归一为 undefined / false。 */
export const markStatus = (marks: CaseMarks, key: string): CaseMarkStatus | undefined => marks[key]?.s;
export const markStarred = (marks: CaseMarks, key: string): boolean => marks[key]?.f === 1;

// ── 跨 set 学习进度总览(/alg/progress) ──────────────────────────────

/** 一套 set 的标记计数(分子);total 分母来自 /v1/alg/sets 的 count,不在这里。 */
export interface SetMarkSummary { learning: number; mastered: number; paused: number; starred: number }
/** key = `${puzzle}/${set}`。 */
export type MarkOverview = Record<string, SetMarkSummary>;

const emptySummary = (): SetMarkSummary => ({ learning: 0, mastered: 0, paused: 0, starred: 0 });

/** 把一套 set 的 CaseMarks 归约成计数(墓碑 = 无 s 无 f,不计)。 */
export function summarizeMarks(marks: CaseMarks): SetMarkSummary {
  const sum = emptySummary();
  for (const k in marks) {
    const m = marks[k];
    if (m.s === 'learning') sum.learning++;
    else if (m.s === 'mastered') sum.mastered++;
    else if (m.s === 'paused') sum.paused++;
    if (m.f === 1) sum.starred++;
  }
  return sum;
}

/** 扫本地 localStorage 里所有 `trainer:marks:*`,聚合成跨 set 总览(未登录/离线用)。 */
export function scanLocalOverview(): MarkOverview {
  const out: MarkOverview = {};
  if (typeof window === 'undefined') return out;
  const prefix = 'trainer:marks:';
  let raw: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) raw.push(k);
    }
  } catch { return out; }
  for (const k of raw) {
    const ps = k.slice(prefix.length); // `${puzzle}/${set}`
    try {
      const marks = JSON.parse(localStorage.getItem(k) ?? '{}') as CaseMarks;
      const sum = summarizeMarks(marks);
      if (sum.learning || sum.mastered || sum.paused || sum.starred) out[ps] = sum;
    } catch { /* 坏 JSON 跳过 */ }
  }
  return out;
}

/** 拉云端跨 set 聚合(需登录)。 */
async function fetchCloudOverview(): Promise<MarkOverview> {
  const data = await handleApi<{ sets: Array<{ puzzle: string; set: string } & SetMarkSummary> }>(
    await fetch(apiUrl('/v1/alg/marks'), { headers: authHeaders(false) }),
  );
  const out: MarkOverview = {};
  for (const s of data.sets) {
    out[`${s.puzzle}/${s.set}`] = {
      learning: s.learning, mastered: s.mastered, paused: s.paused, starred: s.starred,
    };
  }
  return out;
}

/** 云端为主、本地补漏(某 set 云端还没有 = 未同步的访客期标记):按 set 取云端否则本地。 */
export function combineOverviews(cloud: MarkOverview, local: MarkOverview): MarkOverview {
  const out: MarkOverview = { ...local };
  for (const k in cloud) out[k] = cloud[k];
  return out;
}

/**
 * 学习进度总览的数据源:
 *   - 登录:先冲防抖队列(把刚标的推上云),拉云端聚合,再用本地补云端还没有的 set。
 *   - 未登录:纯本地扫描。
 * 云端失败时兜底本地,永不抛。
 */
export async function loadMarkOverview(): Promise<MarkOverview> {
  const local = scanLocalOverview();
  if (!getSessionToken()) return local;
  try {
    await flushMarks();
    const cloud = await fetchCloudOverview();
    return combineOverviews(cloud, local);
  } catch (e) {
    console.warn('[trainer-marks] overview cloud load failed, local only', e);
    return local;
  }
}
