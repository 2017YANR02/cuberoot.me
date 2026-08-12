'use client';

/**
 * 「过遍」进度的存取层:localStorage 落地 + 登录后云端同步 + zustand store。
 * 口径与折叠规则全在纯函数 `alg-sweep.ts` 的文件头,这里只管存取。
 *
 * 同步策略与 `trainer-marks` / `alg-srs-store` 一致:进页装本地 → 拉云端合并 →
 * 写操作乐观更新本地 + 防抖 PUT。**云端是可选的**:端点还没上线(404 / 离线)时整套
 * 退化成纯本地,不弹错、不阻塞。
 */
import { create } from 'zustand';
import { apiUrl } from './api-base';
import { authHeaders, handleApi } from './admin-api';
import { getSessionToken } from './auth-store';
import { persistItem } from './safe-storage';
import { useTrainerMarks } from './trainer-marks';
import { useAlgSrs, foldLocalSrs, pruneFoldedSrs } from './alg-srs-store';
import {
  emptySweep, foldableKeys, markSwept, mergeSweep, setCursor, sweepKey,
  type SetSweep, type SweepCursor,
} from './alg-sweep';

const storeKey = (p: string, s: string) => `sweep:${p}/${s}`;

/** 落地格式 = SetSweep + 服务器记的最后折叠时刻。 */
interface Stored extends SetSweep { foldedAt: number }

const loadLocal = (p: string, s: string): Stored => {
  if (typeof window === 'undefined') return { ...emptySweep(), foldedAt: 0 };
  try {
    const raw = localStorage.getItem(storeKey(p, s));
    if (raw) {
      const v = JSON.parse(raw) as Partial<Stored>;
      return {
        counts: v.counts ?? {},
        cursor: v.cursor ?? null,
        t: v.t ?? 0,
        foldedAt: v.foldedAt ?? 0,
      };
    }
  } catch { /* 坏 JSON 当空 */ }
  return { ...emptySweep(), foldedAt: 0 };
};

const persistLocal = (p: string, s: string, v: Stored) => {
  if (typeof window === 'undefined') return;
  persistItem(storeKey(p, s), JSON.stringify(v));
};

// ── 云端(端点缺失即静默降级为纯本地)────────────────────────────────

let cloudDown = false;
const cloudEnabled = () => !cloudDown && !!getSessionToken();

interface Wire { sweeps: Record<string, number>; cursor: SweepCursor | null; foldedAt: number; t: number }

async function cloudGet(puzzle: string, set: string): Promise<Wire | null> {
  if (!cloudEnabled()) return null;
  try {
    return await handleApi<Wire>(
      await fetch(apiUrl(`/v1/alg/sweep/${puzzle}/${set}`), { headers: authHeaders(false) }),
    );
  } catch (e) {
    cloudDown = true;
    console.warn('[alg-sweep] cloud unavailable, local only', e);
    return null;
  }
}

/** 防抖上传:一个 set 一份整体状态,没有逐条队列 —— 它本来就只有几 KB。 */
let putTimer: ReturnType<typeof setTimeout> | null = null;
let putFor: { p: string; s: string } | null = null;

async function flushPut(): Promise<void> {
  putTimer = null;
  const target = putFor;
  putFor = null;
  if (!target || !cloudEnabled()) return;
  const { p, s } = target;
  const cur = loadLocal(p, s);
  try {
    const wire = await handleApi<Wire>(await fetch(apiUrl(`/v1/alg/sweep/${p}/${s}`), {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ sweeps: cur.counts, cursor: cur.cursor, t: cur.t }),
    }));
    // 服务端回的是合并后的权威值(别的设备可能刚推过)—— 直接采纳
    adopt(p, s, { counts: wire.sweeps ?? {}, cursor: wire.cursor ?? null, t: wire.t ?? cur.t }, wire.foldedAt ?? cur.foldedAt);
  } catch (e) {
    console.warn('[alg-sweep] sync failed, will retry on next change', e);
  }
}

function queuePut(p: string, s: string) {
  if (!cloudEnabled()) return;
  putFor = { p, s };
  if (putTimer) clearTimeout(putTimer);
  putTimer = setTimeout(() => { void flushPut(); }, 1000);
}

/** 立即冲掉防抖队列(离页 / 进度总览页拉聚合前调)。 */
export async function flushSweep(): Promise<void> {
  if (putTimer) { clearTimeout(putTimer); putTimer = null; }
  await flushPut();
}

/** 落地 + 进 store(仅当 store 当前正指着这个 set)。 */
function adopt(p: string, s: string, sw: SetSweep, foldedAt: number) {
  persistLocal(p, s, { ...sw, foldedAt });
  const st = useAlgSweep.getState();
  if (st.puzzle === p && st.set === s) useAlgSweep.setState({ sweep: sw, foldedAt });
}

/** 当前有手动状态标记的 case key —— 折叠永远绕开它们。 */
function markedKeys(): Set<string> {
  const { marks } = useTrainerMarks.getState();
  const out = new Set<string>();
  for (const k in marks) if (marks[k].s) out.add(k);
  return out;
}

// ── store ───────────────────────────────────────────────────────────

interface AlgSweepState {
  puzzle: string | null;
  set: string | null;
  sweep: SetSweep;
  /** 服务器记的最后一次折叠时刻(纯本地时恒 0)。 */
  foldedAt: number;
  /** 进 run 页调用:装本地,登录则再拉云端合并。合练不用(sweep 是单集概念)。 */
  loadSweep: (puzzle: string, set: string) => void;
  /**
   * 这个范围整轮过完了。记一笔,并在记录数过水位时折叠掉这一轮里没有手动标记的记忆排期。
   * `roundKeys` = 本轮全部 case key。
   */
  recordSweep: (scope: string | null, roundKeys: readonly string[]) => void;
  /** 挪游标(本轮过到第几个)。同范围内只进不退。 */
  moveCursor: (scope: string | null, pos: number, total: number) => void;
}

let loadToken = 0;

export const useAlgSweep = create<AlgSweepState>((set, get) => ({
  puzzle: null,
  set: null,
  sweep: emptySweep(),
  foldedAt: 0,

  loadSweep: (puzzle, setSlug) => {
    const token = ++loadToken;
    const local = loadLocal(puzzle, setSlug);
    set({ puzzle, set: setSlug, sweep: { counts: local.counts, cursor: local.cursor, t: local.t }, foldedAt: local.foldedAt });
    if (!cloudEnabled()) return;
    void (async () => {
      const wire = await cloudGet(puzzle, setSlug);
      if (!wire || token !== loadToken) return;
      const st = get();
      if (st.puzzle !== puzzle || st.set !== setSlug) return;
      const cloud: SetSweep = { counts: wire.sweeps ?? {}, cursor: wire.cursor ?? null, t: wire.t ?? 0 };
      const { merged, dirty } = mergeSweep(st.sweep, cloud);
      const foldedAt = Math.max(st.foldedAt, wire.foldedAt ?? 0);
      adopt(puzzle, setSlug, merged, foldedAt);
      // 别的设备折叠过 ⟹ 本地那批陈旧记录要跟着掉,否则下次合并又飞回云端
      pruneFoldedSrs(puzzle, setSlug, foldedAt, markedKeys());
      if (dirty) queuePut(puzzle, setSlug);
    })();
  },

  recordSweep: (scope, roundKeys) => {
    const { puzzle, set: setSlug, sweep } = get();
    if (!puzzle || !setSlug) return;
    const now = Date.now();
    const next = markSwept(sweep, scope, now);
    set({ sweep: next });
    persistLocal(puzzle, setSlug, { ...next, foldedAt: get().foldedAt });
    queuePut(puzzle, setSlug);

    // 折叠:水位以下一个都不折(库内集永远走这条,行为与今天完全一致)
    const recs = useAlgSrs.getState().recs;
    const keys = foldableKeys(roundKeys, k => k in recs, markedKeys(), Object.keys(recs).length);
    if (keys.length === 0) return;
    foldLocalSrs(puzzle, setSlug, keys);
    if (!cloudEnabled()) return;
    void (async () => {
      try {
        const res = await handleApi<{ foldedAt: number }>(
          await fetch(apiUrl(`/v1/alg/sweep/${puzzle}/${setSlug}/fold`), {
            method: 'POST', headers: authHeaders(), body: JSON.stringify({ keys }),
          }),
        );
        const st = get();
        if (st.puzzle === puzzle && st.set === setSlug) {
          const foldedAt = Math.max(st.foldedAt, res.foldedAt ?? 0);
          set({ foldedAt });
          persistLocal(puzzle, setSlug, { ...get().sweep, foldedAt });
        }
      } catch (e) {
        // 云端没折成不影响本地已折 —— 下次进页合并会把它们拉回来,再完成一轮时重折
        console.warn('[alg-sweep] fold failed, cloud still holds those recs', e);
      }
    })();
  },

  moveCursor: (scope, pos, total) => {
    const { puzzle, set: setSlug, sweep } = get();
    if (!puzzle || !setSlug) return;
    const next = setCursor(sweep, { scope: sweepKey(scope), pos, total }, Date.now());
    if (next === sweep) return;   // 没实质变化:不落盘、不上云
    set({ sweep: next });
    persistLocal(puzzle, setSlug, { ...next, foldedAt: get().foldedAt });
    queuePut(puzzle, setSlug);
  },
}));

/**
 * 不挂载训练器也要读游标的地方(如 `/alg/lsll` 的「继续第 67 轮」)。
 * 先给本地那份(同步,首屏就能画),登录时再拉云端覆盖。
 */
export async function readSweep(puzzle: string, setSlug: string): Promise<SetSweep> {
  const local = loadLocal(puzzle, setSlug);
  const localSweep: SetSweep = { counts: local.counts, cursor: local.cursor, t: local.t };
  const wire = await cloudGet(puzzle, setSlug);
  if (!wire) return localSweep;
  const { merged } = mergeSweep(localSweep, { counts: wire.sweeps ?? {}, cursor: wire.cursor ?? null, t: wire.t ?? 0 });
  persistLocal(puzzle, setSlug, { ...merged, foldedAt: Math.max(local.foldedAt, wire.foldedAt ?? 0) });
  return merged;
}

/** 同步读本地那一份(SSR 安全:服务端返回空)。 */
export const readLocalSweep = (puzzle: string, setSlug: string): SetSweep => {
  const v = loadLocal(puzzle, setSlug);
  return { counts: v.counts, cursor: v.cursor, t: v.t };
};
