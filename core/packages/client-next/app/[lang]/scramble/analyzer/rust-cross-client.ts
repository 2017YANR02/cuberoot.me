// 主线程封装:起 Rust→WASM cross-step 求解器的模块 worker(后台加载 ~27MB 表),
// Promise 化 solve(逐变体 6 视角步数)+ solveMoves(单格多解步骤)。
//
// 产物自包含在 /tools/solver/rust-cross/(dev 经 Next catch-all,prod 回退 static),
// 27MB 表只在本组件首次展开时才拉,不拖累 analyzer 首屏。

const BASE = '/tools/solver/rust-cross';
// 代码产物(worker/glue/wasm)固定文件名 + 1 天 CDN 缓存,重建后靠版本 query 失效;
// 表(27MB)不变,不加版本以走缓存。每次重建 wasm 必须 bump。
const V = 'v=20260529a';

export interface MovesResult {
  len: number;
  combo: string; // F2L 槽位标签(如 "BL FR")或 "cross"
  sols: string[]; // 每条带视角前缀的步骤串
}

export interface RustCross {
  ready: Promise<void>;
  /** variant 0=cross,1=xc,2=xxc,3=xxxc,4=xxxxc;返回该变体 6 视角步数。 */
  solve(scramble: string, variant: number): Promise<number[]>;
  /** 单格步数(face 0..5),逐格流式用。 */
  solveFace(scramble: string, variant: number, face: number): Promise<number>;
  /** 单格(variant × face 0..5)多解步骤。 */
  solveMoves(
    scramble: string,
    variant: number,
    face: number,
    opts?: { extra?: number; cap?: number },
  ): Promise<MovesResult>;
  terminate(): void;
}

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };

export function createRustCross(): RustCross {
  const worker = new Worker(`${BASE}/cross-solver-worker.js?${V}`, { type: 'module' });
  let nextId = 1;
  const pending = new Map<number, Pending>();
  let resolveReady!: () => void;
  let rejectReady!: (e: Error) => void;
  const ready = new Promise<void>((res, rej) => {
    resolveReady = res;
    rejectReady = rej;
  });

  worker.onmessage = (e: MessageEvent) => {
    const msg = e.data;
    if (msg.type === 'ready') {
      resolveReady();
    } else if (msg.type === 'result') {
      const p = pending.get(msg.id);
      if (p) { pending.delete(msg.id); p.resolve(msg.values); }
    } else if (msg.type === 'face') {
      const p = pending.get(msg.id);
      if (p) { pending.delete(msg.id); p.resolve(msg.value); }
    } else if (msg.type === 'moves') {
      const p = pending.get(msg.id);
      if (p) { pending.delete(msg.id); p.resolve(msg.data); }
    } else if (msg.type === 'error') {
      if (msg.id != null && pending.has(msg.id)) {
        const p = pending.get(msg.id)!;
        pending.delete(msg.id);
        p.reject(new Error(msg.error));
      } else {
        rejectReady(new Error(msg.error));
      }
    }
  };
  worker.onerror = (e) => rejectReady(new Error(e.message || 'worker error'));

  const origin = typeof location !== 'undefined' ? location.origin : '';
  worker.postMessage({
    type: 'init',
    glueUrl: `${origin}${BASE}/cross_solver.js?${V}`,
    wasmUrl: `${origin}${BASE}/cross_solver_bg.wasm?${V}`,
    tablesBase: `${origin}${BASE}/tables`,
  });

  function solve(scramble: string, variant: number): Promise<number[]> {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      worker.postMessage({ type: 'solve', id, scramble, variant, cumulative: false });
    });
  }

  function solveFace(scramble: string, variant: number, face: number): Promise<number> {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      worker.postMessage({ type: 'face', id, scramble, variant, face });
    });
  }

  function solveMoves(
    scramble: string,
    variant: number,
    face: number,
    opts: { extra?: number; cap?: number } = {},
  ): Promise<MovesResult> {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      worker.postMessage({
        type: 'moves', id, scramble, variant, face,
        extra: opts.extra ?? 0, cap: opts.cap ?? 50,
      });
    });
  }

  return { ready, solve, solveFace, solveMoves, terminate: () => worker.terminate() };
}
