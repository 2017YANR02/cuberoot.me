// 有上界的 Rust→WASM cross-step worker 池。每个 worker 在自己的 WASM 线性内存
// 装一份表(pt_cross_C4E0 52MB + mt_edge4 18MB ≈ 70MB),所以 N 路并行 = N×70MB:
// 手机默认 2、桌面 4(按需懒生成),既能多视角同时算又不至于 OOM。
// 零拷贝共享表需要 SharedArrayBuffer + COOP/COEP,本页没发这些头,故不共享。
//
// 产物自包含在 /tools/solver/rust-cross/(dev 经 Next catch-all,prod 回退 static),
// 27MB 表只在本组件首次展开时拉(每个 worker 各拉一次,HTTP 缓存命中后很快)。

import { normalizeScramble } from './cross-solver';

const BASE = '/tools/solver/rust-cross';
// 代码产物(worker/glue/wasm)固定文件名 + 1 天 CDN 缓存,重建后靠版本 query 失效;
// 表(27MB)不变,不加版本以走缓存。每次重建 wasm/worker 必须 bump。
const V = 'v=20260611b';

// 各表解压后(= 装进 WASM 线性内存的)字节数。实测自 tools/solver/rust-cross/tables/*.bin.gz
// (`gzip -dc | wc -c`)。**表重建后尺寸若变需同步更新**(见 memory「WASM 重建仪式」)。
export const TABLE_BYTES: Record<string, number> = {
  pt_cross: 139408,
  pt_cross_C4E0: 54743056,
  pt_cross_ins_C4: 2280976,
  pt_pair_C4E0: 304,
  pt_ep4eo12: 12165136,
  pt_pscross: 139408,
  mt_edge2: 38028,
  mt_edge3: 760332,
  mt_edge4: 18247692,
  mt_corn: 1740,
  mt_corn2: 36300,
  mt_edge: 1740,
  mt_eo12: 147468,
  mt_eo12_alt: 147468,
  mt_ep4: 855372,
};

// 各 need 首次加载的表清单 —— 必须与 cross-solver-worker.js 的 init 分支严格一致。
// eodr / htr / htr2 零表下载(微表/距离表现场从内置运动学建)。
export const TABLE_SETS: Record<'cross' | 'f2leo' | 'variant' | 'block222' | 'roux223' | 'eodr' | 'htr' | 'htr2', string[]> = {
  cross: ['pt_cross', 'pt_cross_C4E0', 'mt_edge2', 'mt_edge4', 'mt_corn', 'mt_edge'],
  f2leo: ['pt_cross', 'mt_edge2', 'mt_edge4', 'mt_corn', 'mt_edge'],
  variant: [
    'pt_cross_C4E0', 'pt_cross_ins_C4', 'pt_pair_C4E0', 'mt_edge4', 'mt_corn', 'mt_edge',
    'pt_cross', 'pt_ep4eo12', 'mt_edge2', 'mt_eo12', 'mt_eo12_alt', 'mt_ep4', 'pt_pscross',
  ],
  block222: ['mt_edge3', 'mt_corn'],
  roux223: ['mt_edge3', 'mt_corn2', 'mt_edge2', 'mt_corn'],
  eodr: [],
  htr: [],
  htr2: [],
};

/** HTR(条件式阶段)非 DR 视角的哨兵值(u32::MAX):该视角未处于 DR,无 HTR 步数。 */
export const HTR_NOT_DR = 0xffffffff;

/** HTR phase-2(条件式阶段)非 HTR/G3 视角的哨兵值(u32::MAX):该视角未处于 HTR 子群。 */
export const HTR2_NOT_HTR = 0xffffffff;

/** 单条解法:m = 带视角前缀的步骤串;c = 该解的 F2L 槽位标签(如 "BL FR"),无槽阶段为空串。
 *  并列最优时不同条可能是不同槽。 */
export interface SolItem {
  m: string;
  c: string;
}
export interface MovesResult {
  len: number;
  sols: SolItem[];
}

export interface FaceResult {
  value: number;
  ms: number; // worker 内纯计算耗时
}
export interface MovesTimed extends MovesResult {
  ms: number;
}

export interface RustCrossPool {
  ready: Promise<void>; // 首个 worker 就绪
  /** variant 0=cross,1=xc,2=xxc,3=xxxc,4=xxxxc;face 0..5。返回单格步数 + 计算耗时。 */
  solveFace(scramble: string, variant: number, face: number): Promise<FaceResult>;
  /** 单格多解步骤 + 计算耗时。 */
  solveMoves(
    scramble: string,
    variant: number,
    face: number,
    opts?: { extra?: number; cap?: number },
  ): Promise<MovesTimed>;
  /** F2LEO(pseudo=false)/ Pseudo F2LEO(pseudo=true)整变体 24 值:[cross,xc,xxc,xxxc]×6 朝向(已折叠 z0/z2/z3/z1/x3/x1)。 */
  solveF2leo(scramble: string, pseudo: boolean): Promise<number[]>;
  /** 单阶段 6 值(stage 0=cross/1=xc/2=xxc/3=xxxc)。cross 极快 → 先单算 cross 秒出,深阶段后台补。 */
  solveF2leoStage(scramble: string, pseudo: boolean, stage: number): Promise<number[]>;
  /** F2LEO(pseudo=false)/ Pseudo F2LEO(pseudo=true)单格(× stage × face)多解步骤 + 计算耗时。前缀可能含尾随 y(破 y 对称)。 */
  solveF2leoMoves(
    scramble: string,
    pseudo: boolean,
    face: number,
    stage: number,
    opts?: { extra?: number; cap?: number },
  ): Promise<MovesTimed>;
  /** 其余变体(0=pair/1=eo/2=pseudo/3=pseudo_pair)整变体 24/30 值 × 6 朝向(物理面序 z0/z2/z3/z1/x3/x1)。 */
  solveVariant(scramble: string, variant: number): Promise<number[]>;
  /** 变体单阶段 6 值(stage 0=cross.. ),cross 先出深阶段后台补。 */
  solveVariantStage(scramble: string, variant: number, stage: number): Promise<number[]>;
  /** 变体单格(variant × stage × face)多解步骤 + 计算耗时。eo 的步骤前缀可能含尾随 y(破 y 对称)。 */
  solveVariantMoves(
    scramble: string,
    variant: number,
    face: number,
    stage: number,
    opts?: { extra?: number; cap?: number },
  ): Promise<MovesTimed>;
  /** 2x2x2 块 6 视角(每视角 = 该底色 4 个贴底块最小),物理面序 z0/z2/z3/z1/x3/x1。 */
  solveBlock222Stage(scramble: string): Promise<number[]>;
  /** 2x2x2 块单视角多解(4 贴底块合并按长度排序)。前缀 = rot + y^k,c = 块标签(URF..DRB)。 */
  solveBlock222Moves(
    scramble: string,
    face: number,
    opts?: { extra?: number; cap?: number },
  ): Promise<MovesTimed>;
  /** 块族单阶段 6 视角(stage 0=FB方块 1=1x2x3 2=2x2x2 3=2x2x3 4=双1x2x3),物理面序 z0/z2/z3/z1/x3/x1。 */
  solveRoux223Stage(scramble: string, stage: number): Promise<number[]>;
  /** 块族单视角多解。前缀 = rot + y^k,c = 目标标签(方块 "DBL-L" / 1x2x3 "DL" / 2x2x2 角名 / 2x2x3 棱名 / f2b "D(LR)")。 */
  solveRoux223Moves(
    scramble: string,
    stage: number,
    face: number,
    opts?: { extra?: number; cap?: number },
  ): Promise<MovesTimed>;
  /** EO/EOLine/DR 单阶段 6 视角(stage 0=EO 1=EOLine 2=DR),物理面序 z0/z2/z3/z1/x3/x1。 */
  solveEoDrStage(scramble: string, stage: number): Promise<number[]>;
  /** EO/EOLine/DR 单视角多解。前缀 = rot + y^k,c = 目标标签(EO 轴 "FB" / EOLine "D(FB)" / DR 轴 "UD")。 */
  solveEoDrMoves(
    scramble: string,
    stage: number,
    face: number,
    opts?: { extra?: number; cap?: number },
  ): Promise<MovesTimed>;
  /** HTR(DR→HTR)6 视角,物理面序 z0/z2/z3/z1/x3/x1。条件式阶段:非 DR 视角 = HTR_NOT_DR 哨兵。 */
  solveHtrStage(scramble: string): Promise<number[]>;
  /** HTR 单视角多解。前缀 = rot(HTR 对 y 不变),c = 轴标签(同 DR,如 "UD");非 DR 视角 len = HTR_NOT_DR。 */
  solveHtrMoves(
    scramble: string,
    face: number,
    opts?: { extra?: number; cap?: number },
  ): Promise<MovesTimed>;
  /** HTR phase-2(G3→solved)6 视角,物理面序 z0/z2/z3/z1/x3/x1。条件式阶段:非 HTR 视角 = HTR2_NOT_HTR 哨兵。 */
  solveHtr2Stage(scramble: string): Promise<number[]>;
  /** HTR phase-2 单视角多解。前缀 = rot(对 y 不变),c = 轴标签(同 DR);非 HTR 视角 len = HTR2_NOT_HTR。 */
  solveHtr2Moves(
    scramble: string,
    face: number,
    opts?: { extra?: number; cap?: number },
  ): Promise<MovesTimed>;
  /** 丢弃所有「排队未派发」的任务(已在 worker 里跑的 ≤size 个无法中断)。切变体/打乱集时调,
   *  避免新请求(如快 cross)排在旧变体一堆慢任务后面干等。被丢的任务 reject('cancelled')。 */
  clearQueue(): void;
  size: number;
  terminate(): void;
}

interface Job {
  msg: Record<string, unknown>;
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
}

interface PoolWorker {
  w: Worker;
  job: Job | null;
  ready: boolean;
  dead: boolean;
}

export function createRustCrossPool(maxSize: number, need: 'cross' | 'f2leo' | 'variant' | 'block222' | 'roux223' | 'eodr' | 'htr' | 'htr2' = 'cross'): RustCrossPool {
  const size = Math.max(1, maxSize);
  const all: PoolWorker[] = [];
  const idle: PoolWorker[] = [];
  const queue: Job[] = [];
  let spawned = 0;
  let loading = false; // 串行预热:同一时刻只允许一个 worker 在加载
  let anyReady = false;
  let resolveReady!: () => void;
  let rejectReady!: (e: Error) => void;
  const ready = new Promise<void>((res, rej) => { resolveReady = res; rejectReady = rej; });

  const origin = typeof location !== 'undefined' ? location.origin : '';
  const initMsg = {
    type: 'init',
    glueUrl: `${origin}${BASE}/cross_solver.js?${V}`,
    wasmUrl: `${origin}${BASE}/cross_solver_bg.wasm?${V}`,
    tablesBase: `${origin}${BASE}/tables`,
    need, // 'cross'(std,含 52MB C4E0)或 'f2leo'(只 5 张小表)
  };

  function dispatch(pw: PoolWorker, job: Job) {
    pw.job = job;
    pw.w.postMessage(job.msg);
  }

  // worker 不可用:标死,把在手任务重排;全死则让 ready / 排队任务带真实错误失败,
  // 否则把任务交给空闲 worker 或按需预热,池继续可用。
  function fail(pw: PoolWorker, err: Error, terminate = false) {
    if (pw.dead) return;
    pw.dead = true;
    loading = false;
    if (terminate) { try { pw.w.terminate(); } catch { /* */ } }
    const job = pw.job;
    pw.job = null;
    if (job) queue.unshift(job);
    if (all.every((p) => p.dead)) {
      if (!anyReady) rejectReady(err);
      while (queue.length) queue.shift()!.reject(err);
    } else {
      while (queue.length && idle.length) dispatch(idle.pop()!, queue.shift()!);
      maybeSpawn();
    }
  }

  // ready 空闲 worker 领下一个排队任务,否则归 idle;顺带按需串行预热。
  function assign(pw: PoolWorker) {
    if (pw.dead) return;
    const next = queue.shift();
    if (next) dispatch(pw, next);
    else idle.push(pw);
    maybeSpawn();
  }

  // 仅在「有排队任务 + 未满 + 当前没有 worker 在加载」时串行预热一个(避免 N× 同时解压 27MB)。
  function maybeSpawn() {
    if (loading || spawned >= size || queue.length === 0) return;
    spawn();
  }

  function spawn(): void {
    spawned++;
    loading = true;
    const w = new Worker(`${BASE}/cross-solver-worker.js?${V}`, { type: 'module' });
    const pw: PoolWorker = { w, job: null, ready: false, dead: false };
    all.push(pw);
    w.onmessage = (e: MessageEvent) => {
      const m = e.data;
      if (m.type === 'ready') {
        pw.ready = true;
        loading = false;
        if (!anyReady) { anyReady = true; resolveReady(); }
        assign(pw);
        return;
      }
      if (m.type === 'error') {
        const job = pw.job;
        pw.job = null;
        if (job) { job.reject(new Error(m.error)); assign(pw); return; } // 求解错误,worker 仍存活
        // 无 job 的 error = init 阶段失败(取表 / WASM 实例化),worker 不可用
        fail(pw, new Error(m.error || 'init failed'));
        return;
      }
      const job = pw.job;
      pw.job = null;
      if (job) {
        if (m.type === 'face') job.resolve({ value: m.value, ms: m.ms });
        else if (m.type === 'moves' || m.type === 'variant_moves' || m.type === 'f2leo_moves' || m.type === 'block222_moves' || m.type === 'roux223_moves' || m.type === 'eodr_moves' || m.type === 'htr_moves' || m.type === 'htr2_moves') job.resolve({ ...m.data, ms: m.ms });
        else job.resolve(m.values);
      }
      assign(pw);
    };
    // 致命错误(脚本加载失败 / WASM 内存被浏览器杀掉等,onerror 常无 message):标死处理。
    w.onerror = (e) => {
      const detail = e.message || (e.filename ? `load failed: ${e.filename}` : '')
        || 'worker crashed (可能内存不足 / out of memory)';
      fail(pw, new Error(detail), true);
    };
    w.postMessage(initMsg);
  }

  function submit(msg: Record<string, unknown>): Promise<unknown> {
    // 含 Rw/Fw/旋转的打乱(如 3BLD 朝向尾缀)会让魔方偏离白顶绿前;Rust 端 string_to_alg
    // 直接跳过无法识别 token 会静默算错,故先归正到白顶绿前的纯 HTM 再喂 worker。
    if (typeof msg.scramble === 'string') msg.scramble = normalizeScramble(msg.scramble) ?? msg.scramble;
    return new Promise((resolve, reject) => {
      const job: Job = { msg, resolve, reject };
      const free = idle.pop();
      if (free && free.ready && !free.dead) dispatch(free, job);
      else { queue.push(job); maybeSpawn(); }
    });
  }

  // 立即起第一个 worker(拉表 + 发 ready),即便暂无任务也要 resolve ready。
  spawn();

  let nextId = 1;
  return {
    ready,
    size,
    solveFace(scramble, variant, face) {
      return submit({ type: 'face', id: nextId++, scramble, variant, face }) as Promise<FaceResult>;
    },
    solveMoves(scramble, variant, face, opts = {}) {
      return submit({
        type: 'moves', id: nextId++, scramble, variant, face,
        extra: opts.extra ?? 0, cap: opts.cap ?? 50,
      }) as Promise<MovesTimed>;
    },
    solveF2leo(scramble, pseudo) {
      return submit({ type: 'f2leo', id: nextId++, scramble, pseudo }) as Promise<number[]>;
    },
    solveF2leoStage(scramble, pseudo, stage) {
      return submit({ type: 'f2leo_stage', id: nextId++, scramble, pseudo, stage }) as Promise<number[]>;
    },
    solveF2leoMoves(scramble, pseudo, face, stage, opts = {}) {
      return submit({
        type: 'f2leo_moves', id: nextId++, scramble, pseudo, face, stage,
        extra: opts.extra ?? 0, cap: opts.cap ?? 20,
      }) as Promise<MovesTimed>;
    },
    solveVariant(scramble, variant) {
      return submit({ type: 'variant', id: nextId++, scramble, variant }) as Promise<number[]>;
    },
    solveVariantStage(scramble, variant, stage) {
      return submit({ type: 'variant_stage', id: nextId++, scramble, variant, stage }) as Promise<number[]>;
    },
    solveVariantMoves(scramble, variant, face, stage, opts = {}) {
      return submit({
        type: 'variant_moves', id: nextId++, scramble, variant, face, stage,
        extra: opts.extra ?? 0, cap: opts.cap ?? 20,
      }) as Promise<MovesTimed>;
    },
    solveBlock222Stage(scramble) {
      return submit({ type: 'block222_stage', id: nextId++, scramble }) as Promise<number[]>;
    },
    solveBlock222Moves(scramble, face, opts = {}) {
      return submit({
        type: 'block222_moves', id: nextId++, scramble, face,
        extra: opts.extra ?? 0, cap: opts.cap ?? 20,
      }) as Promise<MovesTimed>;
    },
    solveRoux223Stage(scramble, stage) {
      return submit({ type: 'roux223_stage', id: nextId++, scramble, stage }) as Promise<number[]>;
    },
    solveRoux223Moves(scramble, stage, face, opts = {}) {
      return submit({
        type: 'roux223_moves', id: nextId++, scramble, stage, face,
        extra: opts.extra ?? 0, cap: opts.cap ?? 20,
      }) as Promise<MovesTimed>;
    },
    solveEoDrStage(scramble, stage) {
      return submit({ type: 'eodr_stage', id: nextId++, scramble, stage }) as Promise<number[]>;
    },
    solveEoDrMoves(scramble, stage, face, opts = {}) {
      return submit({
        type: 'eodr_moves', id: nextId++, scramble, stage, face,
        extra: opts.extra ?? 0, cap: opts.cap ?? 20,
      }) as Promise<MovesTimed>;
    },
    solveHtrStage(scramble) {
      return submit({ type: 'htr_stage', id: nextId++, scramble }) as Promise<number[]>;
    },
    solveHtrMoves(scramble, face, opts = {}) {
      return submit({
        type: 'htr_moves', id: nextId++, scramble, face,
        extra: opts.extra ?? 0, cap: opts.cap ?? 20,
      }) as Promise<MovesTimed>;
    },
    solveHtr2Stage(scramble) {
      return submit({ type: 'htr2_stage', id: nextId++, scramble }) as Promise<number[]>;
    },
    solveHtr2Moves(scramble, face, opts = {}) {
      return submit({
        type: 'htr2_moves', id: nextId++, scramble, face,
        extra: opts.extra ?? 0, cap: opts.cap ?? 20,
      }) as Promise<MovesTimed>;
    },
    clearQueue() { while (queue.length) queue.shift()!.reject(new Error('cancelled')); },
    terminate() { for (const pw of all) pw.w.terminate(); },
  };
}
