/**
 * Main-thread side of setup.worker.ts。
 * - 单例 worker (一个页面共享)
 * - 按 order 缓存"已 init"标记 — init 时给 worker 灌一次 groupRegistry + initialFlat
 * - apply(N, rotatesDesc, vecX, vecY, vecZ, rotIdx) → Promise<{vecX, vecY, vecZ, rotIdx}>
 *
 * 失败/不可用时 client 返回 null,caller 退回同步 setup() (大白话:不挡正路)。
 */

import type Cube from './cube';
import SetupWorker from './setup.worker.ts?worker';

let worker: Worker | null = null;
let nextReqId = 1;
const pendingByReqId = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new SetupWorker();
  worker.addEventListener('message', (ev: MessageEvent<{ id: number; ok: boolean; err?: string; vecX?: Float32Array; vecY?: Float32Array; vecZ?: Float32Array; rotIdx?: Uint8Array }>) => {
    const m = ev.data;
    const p = pendingByReqId.get(m.id);
    if (!p) return;
    pendingByReqId.delete(m.id);
    if (m.ok) p.resolve(m);
    else p.reject(new Error(m.err || 'worker error'));
  });
  worker.addEventListener('error', (ev) => {
    console.error('[setup-worker] error:', ev.message);
  });
  return worker;
}

function send<T>(msg: object, transfer: Transferable[]): Promise<T> {
  const w = ensureWorker();
  return new Promise<T>((resolve, reject) => {
    const id = nextReqId++;
    pendingByReqId.set(id, { resolve: resolve as (v: unknown) => void, reject });
    w.postMessage({ ...msg, id }, transfer);
  });
}

const initDoneByOrder = new Set<number>();
const initInflightByOrder = new Map<number, Promise<void>>();

/** Per-order init,给 worker 灌 groupRegistry + initialFlat + cubeCompose。idempotent。
 *  传 cube 是为了从 cube.table.groups 抽 indices。但 groupRegistry 只跟 order 有关,
 *  所以缓存按 order。  */
export async function ensureWorkerInit(
  cube: Cube,
  cubeCompose: Uint8Array,
  groupFlat: Int32Array,
  groupOffsets: Uint32Array,
  initialFlat: Int32Array,
): Promise<void> {
  const order = cube.order;
  if (initDoneByOrder.has(order)) return;
  const inflight = initInflightByOrder.get(order);
  if (inflight) return inflight;
  // 注意:Int32Array / Uint32Array / Uint8Array clone 而非 transfer,
  // 因 caller (groupRegistry / initialFlat / cubeCompose) 都缓存在 main 侧 (WeakMap by Cube),
  // 后续主线程 setup() 同步 fallback path 还要用。
  const promise = send<{ ok: true }>({
    op: 'init',
    order,
    cubeCompose: new Uint8Array(cubeCompose),
    groupFlat: new Int32Array(groupFlat),
    groupOffsets: new Uint32Array(groupOffsets),
    initialFlat: new Int32Array(initialFlat),
  }, []).then(() => {
    initDoneByOrder.add(order);
    initInflightByOrder.delete(order);
  });
  initInflightByOrder.set(order, promise);
  return promise;
}

/** apply hot loop in worker。vec/rotIdx 双向 transfer (主线程持有的 buffer 会被 detach,
 *  返回的是 worker 端处理完后 transfer 回来的 buffer)。  */
export async function workerApply(
  order: number,
  rotatesDesc: Uint32Array,
  vecX: Float32Array,
  vecY: Float32Array,
  vecZ: Float32Array,
  rotIdx: Uint8Array,
): Promise<{ vecX: Float32Array; vecY: Float32Array; vecZ: Float32Array; rotIdx: Uint8Array }> {
  const res = await send<{ ok: true; vecX: Float32Array; vecY: Float32Array; vecZ: Float32Array; rotIdx: Uint8Array }>({
    op: 'apply',
    order,
    rotatesDesc,
    vecX, vecY, vecZ, rotIdx,
  }, [
    rotatesDesc.buffer, vecX.buffer, vecY.buffer, vecZ.buffer, rotIdx.buffer,
  ]);
  return { vecX: res.vecX, vecY: res.vecY, vecZ: res.vecZ, rotIdx: res.rotIdx };
}
