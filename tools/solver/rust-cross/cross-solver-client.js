// cross-solver 主线程封装:起一个模块 worker,Promise 化求解接口。
//
// 用法:
//   import { createCrossSolver } from './cross-solver-client.js';
//   const cs = createCrossSolver({
//     workerUrl: new URL('./cross-solver-worker.js', import.meta.url),
//     glueUrl:   new URL('./cross_solver.js', import.meta.url).href,
//     wasmUrl:   new URL('./cross_solver_bg.wasm', import.meta.url).href,
//     tablesBase: new URL('./tables', import.meta.url).href,
//   });
//   await cs.ready;
//   const vals = await cs.solve(scramble, 4);            // xxxxcross 6 视角
//   const all  = await cs.solve(scramble, 2, { cumulative: true }); // cross+x+xx
//
// variant:0=cross,1=xc,2=xxc,3=xxxc,4=xxxxc。
// 返回 number[](单变体长 6;cumulative 长 (variant+1)*6,按 cross,xc,... 顺序拼接)。

export function createCrossSolver({ workerUrl, glueUrl, wasmUrl, tablesBase }) {
  const worker = new Worker(workerUrl, { type: 'module' });
  let nextId = 1;
  const pending = new Map();
  let resolveReady, rejectReady;
  const ready = new Promise((res, rej) => {
    resolveReady = res;
    rejectReady = rej;
  });

  worker.onmessage = (e) => {
    const msg = e.data;
    if (msg.type === 'ready') {
      resolveReady();
    } else if (msg.type === 'result') {
      const p = pending.get(msg.id);
      if (p) {
        pending.delete(msg.id);
        p.resolve(msg.values);
      }
    } else if (msg.type === 'moves') {
      const p = pending.get(msg.id);
      if (p) {
        pending.delete(msg.id);
        p.resolve(msg.data);
      }
    } else if (msg.type === 'error') {
      if (msg.id != null && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        pending.delete(msg.id);
        p.reject(new Error(msg.error));
      } else {
        rejectReady(new Error(msg.error));
      }
    }
  };
  worker.onerror = (e) => rejectReady(new Error(e.message || 'worker error'));

  worker.postMessage({ type: 'init', glueUrl, wasmUrl, tablesBase });

  function solve(scramble, variant, opts = {}) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      worker.postMessage({
        type: 'solve',
        id,
        scramble,
        variant,
        cumulative: !!opts.cumulative,
      });
    });
  }

  // 单格(variant × face)多解步骤。opts.extra 允许超出最优步数,opts.cap 封顶条数。
  // 返回 { len:number, combo:string, sols:string[] }(sols 带视角前缀)。
  function solveMoves(scramble, variant, face, opts = {}) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      worker.postMessage({
        type: 'moves',
        id,
        scramble,
        variant,
        face,
        extra: opts.extra ?? 0,
        cap: opts.cap ?? 50,
      });
    });
  }

  return {
    ready,
    solve,
    solveMoves,
    terminate() {
      worker.terminate();
    },
  };
}
