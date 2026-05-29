// 有上界的 Rust→WASM cross-step worker 池。每个 worker 在自己的 WASM 线性内存
// 装一份表(pt_cross_C4E0 52MB + mt_edge4 18MB ≈ 70MB),所以 N 路并行 = N×70MB:
// 手机默认 2、桌面 4(按需懒生成),既能多视角同时算又不至于 OOM。
// 零拷贝共享表需要 SharedArrayBuffer + COOP/COEP,本页没发这些头,故不共享。
//
// 产物自包含在 /tools/solver/rust-cross/(dev 经 Next catch-all,prod 回退 static),
// 27MB 表只在本组件首次展开时拉(每个 worker 各拉一次,HTTP 缓存命中后很快)。

const BASE = '/tools/solver/rust-cross';
// 代码产物(worker/glue/wasm)固定文件名 + 1 天 CDN 缓存,重建后靠版本 query 失效;
// 表(27MB)不变,不加版本以走缓存。每次重建 wasm/worker 必须 bump。
const V = 'v=20260529b';

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

export function createRustCrossPool(maxSize: number): RustCrossPool {
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
  };

  function dispatch(pw: PoolWorker, job: Job) {
    pw.job = job;
    pw.w.postMessage(job.msg);
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
      const job = pw.job;
      pw.job = null;
      if (m.type === 'error') {
        if (job) job.reject(new Error(m.error)); // 求解错误,worker 仍存活
      } else if (job) {
        if (m.type === 'face') job.resolve({ value: m.value, ms: m.ms });
        else if (m.type === 'moves') job.resolve({ ...m.data, ms: m.ms });
        else job.resolve(m.values);
      }
      assign(pw);
    };
    // 致命错误(加载失败等):标死,把在手任务重排,无活 worker 时让排队任务/ready 失败。
    w.onerror = (e) => {
      pw.dead = true;
      loading = false;
      const job = pw.job;
      pw.job = null;
      if (job) queue.unshift(job);
      if (all.every((p) => p.dead)) {
        const err = new Error(e.message || 'worker error');
        if (!anyReady) rejectReady(err);
        while (queue.length) queue.shift()!.reject(err);
      } else {
        // 还有活 worker:把任务塞给空闲者或预热
        while (queue.length && idle.length) dispatch(idle.pop()!, queue.shift()!);
        maybeSpawn();
      }
    };
    w.postMessage(initMsg);
  }

  function submit(msg: Record<string, unknown>): Promise<unknown> {
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
    terminate() { for (const pw of all) pw.w.terminate(); },
  };
}
