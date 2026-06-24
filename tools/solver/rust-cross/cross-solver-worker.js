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
let block222Solver = null;// Block222SolverWasm(2x2x2 块),仅 mt_edge3+mt_corn(~745KB),距离表现场 BFS
let roux223Solver = null; // Roux223SolverWasm(FB 方块/1x2x3/双1x2x3 + Petrus 2x2x2/2x2x3),4 张小表 ~820KB
let eoDrSolver = null;    // EoDrSolverWasm(EO/EOLine/DR),零表下载,微表现场建
let htrSolver = null;     // HtrSolverWasm(DR→HTR),零表下载,2.8MB 距离表首查惰性现场 BFS
let htr2Solver = null;    // HtrPhase2SolverWasm(G3→solved),零表下载,648KB 距离表首查惰性现场 BFS
let frSolver = null;      // FrSolverWasm(HTR→FR,Floppy 还原),零表下载,3456 态陪集表首查惰性现场 BFS
let chainSolver = null;   // ChainSolverWasm(mallard 链式 EO→DR→HTR→[FR]→Finish),零表下载,首查惰性建全套距离表
let crossRestrictSolver = null; // CrossRestrictSolverWasm(or18 式受限最优十字:6面+6宽+3中层+3旋转 54-move),零表下载,构造即建 coord/center transition
let xcrossRestrictSolver = null; // XCrossRestrictSolverWasm(受限最优 xcross=十字+1 F2L 对,54-move + 中心追踪 + 双 PDB IDA*),零表下载,构造现场建表
let cube222Solver = null;  // Cube222SolverWasm(2x2x2 口袋魔方整解最优),拉 opt_222(3.6MB)直接 from_dist
let pyraminxSolver = null; // PyraminxSolverWasm(金字塔整解最优,含 tips),拉 opt_pyraminx(0.9MB)直接 from_dist
let skewbSolver = null;   // SkewbSolverWasm(斜转整解最优),拉 opt_skewb(3.0MB)直接 from_dist

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

// 整解最优求解器(2x2x2/金字塔/斜转):优先拉预算好的全空间距离表(opt_*.bin.gz)
// 直接 from_dist 即时构造(秒算,无现场 BFS);表缺失/CDN 未就绪时回退现场 BFS 构造
// (首查 ~1s),保证始终可用。
async function buildOpt(tablesBase, name, Ctor) {
  try {
    const dist = await fetchTable(`${tablesBase}/${name}.bin.gz`);
    return Ctor.from_dist(dist);
  } catch {
    return new Ctor();
  }
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
  } else if (need === 'block222') {
    // 2x2x2 块:全站最轻(2 张表 ~745KB),距离表构造时现场 BFS(毫秒级)。
    const [e3, c] = await Promise.all(['mt_edge3', 'mt_corn'].map(get));
    block222Solver = new mod.Block222SolverWasm(e3, c);
  } else if (need === 'roux223') {
    // FB(方块/1x2x3/双1x2x3)+ Petrus(2x2x2/2x2x3):4 张小表;方块与 2x2x2 即建,
    // 1x2x3 全表(5.3M 态)与 2x2x3 启发式表首次查询时惰性 BFS(~秒级);f2b 复用 1x2x3 表。
    // 表是 block222 所需(mt_edge3+mt_corn)的超集 → 顺手把 Block222 求解器也建上,
    // UI「砖」方法内切阶段(含 2x2x2)同一个池服务,不用换池重载。
    const [e3, c2, e2, c] = await Promise.all(['mt_edge3', 'mt_corn2', 'mt_edge2', 'mt_corn'].map(get));
    roux223Solver = new mod.Roux223SolverWasm(e3, c2, e2, c);
    block222Solver = new mod.Block222SolverWasm(e3, c);
  } else if (need === 'eodr') {
    // EO/EOLine/DR:零表下载,全部微表现场从内置运动学建(EOLine 即建,DR 首查惰性)。
    eoDrSolver = new mod.EoDrSolverWasm();
  } else if (need === 'htr') {
    // HTR(DR→HTR):零表下载,2.8MB 全空间精确距离表首查惰性现场 BFS。
    htrSolver = new mod.HtrSolverWasm();
  } else if (need === 'htr2') {
    // HTR phase-2(G3→solved):零表下载,648KB 全空间精确距离表首查惰性现场 BFS。
    htr2Solver = new mod.HtrPhase2SolverWasm();
  } else if (need === 'fr') {
    // FR(HTR→FR,Floppy 还原):零表下载,3456 态陪集移动/距离表首查惰性现场 BFS。
    frSolver = new mod.FrSolverWasm();
  } else if (need === 'cross_restrict') {
    // or18 式受限最优十字(6面+6宽+3中层+3旋转):零表下载,构造现场建
    // coord_trans(190080×54)+ center_trans(24×54),~数百 ms。BFS 首达即最优。
    crossRestrictSolver = new mod.CrossRestrictSolverWasm();
  } else if (need === 'xcross_restrict') {
    // 受限最优 xcross(十字 + 1 F2L 对):零表下载,构造现场建物理 54-move
    // cross/corner/edge/center transition + 双 PDB（用到才按受限集建）,IDA* h=max 可采纳。
    xcrossRestrictSolver = new mod.XCrossRestrictSolverWasm();
  } else if (need === 'chain') {
    // 链式(EO→DR→HTR→[FR]→Finish):零表下载;首次 solve_chain 现场建
    // EOLine/DR/HTR/htr2 距离表(数秒),fr.enabled 再惰性建 FR 陪集表。
    chainSolver = new mod.ChainSolverWasm();
  } else if (need === '222') {
    // 2x2x2 口袋魔方整解最优:拉 opt_222(3.6MB 全空间精确距离表)直接 from_dist,秒算。
    cube222Solver = await buildOpt(tablesBase, 'opt_222', mod.Cube222SolverWasm);
  } else if (need === 'pyraminx') {
    // 金字塔整解最优(核心+tips):拉 opt_pyraminx(0.9MB 核心全空间距离表)直接 from_dist,秒算。
    pyraminxSolver = await buildOpt(tablesBase, 'opt_pyraminx', mod.PyraminxSolverWasm);
  } else if (need === 'skewb') {
    // 斜转整解最优:拉 opt_skewb(3.0MB 全空间 3,149,280 态距离表)直接 from_dist,秒算。
    skewbSolver = await buildOpt(tablesBase, 'opt_skewb', mod.SkewbSolverWasm);
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
      const v = (msg.mask != null)
        ? solver.solve_face_masked(msg.scramble, msg.variant, msg.face, msg.mask >>> 0)
        : solver.solve_face(msg.scramble, msg.variant, msg.face);
      self.postMessage({ type: 'face', id: msg.id, value: v, ms: performance.now() - t0 });
    } else if (msg.type === 'moves') {
      if (!solver) throw new Error('cross solver not initialized');
      const t0 = performance.now();
      const json = (msg.mask != null)
        ? solver.solve_moves_masked(
            msg.scramble, msg.variant, msg.face, msg.extra ?? 0, msg.cap ?? 50, msg.combo ?? '', msg.mask >>> 0,
          )
        : solver.solve_moves(
            msg.scramble, msg.variant, msg.face, msg.extra ?? 0, msg.cap ?? 50, msg.combo ?? '',
          );
      self.postMessage({ type: 'moves', id: msg.id, data: JSON.parse(json), ms: performance.now() - t0 });
    } else if (msg.type === 'cr_face') {
      // 受限最优十字单视角:54-bit allowed mask = (hi<<32)|lo;返回该视角最优步数
      // (含解里的整体旋转计数,与 or18 max_rot 计步一致);受限无解 → 0xFFFFFFFF 哨兵。
      if (!crossRestrictSolver) throw new Error('cross_restrict solver not initialized');
      const t0 = performance.now();
      const sol = crossRestrictSolver.solve_cross_restricted(
        msg.scramble, msg.face | 0, msg.lo >>> 0, msg.hi >>> 0, msg.maxRot | 0,
      );
      const value = sol === '' ? 0xffffffff : sol.split(/\s+/).filter(Boolean).length;
      self.postMessage({ type: 'cr_face', id: msg.id, value, ms: performance.now() - t0 });
    } else if (msg.type === 'cr_moves') {
      // 受限最优十字多解枚举(长度 ∈ [最优,最优+extra],最多 cap 条,升序)。受限无解 → len=0xFFFFFFFF + 空解集。
      if (!crossRestrictSolver) throw new Error('cross_restrict solver not initialized');
      const t0 = performance.now();
      const json = crossRestrictSolver.solve_cross_restricted_moves(
        msg.scramble, msg.face | 0, msg.lo >>> 0, msg.hi >>> 0, msg.maxRot | 0, msg.extra ?? 2, msg.cap ?? 10,
      );
      self.postMessage({ type: 'cr_moves', id: msg.id, data: JSON.parse(json), ms: performance.now() - t0 });
    } else if (msg.type === 'xcr_grid') {
      // 受限最优 xcross 6 视角长度网格(PDB 每次受限集只建一次 ≈40ms,6 视角 × 4 槽共用)。
      // wasm 返 JSON [l0..l5]:-1=真无解 → 0xFFFFFFFF;-2=限制过宽未在预算内判定 → 0xFFFFFFFE(⋯)。
      if (!xcrossRestrictSolver) throw new Error('xcross_restrict solver not initialized');
      const t0 = performance.now();
      const json = xcrossRestrictSolver.solve_xcross_restricted_grid(
        msg.scramble, msg.lo >>> 0, msg.hi >>> 0, msg.maxRot | 0, msg.k | 0,
      );
      const arr = JSON.parse(json).map((v) => (v === -2 ? 0xfffffffe : v < 0 ? 0xffffffff : v));
      self.postMessage({ type: 'xcr_grid', id: msg.id, values: arr, ms: performance.now() - t0 });
    } else if (msg.type === 'xcr_moves') {
      // 受限最优 xcross 多解枚举(长度 ∈ [最优,最优+extra],最多 cap 条,升序)。无解 → len=0xFFFFFFFF。
      if (!xcrossRestrictSolver) throw new Error('xcross_restrict solver not initialized');
      const t0 = performance.now();
      const json = xcrossRestrictSolver.solve_xcross_restricted_moves(
        msg.scramble, msg.face | 0, msg.lo >>> 0, msg.hi >>> 0, msg.maxRot | 0, msg.extra ?? 2, msg.cap ?? 10, msg.k | 0, msg.combo ?? '',
      );
      self.postMessage({ type: 'xcr_moves', id: msg.id, data: JSON.parse(json), ms: performance.now() - t0 });
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
      // mask 存在 = 受限步法(f2leo/pseudo_f2leo),无解视角返 u32::MAX 哨兵。
      const out = (msg.mask != null)
        ? f2leoSolver.solve_f2leo_stage_masked(msg.scramble, !!msg.pseudo, msg.stage | 0, msg.mask >>> 0)
        : f2leoSolver.solve_f2leo_stage(msg.scramble, !!msg.pseudo, msg.stage | 0);
      self.postMessage({ type: 'f2leo', id: msg.id, values: Array.from(out), ms: performance.now() - t0 });
    } else if (msg.type === 'f2leo_moves') {
      if (!f2leoSolver) throw new Error('f2leo solver not initialized');
      const t0 = performance.now();
      // 单格(F2LEO/Pseudo F2LEO × stage × face)多解步骤。前缀可能含尾随 y(破 y 对称)。
      const json = (msg.mask != null)
        ? f2leoSolver.solve_moves_masked(
            msg.scramble, !!msg.pseudo, msg.face | 0, msg.stage | 0, msg.extra ?? 0, msg.cap ?? 20, msg.combo ?? '', msg.mask >>> 0,
          )
        : f2leoSolver.solve_moves(
            msg.scramble, !!msg.pseudo, msg.face | 0, msg.stage | 0, msg.extra ?? 0, msg.cap ?? 20, msg.combo ?? '',
          );
      self.postMessage({ type: 'f2leo_moves', id: msg.id, data: JSON.parse(json), ms: performance.now() - t0 });
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
      // mask 存在 = 受限步法(pair/eo/pseudo/pseudo_pair),无解视角返 u32::MAX 哨兵。
      const out = (msg.mask != null)
        ? variantSolver.solve_stage_masked(msg.scramble, msg.variant | 0, msg.stage | 0, msg.mask >>> 0)
        : variantSolver.solve_stage(msg.scramble, msg.variant | 0, msg.stage | 0);
      self.postMessage({ type: 'variant', id: msg.id, values: Array.from(out), ms: performance.now() - t0 });
    } else if (msg.type === 'block222_stage') {
      if (!block222Solver) throw new Error('block222 solver not initialized');
      const t0 = performance.now();
      // 6 视角(每视角 = 该底色 4 个贴底块最小),物理面序 z0/z2/z3/z1/x3/x1。
      const out = block222Solver.solve(msg.scramble);
      self.postMessage({ type: 'variant', id: msg.id, values: Array.from(out), ms: performance.now() - t0 });
    } else if (msg.type === 'block222_moves') {
      if (!block222Solver) throw new Error('block222 solver not initialized');
      const t0 = performance.now();
      // 单视角多解:4 贴底块合并按长度排序;前缀 = rot + y^k,c = 块标签(URF..DRB)。
      const json = block222Solver.solve_moves(
        msg.scramble, msg.face | 0, msg.extra ?? 0, msg.cap ?? 20,
      );
      self.postMessage({ type: 'block222_moves', id: msg.id, data: JSON.parse(json), ms: performance.now() - t0 });
    } else if (msg.type === 'roux223_stage') {
      if (!roux223Solver) throw new Error('roux223 solver not initialized');
      const t0 = performance.now();
      // 单阶段 6 视角(stage 0=FB方块 1=1x2x3 2=2x2x2 3=2x2x3 4=双1x2x3),物理面序 z0/z2/z3/z1/x3/x1。
      const out = roux223Solver.solve_stage(msg.scramble, msg.stage | 0);
      self.postMessage({ type: 'variant', id: msg.id, values: Array.from(out), ms: performance.now() - t0 });
    } else if (msg.type === 'roux223_moves') {
      if (!roux223Solver) throw new Error('roux223 solver not initialized');
      const t0 = performance.now();
      // 单视角多解:前缀 = rot + y^k,c = 目标标签(方块 "DBL-L" / 1x2x3 "DL" / 2x2x2 角名 / 2x2x3 棱名 / f2b "D(LR)")。
      const json = roux223Solver.solve_moves(
        msg.scramble, msg.stage | 0, msg.face | 0, msg.extra ?? 0, msg.cap ?? 20,
      );
      self.postMessage({ type: 'roux223_moves', id: msg.id, data: JSON.parse(json), ms: performance.now() - t0 });
    } else if (msg.type === 'eodr_stage') {
      if (!eoDrSolver) throw new Error('eodr solver not initialized');
      const t0 = performance.now();
      // 单阶段 6 视角(stage 0=EO 1=EOLine 2=DR),物理面序 z0/z2/z3/z1/x3/x1。
      const out = eoDrSolver.solve_stage(msg.scramble, msg.stage | 0);
      self.postMessage({ type: 'variant', id: msg.id, values: Array.from(out), ms: performance.now() - t0 });
    } else if (msg.type === 'eodr_moves') {
      if (!eoDrSolver) throw new Error('eodr solver not initialized');
      const t0 = performance.now();
      // 单视角多解:前缀 = rot + y^k,c = 目标标签(EO 轴 "FB" / EOLine "D(FB)" / DR 轴 "UD")。
      const json = eoDrSolver.solve_moves(
        msg.scramble, msg.stage | 0, msg.face | 0, msg.extra ?? 0, msg.cap ?? 20,
      );
      self.postMessage({ type: 'eodr_moves', id: msg.id, data: JSON.parse(json), ms: performance.now() - t0 });
    } else if (msg.type === 'htr_stage') {
      if (!htrSolver) throw new Error('htr solver not initialized');
      const t0 = performance.now();
      // 6 视角(物理面序 z0/z2/z3/z1/x3/x1);条件式阶段:非 DR 视角 = 0xFFFFFFFF 哨兵。
      const out = htrSolver.solve(msg.scramble);
      self.postMessage({ type: 'variant', id: msg.id, values: Array.from(out), ms: performance.now() - t0 });
    } else if (msg.type === 'htr_moves') {
      if (!htrSolver) throw new Error('htr solver not initialized');
      const t0 = performance.now();
      // 单视角多解:前缀 = rot(HTR 对 y 不变),c = 轴标签(同 DR,如 "UD");非 DR 视角 len=0xFFFFFFFF。
      const json = htrSolver.solve_moves(
        msg.scramble, msg.face | 0, msg.extra ?? 0, msg.cap ?? 20,
      );
      self.postMessage({ type: 'htr_moves', id: msg.id, data: JSON.parse(json), ms: performance.now() - t0 });
    } else if (msg.type === 'htr2_stage') {
      if (!htr2Solver) throw new Error('htr2 solver not initialized');
      const t0 = performance.now();
      // 6 视角(物理面序 z0/z2/z3/z1/x3/x1);条件式阶段:非 HTR 视角 = 0xFFFFFFFF 哨兵。
      const out = htr2Solver.solve(msg.scramble);
      self.postMessage({ type: 'variant', id: msg.id, values: Array.from(out), ms: performance.now() - t0 });
    } else if (msg.type === 'htr2_moves') {
      if (!htr2Solver) throw new Error('htr2 solver not initialized');
      const t0 = performance.now();
      // 单视角多解:前缀 = rot(HTR phase-2 对 y 不变),c = 轴标签(同 DR);非 HTR 视角 len=0xFFFFFFFF。
      const json = htr2Solver.solve_moves(
        msg.scramble, msg.face | 0, msg.extra ?? 0, msg.cap ?? 20,
      );
      self.postMessage({ type: 'htr2_moves', id: msg.id, data: JSON.parse(json), ms: performance.now() - t0 });
    } else if (msg.type === 'fr_stage') {
      if (!frSolver) throw new Error('fr solver not initialized');
      const t0 = performance.now();
      // 6 视角(物理面序 z0/z2/z3/z1/x3/x1);条件式阶段:非 HTR 视角 = 0xFFFFFFFF 哨兵。
      const out = frSolver.solve(msg.scramble);
      self.postMessage({ type: 'variant', id: msg.id, values: Array.from(out), ms: performance.now() - t0 });
    } else if (msg.type === 'fr_moves') {
      if (!frSolver) throw new Error('fr solver not initialized');
      const t0 = performance.now();
      // 单视角多解:前缀 = rot(FR 对 y 不变),c = 该视角 FR 轴标签(UD/FB/LR);非 HTR 视角 len=0xFFFFFFFF。
      const json = frSolver.solve_moves(
        msg.scramble, msg.face | 0, msg.extra ?? 0, msg.cap ?? 20,
      );
      self.postMessage({ type: 'fr_moves', id: msg.id, data: JSON.parse(json), ms: performance.now() - t0 });
    } else if (msg.type === 'chain_solve') {
      if (!chainSolver) throw new Error('chain solver not initialized');
      const t0 = performance.now();
      // 链式求解:config = JSON 串(per-stage {enabled,extra,cap,min,max,axes,excluded} + maxChains)。
      // data = { chains:[{steps:[{kind,variant,m,len,cum}],total}] },m 为 HOME 帧步骤串(无视角前缀)。
      const json = chainSolver.solve_chain(msg.scramble, msg.config || '{}');
      self.postMessage({ type: 'chain_solve', id: msg.id, data: JSON.parse(json), ms: performance.now() - t0 });
    } else if (msg.type === 'cube222_len') {
      if (!cube222Solver) throw new Error('cube222 solver not initialized');
      const t0 = performance.now();
      // 2x2x2 整解最优 HTM 步数(0..=11)。全 18 记号,D/L/B 经 24 旋转归一。
      const v = cube222Solver.solve(msg.scramble);
      self.postMessage({ type: 'variant', id: msg.id, values: [v], ms: performance.now() - t0 });
    } else if (msg.type === 'cube222_moves') {
      if (!cube222Solver) throw new Error('cube222 solver not initialized');
      const t0 = performance.now();
      // 一条最优解:m 前缀 = 整体旋转(打乱含 D/L/B 时归一所需,可为空),c 恒空串。
      const json = cube222Solver.solve_moves(msg.scramble);
      self.postMessage({ type: 'cube222_moves', id: msg.id, data: JSON.parse(json), ms: performance.now() - t0 });
    } else if (msg.type === 'pyraminx_len') {
      if (!pyraminxSolver) throw new Error('pyraminx solver not initialized');
      const t0 = performance.now();
      // 金字塔整解最优 HTM 步数(0..=15,含 tips)。全 WCA pyram 记号(大写核心 + 小写 tips)。
      const v = pyraminxSolver.solve(msg.scramble);
      self.postMessage({ type: 'variant', id: msg.id, values: [v], ms: performance.now() - t0 });
    } else if (msg.type === 'pyraminx_moves') {
      if (!pyraminxSolver) throw new Error('pyraminx solver not initialized');
      const t0 = performance.now();
      // 一条最优解:m = 核心大写解 + 小写 tip 收尾(无整体旋转前缀),c 恒空串。
      const json = pyraminxSolver.solve_moves(msg.scramble);
      self.postMessage({ type: 'pyraminx_moves', id: msg.id, data: JSON.parse(json), ms: performance.now() - t0 });
    } else if (msg.type === 'skewb_len') {
      if (!skewbSolver) throw new Error('skewb solver not initialized');
      const t0 = performance.now();
      // 斜转整解最优步数(0..=11,每 120° 一步)。全 WCA skewb 记号 U/L/R/B ± '/2。
      const v = skewbSolver.solve(msg.scramble);
      self.postMessage({ type: 'variant', id: msg.id, values: [v], ms: performance.now() - t0 });
    } else if (msg.type === 'skewb_moves') {
      if (!skewbSolver) throw new Error('skewb solver not initialized');
      const t0 = performance.now();
      // 一条最优解:m = 最优解序列(无整体旋转前缀),c 恒空串。
      const json = skewbSolver.solve_moves(msg.scramble);
      self.postMessage({ type: 'skewb_moves', id: msg.id, data: JSON.parse(json), ms: performance.now() - t0 });
    } else if (msg.type === 'variant_moves') {
      if (!variantSolver) throw new Error('variant solver not initialized');
      const t0 = performance.now();
      // 单格(variant × stage × face)多解步骤。eo 前缀可能含尾随 y(破 y 对称)。
      const json = (msg.mask != null)
        ? variantSolver.solve_moves_masked(
            msg.scramble, msg.variant | 0, msg.face | 0, msg.stage | 0, msg.extra ?? 0, msg.cap ?? 20, msg.combo ?? '', msg.base ?? -1, msg.mask >>> 0,
          )
        : variantSolver.solve_moves(
            msg.scramble, msg.variant | 0, msg.face | 0, msg.stage | 0, msg.extra ?? 0, msg.cap ?? 20, msg.combo ?? '', msg.base ?? -1,
          );
      self.postMessage({ type: 'variant_moves', id: msg.id, data: JSON.parse(json), ms: performance.now() - t0 });
    }
  } catch (err) {
    self.postMessage({ type: 'error', id: msg && msg.id, error: String(err && err.message || err) });
  }
};
