// 站内共享的 Rust→WASM 求解器池单例。
//
// StageSolver 可能在同一页多处挂载(analyzer 主面板 + gen 多行行内展开),若每个实例各建
// 一个池,每次都要重拉/重解压 27MB 表 + 重建 wasm(~1-2s)。这里做「单活跃池」:同一 need
// 复用,need 变了(std↔变体↔f2leo,装不同表集)才终止旧池建新池。一页同一时刻只用一种方法,
// 故单活跃池足够;跨页导航模块常驻,池随之常驻(内存有界:一个池)。

import { createRustCrossPool, type RustCrossPool } from './rust-cross-client';

export type PoolNeed = 'cross' | 'variant' | 'f2leo' | 'block222' | 'roux223';

let active: { pool: RustCrossPool; need: PoolNeed } | null = null;

/** 取得当前 need 的共享池;need 变化时终止旧池、新建。 */
export function getRustCrossPool(need: PoolNeed, size: number): RustCrossPool {
  if (active && active.need === need) return active.pool;
  active?.pool.terminate();
  active = { pool: createRustCrossPool(size, need), need };
  return active.pool;
}

/** 终止并清空当前活跃池(一般不需要;留作显式释放)。 */
export function dropRustCrossPool(): void {
  active?.pool.terminate();
  active = null;
}

/** 当前活跃池的 worker 数(手机 2 / 桌面 4,按需懒生成),供 UI 显示「N 路并行」。 */
export function poolSizeForDevice(): number {
  if (typeof navigator === 'undefined') return 2;
  const hc = navigator.hardwareConcurrency || 4;
  const mobile = typeof matchMedia !== 'undefined' && matchMedia('(max-width: 768px)').matches;
  return Math.max(1, Math.min(mobile ? 2 : 4, hc - 1));
}
