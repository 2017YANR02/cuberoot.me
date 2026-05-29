'use client';

import { useEffect, useRef, useState } from 'react';
import { createRustCrossPool, type RustCrossPool } from '@/lib/rust-cross-client';

export type StepMetric = 'xc' | 'xxc' | 'xxxc';
const VARIANT: Record<StepMetric, number> = { xc: 1, xxc: 2, xxxc: 3 };

// BADGE_ORDER [White,Yellow,Red,Orange,Blue,Green] → Rust 面序号 (D0 U1 L2 R3 F4 B5)。
// solved 朝向 U=White D=Yellow F=Green B=Blue R=Red L=Orange(见 lib/cross-solver),
// 故 White=面1(U)、Yellow=面0(D)、Red=面3(R)、Orange=面2(L)、Blue=面5(B)、Green=面4(F)。
const BADGE_TO_FACE = [1, 0, 3, 2, 5, 4];
const FACES6 = [0, 1, 2, 3, 4, 5];

export interface StepMapState {
  /** scramble → BADGE_ORDER 6 个最优步数(当前 metric);未就绪时为已算出的部分。 */
  map: Map<string, number[]> | null;
  ready: boolean;
  done: number;
  total: number;
  error: string | null;
}

const IDLE: StepMapState = { map: null, ready: false, done: 0, total: 0, error: null };

function poolSize(): number {
  if (typeof navigator === 'undefined') return 2;
  const hc = navigator.hardwareConcurrency || 4;
  const mobile = typeof matchMedia !== 'undefined' && matchMedia('(max-width: 768px)').matches;
  return Math.max(1, Math.min(mobile ? 2 : 4, hc - 1));
}

/**
 * 给一组打乱按 metric(xc/xxc/xxxc)算每色最优步数(BADGE_ORDER 6 值/打乱),复用
 * Rust→WASM cross-step 求解器(每面一次 solveFace)。懒起 worker 池:metric=null 不建池、
 * 零开销(cross 由调用方走 lib 实时算)。按 metric 缓存,换 base 不重算;换打乱集清缓存。
 */
export function useStepMap(scrambles: string[], metric: StepMetric | null): StepMapState {
  const [state, setState] = useState<StepMapState>(IDLE);
  const poolRef = useRef<RustCrossPool | null>(null);
  const cacheRef = useRef<Map<StepMetric, Map<string, number[]>>>(new Map());
  const lastArrRef = useRef<string[] | null>(null);

  useEffect(() => () => { poolRef.current?.terminate(); poolRef.current = null; }, []);

  useEffect(() => {
    if (!metric || scrambles.length === 0) { setState(IDLE); return; }

    // 打乱集换了(新比赛)→ 清缓存。scrambles 由调用方 memo 出稳定引用,用引用判等。
    if (lastArrRef.current !== scrambles) { lastArrRef.current = scrambles; cacheRef.current.clear(); }

    const map = cacheRef.current.get(metric) ?? new Map<string, number[]>();
    cacheRef.current.set(metric, map);
    const total = scrambles.length;
    const todo = scrambles.filter((s) => !map.has(s));
    if (todo.length === 0) { setState({ map, ready: true, done: total, total, error: null }); return; }

    let cancelled = false;
    let done = total - todo.length;
    let lastFlush = 0;
    const flush = (ready: boolean) => { if (!cancelled) setState({ map, ready, done, total, error: null }); };
    flush(false);

    if (!poolRef.current) poolRef.current = createRustCrossPool(poolSize());
    const pool = poolRef.current;
    const variant = VARIANT[metric];

    (async () => {
      try {
        await Promise.race([
          pool.ready,
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error('worker load timeout (>60s)')), 60000)),
        ]);
        await Promise.all(todo.map(async (s) => {
          try {
            const vals = await Promise.all(FACES6.map((f) => pool.solveFace(s, variant, f).then((r) => r.value)));
            if (!cancelled) map.set(s, BADGE_TO_FACE.map((fi) => vals[fi]));
          } catch { /* 跳过该打乱(非 HTM / 求解失败) */ }
          done++;
          const now = Date.now();
          if (now - lastFlush > 120) { lastFlush = now; flush(false); }
        }));
        flush(true);
      } catch (e) {
        if (!cancelled) setState({ map, ready: false, done, total, error: String((e as Error)?.message ?? e) });
      }
    })();

    return () => { cancelled = true; };
  }, [scrambles, metric]);

  return state;
}
