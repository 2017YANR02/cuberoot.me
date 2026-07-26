'use client';

// 公式训练器 per-case 学习标记(不熟/已掌握/搁置 + 难点星标)。
// 未登录:localStorage 本地存;登录:本地 + 云端(/v1/alg/marks)双写,
// 进页时拉云端做单条 last-write-wins 合并(本地较新的差异回传),之后写操作
// 乐观更新本地 + 防抖批量 PUT。清除标记留 { t } 墓碑,否则合并会从云端复活。
import { create } from 'zustand';
import { apiUrl } from './api-base';
import { authHeaders, handleApi } from './admin-api';
import { getSessionToken } from './auth-store';
import { persistItem } from './safe-storage';
import { groupKeysBySet } from './trainer-case-key';
import { tr } from '@/i18n/tr';

export type CaseMarkStatus = 'learning' | 'mastered' | 'paused';

export const MARK_STATUS_LABEL: Record<CaseMarkStatus, () => string> = {
  learning: () => tr({ zh: '不熟', en: 'Shaky' }),
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

/** 一次 PUT 最多带几条(服务端上限 2000,留余量)。 */
const MAX_ITEMS_PER_PUT = 1000;

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

/** 丢掉某一套还没发出的防抖条目(重置前调:否则队列里的旧标记会在删完之后又飞上去)。 */
function dropPending(puzzle: string, setSlug: string): void {
  for (const [key, v] of [...pending]) if (v.p === puzzle && v.s === setSlug) pending.delete(key);
}

/**
 * 在一张标记表上套 patch(纯函数,单集与合练共用)。
 * 返回新表 + 需要上云的条目;没有实际变化的 key 一律跳过,免得把 t 推新触发无谓同步。
 */
function applyPatchTo(
  marks: CaseMarks, keys: readonly string[],
  patch: { s?: CaseMarkStatus | null; f?: boolean }, t: number,
): { next: CaseMarks; items: PutItem[] } {
  const next = { ...marks };
  const items: PutItem[] = [];
  for (const k of keys) {
    const cur = next[k];
    const m: CaseMark = { t };
    const s = patch.s === undefined ? cur?.s : (patch.s ?? undefined);
    const f = patch.f === undefined ? cur?.f === 1 : patch.f;
    if (s) m.s = s;
    if (f) m.f = 1;
    if ((cur?.s ?? undefined) === m.s && (cur?.f === 1) === (m.f === 1)) continue;
    next[k] = m; // s/f 全空也保留 —— 墓碑,防云端复活
    items.push(toPutItem(k, m));
  }
  return { next, items };
}

interface TrainerMarksState {
  puzzle: string | null;
  set: string | null;
  /**
   * 合练会话的成员 set(单集为 null)。非空时 `marks` 的键带 set 前缀(`zbll:U|Ua`),
   * 但落地与上云仍按各自 set 的原始键 —— 合练里标的「已掌握」,单独进 ZBLL 也看得到。
   */
  sets: string[] | null;
  marks: CaseMarks;
  /** 进 select/run 页调用:装本地,登录则再拉云端合并(带竞态 token)。 */
  loadMarks: (puzzle: string, set: string) => void;
  /** 合练版:一次装 N 个 set,合并成一张带前缀的表。 */
  loadMarksMulti: (puzzle: string, sets: string[]) => void;
  /** 单个/批量写标记:patch.s = null 清状态,f = false 清星标;两者全空 → 墓碑。 */
  applyMarks: (keys: string[], patch: { s?: CaseMarkStatus | null; f?: boolean }) => void;
}

let loadToken = 0;

/** 拉一个 set 的云端标记(失败返回 null,调用方退化成纯本地)。 */
async function fetchSetMarks(puzzle: string, setSlug: string): Promise<CaseMarks | null> {
  try {
    const data = await handleApi<{ marks: CaseMarks }>(
      await fetch(apiUrl(`/v1/alg/marks/${puzzle}/${setSlug}`), { headers: authHeaders(false) }),
    );
    return data.marks;
  } catch (e) {
    console.warn('[trainer-marks] cloud load failed, local only', e);
    return null;
  }
}

export const useTrainerMarks = create<TrainerMarksState>((set, get) => ({
  puzzle: null,
  set: null,
  sets: null,
  marks: {},

  loadMarks: (puzzle, setSlug) => {
    const token = ++loadToken;
    set({ puzzle, set: setSlug, sets: null, marks: loadLocal(puzzle, setSlug) });
    if (!getSessionToken()) return;
    void (async () => {
      const cloud = await fetchSetMarks(puzzle, setSlug);
      if (!cloud || token !== loadToken) return; // 已切到别的 set
      // 合并基准用「此刻」的本地(拉取期间用户可能已经涂了几个)
      const st = get();
      if (st.puzzle !== puzzle || st.set !== setSlug) return;
      const { merged, toUpload } = mergeMarks(st.marks, cloud);
      persistLocal(puzzle, setSlug, merged);
      set({ marks: merged });
      if (toUpload.length > 0) queueUpload(puzzle, setSlug, toUpload);
    })();
  },

  loadMarksMulti: (puzzle, sets) => {
    const token = ++loadToken;
    const prefixed = (slug: string, m: CaseMarks): CaseMarks => {
      const out: CaseMarks = {};
      for (const k in m) out[`${slug}:${k}`] = m[k];
      return out;
    };
    const local: CaseMarks = {};
    for (const slug of sets) Object.assign(local, prefixed(slug, loadLocal(puzzle, slug)));
    set({ puzzle, set: sets.join('+'), sets: [...sets], marks: local });
    if (!getSessionToken()) return;
    void (async () => {
      // 每个成员 set 各自合并、各自回传 —— 云端仍是「一套 set 一张表」,合练不引入新表
      const results = await Promise.all(sets.map(async slug => ({ slug, cloud: await fetchSetMarks(puzzle, slug) })));
      if (token !== loadToken) return;
      const merged: CaseMarks = { ...get().marks };
      for (const { slug, cloud } of results) {
        if (!cloud) continue;
        const cur = loadLocal(puzzle, slug);
        const r = mergeMarks(cur, cloud);
        persistLocal(puzzle, slug, r.merged);
        Object.assign(merged, prefixed(slug, r.merged));
        if (r.toUpload.length > 0) queueUpload(puzzle, slug, r.toUpload);
      }
      if (token === loadToken) set({ marks: merged });
    })();
  },

  applyMarks: (keys, patch) => {
    const { puzzle, set: setSlug, sets, marks } = get();
    if (!puzzle || !setSlug || keys.length === 0) return;
    const t = Date.now();

    if (!sets) {
      const { next, items } = applyPatchTo(marks, keys, patch, t);
      if (items.length === 0) return;
      persistLocal(puzzle, setSlug, next);
      set({ marks: next });
      queueUpload(puzzle, setSlug, items);
      return;
    }

    // 合练:按成员 set 拆开,各自落各自的命名空间(store 里那张带前缀的表同步更新)
    const merged = { ...marks };
    let changed = false;
    for (const [slug, group] of groupKeysBySet(keys, sets)) {
      if (!slug) continue; // 合练里出现无前缀 key = 脏数据,不猜它属于谁
      const cur = loadLocal(puzzle, slug);
      const { next, items } = applyPatchTo(cur, group.map(g => g.raw), patch, t);
      if (items.length === 0) continue;
      persistLocal(puzzle, slug, next);
      queueUpload(puzzle, slug, items);
      for (const { key, raw } of group) if (next[raw]) merged[key] = next[raw];
      changed = true;
    }
    if (changed) set({ marks: merged });
  },
}));

/**
 * 清空一套 set 的全部标记(/alg/progress 的「重置」)。
 *
 * 走的是已有的「清除」语义,不需要新端点:PUT 一条 `s=null, f=false` 服务端就删行(带 LWW)。
 * 顺序是**先云后本地** —— 云端没删掉就整个失败,免得本地清了、下次进页又被云端合并回来。
 * 本地留墓碑而不是整张扔掉,理由同 applyMarks:光删本地,合并时会从别处复活。
 */
export async function resetSetMarks(puzzle: string, setSlug: string): Promise<void> {
  dropPending(puzzle, setSlug);
  const local = loadLocal(puzzle, setSlug);
  const t = Date.now();

  if (!getSessionToken()) {
    if (typeof window !== 'undefined') localStorage.removeItem(marksKey(puzzle, setSlug));
  } else {
    const cloud = await fetchSetMarks(puzzle, setSlug);
    const keys = [...new Set([...Object.keys(local), ...Object.keys(cloud ?? {})])];
    // 已经是墓碑、云端也没有的键不用再发一次
    const live = keys.filter(k => local[k]?.s || local[k]?.f === 1 || cloud?.[k]);
    for (let i = 0; i < live.length; i += MAX_ITEMS_PER_PUT) {
      const items = live.slice(i, i + MAX_ITEMS_PER_PUT).map(k => ({ k, s: null, f: false, t }));
      await putItems(puzzle, setSlug, items);
    }
    const tombs: CaseMarks = {};
    for (const k of keys) tombs[k] = { t };
    persistLocal(puzzle, setSlug, tombs);
  }

  // store 里正好装着这一套(用户从训练页跳过来的)→ 同步内存态,免得返回时看到旧标记
  const st = useTrainerMarks.getState();
  if (st.puzzle === puzzle && st.set === setSlug && !st.sets) {
    useTrainerMarks.setState({ marks: loadLocal(puzzle, setSlug) });
  }
}

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
