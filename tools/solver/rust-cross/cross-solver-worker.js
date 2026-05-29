// cross-solver 模块 worker:在后台线程加载 Rust WASM + 6 张表,跑 cross 系列
// (cross/xc/xxc/xxxc/xxxxc)求解,不阻塞 UI 线程。
//
// 消息协议(main → worker):
//   { type:'init', glueUrl, wasmUrl, tablesBase }
//   { type:'solve', id, scramble, variant, cumulative }
//   { type:'moves', id, scramble, variant, face, extra, cap }
// (worker → main):
//   { type:'ready' } | { type:'error', error }
//   | { type:'result', id, values } | { type:'moves', id, data }
//
// variant:0=cross,1=xc,2=xxc,3=xxxc,4=xxxxc。values 是普通 number[]。
// moves.data = { len, combo, sols:string[] }(单格多解步骤,sols 带视角前缀)。

let solver = null;
let CrossSolverWasm = null;
let f2leoSolver = null;
let F2leoSolverWasm = null;

async function fetchTable(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url}: ${res.status}`);
  const buf = await res.arrayBuffer();
  if (url.endsWith('.gz')) {
    const stream = new Response(buf).body.pipeThrough(new DecompressionStream('gzip'));
    const out = await new Response(stream).arrayBuffer();
    return new Uint8Array(out);
  }
  return new Uint8Array(buf);
}

async function init(glueUrl, wasmUrl, tablesBase) {
  const mod = await import(glueUrl);
  await mod.default(wasmUrl);
  CrossSolverWasm = mod.CrossSolverWasm;

  const names = ['pt_cross', 'pt_cross_C4E0', 'mt_edge2', 'mt_edge4', 'mt_corn', 'mt_edge'];
  const tables = await Promise.all(
    names.map((n) => fetchTable(`${tablesBase}/${n}.bin.gz`))
  );
  solver = new CrossSolverWasm(...tables);

  // F2LEO / Pseudo F2LEO 复用 5 张表子集:pt_cross, mt_edge2, mt_edge4, mt_corn, mt_edge
  // (跳过 index 1 的 pt_cross_C4E0 — f2leo 不需要)。pseudo 另在构造时现场建剪枝表。
  F2leoSolverWasm = mod.F2leoSolverWasm;
  f2leoSolver = new F2leoSolverWasm(tables[0], tables[2], tables[3], tables[4], tables[5]);
}

self.onmessage = async (e) => {
  const msg = e.data;
  try {
    if (msg.type === 'init') {
      await init(msg.glueUrl, msg.wasmUrl, msg.tablesBase);
      self.postMessage({ type: 'ready' });
    } else if (msg.type === 'solve') {
      if (!solver) throw new Error('solver not initialized');
      const out = msg.cumulative
        ? solver.solve_cumulative(msg.scramble, msg.variant)
        : solver.solve(msg.scramble, msg.variant);
      self.postMessage({ type: 'result', id: msg.id, values: Array.from(out) });
    } else if (msg.type === 'face') {
      if (!solver) throw new Error('solver not initialized');
      const t0 = performance.now();
      const v = solver.solve_face(msg.scramble, msg.variant, msg.face);
      self.postMessage({ type: 'face', id: msg.id, value: v, ms: performance.now() - t0 });
    } else if (msg.type === 'moves') {
      if (!solver) throw new Error('solver not initialized');
      const t0 = performance.now();
      const json = solver.solve_moves(
        msg.scramble, msg.variant, msg.face, msg.extra ?? 0, msg.cap ?? 50,
      );
      self.postMessage({ type: 'moves', id: msg.id, data: JSON.parse(json), ms: performance.now() - t0 });
    } else if (msg.type === 'f2leo') {
      if (!f2leoSolver) throw new Error('f2leo solver not initialized');
      const t0 = performance.now();
      // 整变体一次算:返回 24 值 [cross,xc,xxc,xxxc] × 6 朝向(已折叠 z0/z2/z3/z1/x3/x1)。
      const out = msg.pseudo
        ? f2leoSolver.solve_pseudo_f2leo(msg.scramble)
        : f2leoSolver.solve_f2leo(msg.scramble);
      self.postMessage({ type: 'f2leo', id: msg.id, values: Array.from(out), ms: performance.now() - t0 });
    }
  } catch (err) {
    self.postMessage({ type: 'error', id: msg && msg.id, error: String(err && err.message || err) });
  }
};
