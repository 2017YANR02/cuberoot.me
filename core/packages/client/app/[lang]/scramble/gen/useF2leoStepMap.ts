'use client';

import { useEffect, useRef, useState } from 'react';
import { createRustCrossPool, type RustCrossPool } from '@/lib/rust-cross-client';

// WASM 返回的每阶段 6 值是物理面序 z0/z2/z3/z1/x3/x1 = 颜色 Y/W/O/R/G/B。
// 前端按 BADGE_ORDER [W,Y,R,O,B,G] 存,故用 BADGE_TO_FACE 重排(同 useStepMap)。
const BADGE_TO_FACE = [1, 0, 3, 2, 5, 4];

function remap6(face6: number[]): number[] {
  const out = new Array<number>(6);
  for (let b = 0; b < 6; b++) out[b] = face6[BADGE_TO_FACE[b]];
  return out;
}
function remap24(face24: number[]): number[] {
  const out = new Array<number>(24);
  for (let s = 0; s < 4; s++) {
    const base = s * 6;
    for (let b = 0; b < 6; b++) out[base + b] = face24[base + BADGE_TO_FACE[b]];
  }
  return out;
}

/**
 * F2LEO / Pseudo F2LEO 浏览器内求解状态。`map` 值随计算进度从 6 长(仅 cross)
 * 长到 24 长(全 4 阶段);消费方按阶段 offset 切 6 值再按底色子集取 min,长度不够即跳过。
 */
export interface F2leoState {
  map: Map<string, number[]> | null;
  /** cross(阶段0)全算完 — cross 用精确表极快,先单算它让默认视图秒出。 */
  crossReady: boolean;
  /** 全 24 值算完(深阶段 + 逐行徽标可任意切)。 */
  fullReady: boolean;
  /** 当前阶段(pass)已完成的打乱数,驱动派生 map 重算 + 非 cross 指标进度条。 */
  done: number;
  total: number;
  error: string | null;
}

const IDLE: F2leoState = { map: null, crossReady: false, fullReady: false, done: 0, total: 0, error: null };

function poolSize(): number {
  if (typeof navigator === 'undefined') return 2;
  const hc = navigator.hardwareConcurrency || 4;
  const mobile = typeof matchMedia !== 'undefined' && matchMedia('(max-width: 768px)').matches;
  return Math.max(1, Math.min(mobile ? 2 : 4, hc - 1));
}

/**
 * 两遍计算:
 *   1) cross(阶段0)对每条打乱单算一次 — cross 走精确 pt_cross,极快 → 默认十字视图秒出;
 *   2) 全 24 值(深阶段 xc/xxc/xxxc 弱剪枝,慢)后台补,补完逐行徽标可任意切阶段。
 * `enabled=false` 不建池;按 pseudo 缓存,换打乱集清缓存。复用同一 Rust WASM 池。
 */
export function useF2leoStepMap(scrambles: string[], enabled: boolean, pseudo: boolean): F2leoState {
  const [state, setState] = useState<F2leoState>(IDLE);
  const poolRef = useRef<RustCrossPool | null>(null);
  const cacheRef = useRef<Map<boolean, Map<string, number[]>>>(new Map());
  const lastArrRef = useRef<string[] | null>(null);

  useEffect(() => () => { poolRef.current?.terminate(); poolRef.current = null; }, []);

  useEffect(() => {
    if (!enabled) { setState(IDLE); return; }
    if (scrambles.length === 0) {
      setState({ map: new Map(), crossReady: true, fullReady: true, done: 0, total: 0, error: null });
      return;
    }

    // 打乱集换了(新比赛)→ 清缓存。scrambles 由调用方 memo 出稳定引用,用引用判等。
    if (lastArrRef.current !== scrambles) { lastArrRef.current = scrambles; cacheRef.current.clear(); }

    const map = cacheRef.current.get(pseudo) ?? new Map<string, number[]>();
    cacheRef.current.set(pseudo, map);
    const total = scrambles.length;
    const len = (s: string) => map.get(s)?.length ?? 0;
    const countAtLeast = (n: number) => scrambles.reduce((acc, s) => acc + (len(s) >= n ? 1 : 0), 0);

    // 全部已算好(回访同打乱集)→ 直接 ready。
    if (scrambles.every((s) => len(s) >= 24)) {
      setState({ map, crossReady: true, fullReady: true, done: total, total, error: null });
      return;
    }

    let cancelled = false;
    let lastFlush = 0;
    const flush = (crossReady: boolean, fullReady: boolean, target: number) => {
      if (!cancelled) setState({ map, crossReady, fullReady, done: countAtLeast(target), total, error: null });
    };
    flush(scrambles.every((s) => len(s) >= 6), false, 6);

    if (!poolRef.current) poolRef.current = createRustCrossPool(poolSize(), 'f2leo');
    const pool = poolRef.current;

    (async () => {
      try {
        await Promise.race([
          pool.ready,
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error('worker load timeout (>60s)')), 60000)),
        ]);

        // pass 1:cross(阶段0)— 秒级,默认十字视图先出。
        const crossTodo = scrambles.filter((s) => len(s) < 6);
        await Promise.all(crossTodo.map(async (s) => {
          try { const v = await pool.solveF2leoStage(s, pseudo, 0); if (!cancelled && len(s) < 6) map.set(s, remap6(v)); }
          catch { /* 跳过该打乱(非 HTM / 求解失败) */ }
          const now = Date.now();
          if (now - lastFlush > 120) { lastFlush = now; flush(false, false, 6); }
        }));
        if (cancelled) return;
        flush(true, false, 6);

        // pass 2:全 24 值(深阶段慢)后台补。覆盖 6 长为 24 长(cross 值一致)。
        // flush 节流放到 400ms:深阶段本就 ~2s/条,无需 120ms 高频重渲 133 行直方图徒增主线程卡顿。
        const fullTodo = scrambles.filter((s) => len(s) < 24);
        await Promise.all(fullTodo.map(async (s) => {
          try { const v = await pool.solveF2leo(s, pseudo); if (!cancelled) map.set(s, remap24(v)); }
          catch { /* 跳过 */ }
          const now = Date.now();
          if (now - lastFlush > 400) { lastFlush = now; flush(true, false, 24); }
        }));
        flush(true, true, 24);
      } catch (e) {
        if (!cancelled) setState((prev) => ({ ...prev, error: String((e as Error)?.message ?? e) }));
      }
    })();

    // 切变体/打乱集时:停止采用结果 + 丢弃排队任务,让新请求(如快 cross)不必排在旧变体的慢任务后。
    return () => { cancelled = true; pool.clearQueue(); };
  }, [scrambles, enabled, pseudo]);

  return state;
}
