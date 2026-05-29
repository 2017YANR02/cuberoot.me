'use client';

import { useEffect, useRef, useState } from 'react';
import { createRustCrossPool, type RustCrossPool } from '@/lib/rust-cross-client';
import type { StepMapState } from './useStepMap';

// WASM 返回 24 值 [cross,xc,xxc,xxxc] × 物理面序 z0/z2/z3/z1/x3/x1 = 颜色 Y/W/O/R/G/B。
// 前端按 BADGE_ORDER [W,Y,R,O,B,G] 存,故每阶段 6 值用 BADGE_TO_FACE 重排(同 useStepMap)。
const BADGE_TO_FACE = [1, 0, 3, 2, 5, 4];

function remap24(face24: number[]): number[] {
  const out = new Array<number>(24);
  for (let s = 0; s < 4; s++) {
    const base = s * 6;
    for (let b = 0; b < 6; b++) out[base + b] = face24[base + BADGE_TO_FACE[b]];
  }
  return out;
}

const IDLE: StepMapState = { map: null, ready: false, done: 0, total: 0, error: null };

function poolSize(): number {
  if (typeof navigator === 'undefined') return 2;
  const hc = navigator.hardwareConcurrency || 4;
  const mobile = typeof matchMedia !== 'undefined' && matchMedia('(max-width: 768px)').matches;
  return Math.max(1, Math.min(mobile ? 2 : 4, hc - 1));
}

/**
 * F2LEO / Pseudo F2LEO 浏览器内整变体求解:每条打乱一次 `solveF2leo` 拿全 24 值
 * (4 阶段 × 6 朝向),重排成 BADGE_ORDER 存。`map` 值是 24 长 number[],消费方按
 * 阶段 offset(cross=0/xc=6/xxc=12/xxxc=18)切 6 值再按底色子集取 min。
 * `enabled=false` 不建池、零开销;按 pseudo 缓存,换打乱集清缓存。复用同一 Rust WASM 池。
 */
export function useF2leoStepMap(scrambles: string[], enabled: boolean, pseudo: boolean): StepMapState {
  const [state, setState] = useState<StepMapState>(IDLE);
  const poolRef = useRef<RustCrossPool | null>(null);
  const cacheRef = useRef<Map<boolean, Map<string, number[]>>>(new Map());
  const lastArrRef = useRef<string[] | null>(null);

  useEffect(() => () => { poolRef.current?.terminate(); poolRef.current = null; }, []);

  useEffect(() => {
    if (!enabled || scrambles.length === 0) { setState(IDLE); return; }

    // 打乱集换了(新比赛)→ 清缓存。scrambles 由调用方 memo 出稳定引用,用引用判等。
    if (lastArrRef.current !== scrambles) { lastArrRef.current = scrambles; cacheRef.current.clear(); }

    const map = cacheRef.current.get(pseudo) ?? new Map<string, number[]>();
    cacheRef.current.set(pseudo, map);
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

    (async () => {
      try {
        await Promise.race([
          pool.ready,
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error('worker load timeout (>60s)')), 60000)),
        ]);
        await Promise.all(todo.map(async (s) => {
          try {
            const vals = await pool.solveF2leo(s, pseudo);
            if (!cancelled) map.set(s, remap24(vals));
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
  }, [scrambles, enabled, pseudo]);

  return state;
}
