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
const V = 'v=20260601a';

export interface MovesResult {
  len: number;
  combo: string; // F2L 槽位标签(如 "BL FR")或 "cross"
  sols: string[]; // 每条带视角前缀的步骤串
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

export function createRustCrossPool(maxSize: number, need: 'cross' | 'f2leo' | 'variant' = 'cross'): RustCrossPool {
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
        else if (m.type === 'moves' || m.type === 'variant_moves' || m.type === 'f2leo_moves') job.resolve({ ...m.data, ms: m.ms });
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
    clearQueue() { while (queue.length) queue.shift()!.reject(new Error('cancelled')); },
    terminate() { for (const pw of all) pw.w.terminate(); },
  };
}
