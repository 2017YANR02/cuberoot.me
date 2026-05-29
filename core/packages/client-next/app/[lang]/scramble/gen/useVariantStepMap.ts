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
