/**
 * Public API for random-state scrambles, backed by a Web Worker.
 *
 * The first call to `warmup333()` (or the first `randomState333()` if
 * warmup is skipped) triggers table construction in the worker, which
 * takes ~3-5 s on a modern CPU. Subsequent solves are <100 ms.
 *
 * 2x2 and 4x4: NOT exported here.
 *   - 2x2: doable but the solver above is 3x3-only; a separate ~2 KB
 *     coord-table solver would be needed. The existing random-move
 *     scramble in `nxnxn.ts` is acceptable for 2x2 since the WCA TNoodle
 *     standard for 2x2 is also random-state but the cube only has ~3.6M
 *     states — negligible quality difference for casual practice. Skipped
 *     to keep the worker bundle under the size budget.
 *   - 4x4: requires a fundamentally different algorithm (reduction, then
 *     two-phase on the inner edges/corners). Out of scope for this round.
 */

import { randomCubie } from './randomstate';
import type { CubieCube } from './cube';
import { scramble333 } from '../nxnxn';

// Next.js / Turbopack: load the Web Worker via `new Worker(new URL(...))`.
// Original Vite code used `import KociembaWorker from './kociemba.worker.ts?worker'`.
function makeKociembaWorker(): Worker {
  return new Worker(new URL('./kociemba.worker.ts', import.meta.url), { type: 'module' });
}

interface ResOk { id: number; ok: true; sol?: string; ready?: boolean }
interface ResErr { id: number; ok: false; err: string }
type Res = ResOk | ResErr;

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (v: string) => void; reject: (e: Error) => void }>();
let warmupPromise: Promise<void> | null = null;
let isReady = false;

/* For the synchronous variant we keep a pre-computed buffer of scrambles. */
const buffer: string[] = [];
const BUFFER_TARGET = 4;

function getWorker(): Worker {
  if (!worker) {
    worker = makeKociembaWorker();
    worker.addEventListener('message', (ev: MessageEvent<Res>) => {
      const r = ev.data;
      const p = pending.get(r.id);
      if (!p) return;
      pending.delete(r.id);
      if (r.ok) {
        if (typeof r.sol === 'string') p.resolve(r.sol);
        else p.resolve(''); // init reply
      } else {
        p.reject(new Error(r.err));
      }
    });
  }
  return worker;
}

function sendInit(): Promise<void> {
  const w = getWorker();
  const id = nextId++;
  return new Promise<void>((resolve, reject) => {
    pending.set(id, { resolve: () => resolve(), reject });
    w.postMessage({ id, op: 'init' });
  });
}

function sendScramble(): Promise<string> {
  const w = getWorker();
  const id = nextId++;
  return new Promise<string>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ id, op: 'scramble' });
  });
}

function sendSolve(state: CubieCube): Promise<string> {
  const w = getWorker();
  const id = nextId++;
  return new Promise<string>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ id, op: 'solve', state });
  });
}

/** Pre-warm the solver. Resolves only AFTER the sync buffer has at least one
 * scramble queued — callers can then safely use randomState333Sync. Idempotent. */
export function warmup333(): Promise<void> {
  if (isReady && buffer.length > 0) return Promise.resolve();
  if (warmupPromise) return warmupPromise;
  warmupPromise = (async () => {
    await sendInit();
    isReady = true;
    // Block the warmup promise until the first scramble lands in the buffer.
    try {
      const first = await sendScramble();
      buffer.push(first);
    } catch {
      // If even the first scramble fails, leave buffer empty; sync caller
      // will fall back to random-move via the catch in randomState333Sync.
    }
    // Top up the rest in the background.
    void refillBuffer();
  })();
  return warmupPromise;
}

async function refillBuffer(): Promise<void> {
  while (isReady && buffer.length < BUFFER_TARGET) {
    try {
      const s = await sendScramble();
      buffer.push(s);
    } catch {
      // give up silently — sync variant will throw if buffer is empty
      return;
    }
  }
}

/** Generate a random-state scramble for 3x3. Resolves to a WCA-notation string. */
export async function randomState333(): Promise<string> {
  await warmup333();
  if (buffer.length > 0) {
    const s = buffer.shift()!;
    void refillBuffer();
    return s;
  }
  const s = await sendScramble();
  void refillBuffer();
  return s;
}

/** Synchronous variant. If the buffer is somehow empty (rapid bursts can
 *  outrun the async refill), fall back to a random-move scramble so the
 *  caller never sees an exception, and kick off a refill so the next call
 *  gets a real random-state scramble. */
export function randomState333Sync(): string {
  if (buffer.length > 0) {
    const s = buffer.shift()!;
    void refillBuffer();
    return s;
  }
  if (isReady) void refillBuffer();
  return scramble333(Math.random);
}

/** Solve an arbitrary cube state (cubie-level). Useful for callers building
 * their own state (e.g. from facelets parsed from a camera). */
export async function solve333(state: CubieCube): Promise<string> {
  await warmup333();
  return sendSolve(state);
}

/** Generate a random valid CubieCube on the main thread (no worker needed).
 * Useful for tests. */
export { randomCubie };
