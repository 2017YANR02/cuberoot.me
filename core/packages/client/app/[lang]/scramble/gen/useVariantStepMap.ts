'use client';

import { useEffect, useRef, useState } from 'react';
import { createRustCrossPool, type RustCrossPool } from '@/lib/rust-cross-client';

// 同 useF2leoStepMap:WASM 返回每阶段 6 值是物理面序 z0/z2/z3/z1/x3/x1 = Y/W/O/R/G/B,
// 前端按 BADGE_ORDER [W,Y,R,O,B,G] 存,用 BADGE_TO_FACE 重排,与 comp_steps 逐字节一致。
const BADGE_TO_FACE = [1, 0, 3, 2, 5, 4];

// 变体 → VariantSolverWasm 的 variant 编号。
export const VARIANT_WASM_ID: Record<string, number> = {
  pair: 0,
  eo: 1,
  pseudo: 2,
  pseudo_pair: 3,
};

function remap6(face6: number[]): number[] {
  const out = new Array<number>(6);
  for (let b = 0; b < 6; b++) out[b] = face6[BADGE_TO_FACE[b]];
  return out;
}
function remapStages(faceN: number[], stages: number): number[] {
  const out = new Array<number>(stages * 6);
  for (let s = 0; s < stages; s++) {
    const base = s * 6;
    for (let b = 0; b < 6; b++) out[base + b] = faceN[base + BADGE_TO_FACE[b]];
  }
  return out;
}

/**
 * pair / eo / pseudo / pseudo_pair 浏览器内小表求解(count-only)。同 useF2leoStepMap 两遍:
 *   1) cross(stage 0)单算 → 默认视图秒出;
 *   2) 全 stages×6 值后台补(深阶段慢)。
 * `map` 值随进度从 6 长到 stages×6 长;消费方按阶段 offset 切 6 值。
 * 各变体小表显式逐槽追踪,与大表 comp_steps 逐格 bit-exact。
 */
export interface VariantState {
  map: Map<string, number[]> | null;
  crossReady: boolean;
  fullReady: boolean;
  done: number;
  total: number;
  error: string | null;
}

const IDLE: VariantState = { map: null, crossReady: false, fullReady: false, done: 0, total: 0, error: null };

function poolSize(): number {
  if (typeof navigator === 'undefined') return 2;
  const hc = navigator.hardwareConcurrency || 4;
  const mobile = typeof matchMedia !== 'undefined' && matchMedia('(max-width: 768px)').matches;
  return Math.max(1, Math.min(mobile ? 2 : 4, hc - 1));
}

/**
 * @param variantId VariantSolverWasm 编号(pair=0/eo=1/pseudo=2/pseudo_pair=3)
 * @param stages 阶段数(pair/pseudo/pseudo_pair=4,eo=5)
 */
// 块族变体 → (WASM 池 need, flat 阶段 id 列表)。
// roux223:0=1x2x2 方块 1=1x2x3 2=2x2x2 3=2x2x3 4=双1x2x3;eodr:0=EO 1=EOLine 2=DR。
const BLOCK_SPEC: Record<string, { need: 'roux223' | 'eodr'; ids: number[] }> = {
  '123': { need: 'roux223', ids: [0, 1] },
  '222': { need: 'roux223', ids: [2] },
  '223': { need: 'roux223', ids: [3] },
  '123x2': { need: 'roux223', ids: [4] },
  eoline: { need: 'eodr', ids: [0, 1] },
  dr: { need: 'eodr', ids: [2] },
};

/**
 * 块族(123/123x2/222/223 走 Roux223SolverWasm;eoline/dr 走 EoDrSolverWasm 零表)
 * 浏览器内求解(count-only)。两遍同 useVariantStepMap:首阶段先出,余下阶段后台补。
 */
export function useRoux223StepMap(
  scrambles: string[],
  enabled: boolean,
  variant: string,
): VariantState {
  const [state, setState] = useState<VariantState>(IDLE);
  const poolRef = useRef<RustCrossPool | null>(null);
  const poolNeedRef = useRef<'roux223' | 'eodr' | null>(null);
  const cacheRef = useRef<Map<string, Map<string, number[]>>>(new Map());
  const lastArrRef = useRef<string[] | null>(null);

  useEffect(() => () => { poolRef.current?.terminate(); poolRef.current = null; poolNeedRef.current = null; }, []);

  useEffect(() => {
    if (!enabled) { setState(IDLE); return; }
    const spec = BLOCK_SPEC[variant] ?? BLOCK_SPEC['123'];
    const stageIds = spec.ids;
    if (scrambles.length === 0) {
      setState({ map: new Map(), crossReady: true, fullReady: true, done: 0, total: 0, error: null });
      return;
    }
    if (lastArrRef.current !== scrambles) { lastArrRef.current = scrambles; cacheRef.current.clear(); }

    const full = stageIds.length * 6;
    const map = cacheRef.current.get(variant) ?? new Map<string, number[]>();
    cacheRef.current.set(variant, map);
    const total = scrambles.length;
    const len = (s: string) => map.get(s)?.length ?? 0;
    const countAtLeast = (n: number) => scrambles.reduce((acc, s) => acc + (len(s) >= n ? 1 : 0), 0);

    if (scrambles.every((s) => len(s) >= full)) {
      setState({ map, crossReady: true, fullReady: true, done: total, total, error: null });
      return;
    }

    let cancelled = false;
    let lastFlush = 0;
    const flush = (crossReady: boolean, fullReady: boolean, target: number) => {
      if (!cancelled) setState({ map, crossReady, fullReady, done: countAtLeast(target), total, error: null });
    };
    flush(scrambles.every((s) => len(s) >= 6), false, 6);

    // 跨族切换(roux223 ↔ eodr,装的 WASM 类不同)→ 换池。
    if (poolRef.current && poolNeedRef.current !== spec.need) {
      poolRef.current.terminate();
      poolRef.current = null;
    }
    if (!poolRef.current) {
      poolRef.current = createRustCrossPool(poolSize(), spec.need);
      poolNeedRef.current = spec.need;
    }
    const pool = poolRef.current;
    const solveStage = (s: string, sid: number) =>
      spec.need === 'eodr' ? pool.solveEoDrStage(s, sid) : pool.solveRoux223Stage(s, sid);

    (async () => {
      try {
        await Promise.race([
          pool.ready,
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error('worker load timeout (>60s)')), 60000)),
        ]);

        // pass 1:首阶段 — 默认视图先出(首个 worker 惰性建表后即查表级)。
        const firstTodo = scrambles.filter((s) => len(s) < 6);
        await Promise.all(firstTodo.map(async (s) => {
          try { const v = await solveStage(s, stageIds[0]); if (!cancelled && len(s) < 6) map.set(s, remap6(v)); }
          catch { /* 跳过该打乱 */ }
          const now = Date.now();
          if (now - lastFlush > 120) { lastFlush = now; flush(false, false, 6); }
        }));
        if (cancelled) return;
        flush(true, false, 6);

        // pass 2:余下阶段逐个补(双阶段族的第二阶段;单阶段变体无此遍)。
        if (stageIds.length > 1) {
          const fullTodo = scrambles.filter((s) => len(s) < full);
          await Promise.all(fullTodo.map(async (s) => {
            try {
              const vals = (map.get(s) ?? []).slice(0, 6);
              for (const sid of stageIds.slice(1)) {
                const v = await solveStage(s, sid);
                vals.push(...remap6(v));
              }
              if (!cancelled) map.set(s, vals);
            } catch { /* 跳过 */ }
            const now = Date.now();
            if (now - lastFlush > 400) { lastFlush = now; flush(true, false, full); }
          }));
        }
        flush(true, true, full);
      } catch (e) {
        if (!cancelled) setState((prev) => ({ ...prev, error: String((e as Error)?.message ?? e) }));
      }
    })();

    return () => { cancelled = true; pool.clearQueue(); };
  }, [scrambles, enabled, variant]);

  return state;
}

export function useVariantStepMap(
  scrambles: string[],
  enabled: boolean,
  variantId: number,
  stages: number,
): VariantState {
  const [state, setState] = useState<VariantState>(IDLE);
  const poolRef = useRef<RustCrossPool | null>(null);
  const cacheRef = useRef<Map<number, Map<string, number[]>>>(new Map());
  const lastArrRef = useRef<string[] | null>(null);

  useEffect(() => () => { poolRef.current?.terminate(); poolRef.current = null; }, []);

  useEffect(() => {
    if (!enabled) { setState(IDLE); return; }
    if (scrambles.length === 0) {
      setState({ map: new Map(), crossReady: true, fullReady: true, done: 0, total: 0, error: null });
      return;
    }
    // 打乱集换了(新比赛)→ 清缓存(引用判等,scrambles 由调用方 memo)。
    if (lastArrRef.current !== scrambles) { lastArrRef.current = scrambles; cacheRef.current.clear(); }

    const full = stages * 6;
    const map = cacheRef.current.get(variantId) ?? new Map<string, number[]>();
    cacheRef.current.set(variantId, map);
    const total = scrambles.length;
    const len = (s: string) => map.get(s)?.length ?? 0;
    const countAtLeast = (n: number) => scrambles.reduce((acc, s) => acc + (len(s) >= n ? 1 : 0), 0);

    if (scrambles.every((s) => len(s) >= full)) {
      setState({ map, crossReady: true, fullReady: true, done: total, total, error: null });
      return;
    }

    let cancelled = false;
    let lastFlush = 0;
    const flush = (crossReady: boolean, fullReady: boolean, target: number) => {
      if (!cancelled) setState({ map, crossReady, fullReady, done: countAtLeast(target), total, error: null });
    };
    flush(scrambles.every((s) => len(s) >= 6), false, 6);

    if (!poolRef.current) poolRef.current = createRustCrossPool(poolSize(), 'variant');
    const pool = poolRef.current;

    (async () => {
      try {
        await Promise.race([
          pool.ready,
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error('worker load timeout (>60s)')), 60000)),
        ]);

        // pass 1:cross(stage 0)— 秒级,默认视图先出。
        const crossTodo = scrambles.filter((s) => len(s) < 6);
        await Promise.all(crossTodo.map(async (s) => {
          try { const v = await pool.solveVariantStage(s, variantId, 0); if (!cancelled && len(s) < 6) map.set(s, remap6(v)); }
          catch { /* 跳过该打乱 */ }
          const now = Date.now();
          if (now - lastFlush > 120) { lastFlush = now; flush(false, false, 6); }
        }));
        if (cancelled) return;
        flush(true, false, 6);

        // pass 2:全 stages×6 值后台补(深阶段慢)。
        const fullTodo = scrambles.filter((s) => len(s) < full);
        await Promise.all(fullTodo.map(async (s) => {
          try { const v = await pool.solveVariant(s, variantId); if (!cancelled) map.set(s, remapStages(v, stages)); }
          catch { /* 跳过 */ }
          const now = Date.now();
          if (now - lastFlush > 400) { lastFlush = now; flush(true, false, full); }
        }));
        flush(true, true, full);
      } catch (e) {
        if (!cancelled) setState((prev) => ({ ...prev, error: String((e as Error)?.message ?? e) }));
      }
    })();

    return () => { cancelled = true; pool.clearQueue(); };
  }, [scrambles, enabled, variantId, stages]);

  return state;
}
