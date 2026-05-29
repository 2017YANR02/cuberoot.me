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

let solver = null;       // CrossSolverWasm(std cross/xc..xxxxc),需 52MB pt_cross_C4E0
let f2leoSolver = null;  // F2leoSolverWasm(f2leo / pseudo),只需小表子集
let variantSolver = null;// VariantSolverWasm(pair / eo / pseudo / pseudo_pair),小表显式逐槽追踪

async function fetchTable(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url}: ${res.status}`);
  const buf = await res.arrayBuffer();
  if (url.endsWith('.gz')) {
    const stream = new Response(buf).body.pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  return new Uint8Array(buf);
}

// init 即按 `need` 拉所需表 + 建求解器,**然后**才发 ready —— 池子串行预热(同一时刻只
// 一个 worker 在 init),靠这点避免 N 个 worker 同时 fetch 同批表把 dev server 打到
// "Failed to fetch"。`need='f2leo'` 只拉 5 张小表(跳过 52MB pt_cross_C4E0),f2leo 池更快。
async function init(glueUrl, wasmUrl, tablesBase, need) {
  const mod = await import(glueUrl);
  await mod.default(wasmUrl);
  const get = (n) => fetchTable(`${tablesBase}/${n}.bin.gz`);
  if (need === 'f2leo') {
    // f2leo / pseudo 复用 5 张小表;pseudo 在首次求解时再现场建剪枝表。
    const [a, c, d, e, f] = await Promise.all(['pt_cross', 'mt_edge2', 'mt_edge4', 'mt_corn', 'mt_edge'].map(get));
    f2leoSolver = new mod.F2leoSolverWasm(a, c, d, e, f);
  } else if (need === 'variant') {
    // pair / eo / pseudo / pseudo_pair 小表显式逐槽追踪。pair:前 6 表;eo 另用后 6 表。
    const [c4e0, insc4, pair, e4, c, e, cross, ep4eo12, e2, eo12, eo12alt, ep4, pscross] = await Promise.all(
      ['pt_cross_C4E0', 'pt_cross_ins_C4', 'pt_pair_C4E0', 'mt_edge4', 'mt_corn', 'mt_edge',
       'pt_cross', 'pt_ep4eo12', 'mt_edge2', 'mt_eo12', 'mt_eo12_alt', 'mt_ep4', 'pt_pscross'].map(get),
    );
    variantSolver = new mod.VariantSolverWasm(c4e0, insc4, pair, e4, c, e, cross, ep4eo12, e2, eo12, eo12alt, ep4, pscross);
  } else {
    const [a, b, c, d, e, f] = await Promise.all(
      ['pt_cross', 'pt_cross_C4E0', 'mt_edge2', 'mt_edge4', 'mt_corn', 'mt_edge'].map(get)
    );
    solver = new mod.CrossSolverWasm(a, b, c, d, e, f);
  }
}

self.onmessage = async (e) => {
  const msg = e.data;
  try {
    if (msg.type === 'init') {
      await init(msg.glueUrl, msg.wasmUrl, msg.tablesBase, msg.need);
      self.postMessage({ type: 'ready' });
    } else if (msg.type === 'solve') {
      if (!solver) throw new Error('cross solver not initialized');
      const out = msg.cumulative
        ? solver.solve_cumulative(msg.scramble, msg.variant)
        : solver.solve(msg.scramble, msg.variant);
      self.postMessage({ type: 'result', id: msg.id, values: Array.from(out) });
    } else if (msg.type === 'face') {
      if (!solver) throw new Error('cross solver not initialized');
      const t0 = performance.now();
      const v = solver.solve_face(msg.scramble, msg.variant, msg.face);
      self.postMessage({ type: 'face', id: msg.id, value: v, ms: performance.now() - t0 });
    } else if (msg.type === 'moves') {
      if (!solver) throw new Error('cross solver not initialized');
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
    } else if (msg.type === 'f2leo_stage') {
      if (!f2leoSolver) throw new Error('f2leo solver not initialized');
      const t0 = performance.now();
      // 单阶段 6 值(stage 0=cross/1=xc/2=xxc/3=xxxc),cross 极快 → UI 先单算 cross 秒出。
      const out = f2leoSolver.solve_f2leo_stage(msg.scramble, !!msg.pseudo, msg.stage | 0);
      self.postMessage({ type: 'f2leo', id: msg.id, values: Array.from(out), ms: performance.now() - t0 });
    } else if (msg.type === 'variant') {
      if (!variantSolver) throw new Error('variant solver not initialized');
      const t0 = performance.now();
      // 整变体 24(4 阶段)/30(5 阶段)值 × 6 视角(物理面序 z0/z2/z3/z1/x3/x1)。
      const out = variantSolver.solve(msg.scramble, msg.variant | 0);
      self.postMessage({ type: 'variant', id: msg.id, values: Array.from(out), ms: performance.now() - t0 });
    } else if (msg.type === 'variant_stage') {
      if (!variantSolver) throw new Error('variant solver not initialized');
      const t0 = performance.now();
      // 单阶段 6 值。cross(stage 0)先出,深阶段后台补。
      const out = variantSolver.solve_stage(msg.scramble, msg.variant | 0, msg.stage | 0);
      self.postMessage({ type: 'variant', id: msg.id, values: Array.from(out), ms: performance.now() - t0 });
    }
  } catch (err) {
    self.postMessage({ type: 'error', id: msg && msg.id, error: String(err && err.message || err) });
  }
};
