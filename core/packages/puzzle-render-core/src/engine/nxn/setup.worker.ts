/**
 * Web Worker: apply_rotates hot loop offload。
 *
 * 主线程 setup() 把 hot loop 甩这里跑,期间 UI 60fps 不卡。
 * N=200 hot loop ~5s,纯 CPU,无 GPU/THREE 依赖 → 适合 worker。
 *
 * Protocol:
 *   Req:  { id, op: 'init',  order, groupFlat, groupOffsets, cubeCompose, initialFlat }
 *         { id, op: 'apply', order, rotatesDesc, vecX, vecY, vecZ, rotIdx, sliceInsts }
 *   Res:  { id, ok: true }                                                            (init)
 *         { id, ok: true, vecX, vecY, vecZ, rotIdx }                                  (apply)
 *         { id, ok: false, err }
 *
 * Per-order cache (init message 灌一次):groupRegistry + initialFlat + cubeCompose。
 * apply 每次主线程只送 rotatesDesc + 工作 vec/rotIdx,大头省 32MB flat transfer。
 */

/// <reference lib="webworker" />

import initStackKernel, { apply_rotates as stackKernelApplyRotates } from "@cuberoot/stack-kernel";

let kernelReady: Promise<void> | null = null;
function ensureKernel(): Promise<void> {
  if (!kernelReady) kernelReady = initStackKernel().then(() => {});
  return kernelReady;
}

type OrderState = {
  groupFlat: Int32Array;
  groupOffsets: Uint32Array;
  cubeCompose: Uint8Array;
  // working flat (scratch),N=200 32MB。worker 持有,每次 apply 起手 .set(initialFlat) 复位。
  flat: Int32Array;
  initialFlat: Int32Array;
  sliceInsts: Int32Array;  // 共用 scratch (N²)
};
const stateByOrder = new Map<number, OrderState>();

interface ReqInit {
  id: number;
  op: 'init';
  order: number;
  groupFlat: Int32Array;
  groupOffsets: Uint32Array;
  cubeCompose: Uint8Array;
  initialFlat: Int32Array;
}
interface ReqApply {
  id: number;
  op: 'apply';
  order: number;
  rotatesDesc: Uint32Array;
  vecX: Float32Array;
  vecY: Float32Array;
  vecZ: Float32Array;
  rotIdx: Uint8Array;
}
type Req = ReqInit | ReqApply;

interface ResOk { id: number; ok: true; vecX?: Float32Array; vecY?: Float32Array; vecZ?: Float32Array; rotIdx?: Uint8Array }
interface ResErr { id: number; ok: false; err: string }
type Res = ResOk | ResErr;

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

ctx.addEventListener('message', async (ev: MessageEvent<Req>) => {
  const req = ev.data;
  try {
    await ensureKernel();
    if (req.op === 'init') {
      const N = req.order;
      const sliceInsts = new Int32Array(N * N);
      stateByOrder.set(N, {
        groupFlat: req.groupFlat,
        groupOffsets: req.groupOffsets,
        cubeCompose: req.cubeCompose,
        flat: new Int32Array(req.initialFlat.length),
        initialFlat: req.initialFlat,
        sliceInsts,
      });
      ctx.postMessage({ id: req.id, ok: true } as Res);
      return;
    }
    if (req.op === 'apply') {
      const st = stateByOrder.get(req.order);
      if (!st) throw new Error(`worker: order ${req.order} not initialized`);
      // 复位 flat 到 solved (上次 apply 之后是 scrambled state)
      st.flat.set(st.initialFlat);
      stackKernelApplyRotates(
        req.rotatesDesc,
        st.groupFlat, st.groupOffsets,
        req.vecX, req.vecY, req.vecZ,
        req.rotIdx,
        st.flat,
        st.sliceInsts,
        st.cubeCompose,
        req.order,
      );
      const res: ResOk = {
        id: req.id, ok: true,
        vecX: req.vecX, vecY: req.vecY, vecZ: req.vecZ, rotIdx: req.rotIdx,
      };
      ctx.postMessage(res, [
        req.vecX.buffer, req.vecY.buffer, req.vecZ.buffer, req.rotIdx.buffer,
      ] as unknown as Transferable[]);
      return;
    }
    throw new Error(`worker: unknown op ${(req as { op: string }).op}`);
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    ctx.postMessage({ id: req.id, ok: false, err } as Res);
  }
});
