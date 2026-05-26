/**
 * Web Worker hosting the Kociemba two-phase solver.
 *
 * Protocol (postMessage):
 *   Req:  { id, op: 'init' }                 → init tables (idempotent)
 *         { id, op: 'solve', state: CubieCube } → run solver
 *         { id, op: 'scramble' }             → generate random state + solve
 *
 *   Res:  { id, ok: true, sol: string }                 // for solve/scramble
 *   Res:  { id, ok: true, ready: true }                 // for init
 *   Res:  { id, ok: false, err: string }
 *
 * Tables are computed lazily on first init (~3-5 seconds on warm CPU).
 * IndexedDB caching skipped in v1: the worker is a long-lived singleton on
 * the main thread, so warmup happens once per page load.
 */

/// <reference lib="webworker" />

import {
  formatMoves,
  invertSequence,
  type CubieCube,
} from './cube';
import { buildMoveTables, type MoveTables } from './movetables';
import { buildPruneTables, type PruneTables } from './prune';
import { solveCube } from './search';
import { randomCubie } from './randomstate';

let mt: MoveTables | null = null;
let pt: PruneTables | null = null;
let initStarted = false;
let initPromise: Promise<void> | null = null;

function ensureInit(): Promise<void> {
  if (mt && pt) return Promise.resolve();
  if (initPromise) return initPromise;
  initStarted = true;
  initPromise = (async () => {
    mt = buildMoveTables();
    pt = buildPruneTables(mt);
  })();
  return initPromise;
}

interface ReqInit { id: number; op: 'init' }
interface ReqSolve { id: number; op: 'solve'; state: CubieCube }
interface ReqScramble { id: number; op: 'scramble' }
type Req = ReqInit | ReqSolve | ReqScramble;

interface ResOk { id: number; ok: true; sol?: string; ready?: boolean }
interface ResErr { id: number; ok: false; err: string }
type Res = ResOk | ResErr;

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

ctx.addEventListener('message', async (ev: MessageEvent<Req>) => {
  const req = ev.data;
  try {
    if (req.op === 'init') {
      await ensureInit();
      const res: Res = { id: req.id, ok: true, ready: true };
      ctx.postMessage(res);
      return;
    }
    if (req.op === 'solve') {
      await ensureInit();
      if (!mt || !pt) throw new Error('tables not initialized');
      const sol = solveCube(req.state, mt, pt);
      const scramble = formatMoves(invertSequence(sol));
      const res: Res = { id: req.id, ok: true, sol: scramble };
      ctx.postMessage(res);
      return;
    }
    if (req.op === 'scramble') {
      await ensureInit();
      if (!mt || !pt) throw new Error('tables not initialized');
      const state = randomCubie();
      const sol = solveCube(state, mt, pt);
      const scramble = formatMoves(invertSequence(sol));
      const res: Res = { id: req.id, ok: true, sol: scramble };
      ctx.postMessage(res);
      return;
    }
  } catch (e: unknown) {
    const err = e instanceof Error ? e.message : String(e);
    const res: Res = { id: (req as { id: number }).id, ok: false, err };
    ctx.postMessage(res);
  }
});

void initStarted;

export {};
