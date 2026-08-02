/**
 * Web Worker generating cross-trainer states (see lib/cross-trainer).
 *
 * Off the main thread because the exact distance tables cost ~0.3 s (cross) to ~1.7 s
 * (XCross) to build, and the timer measures start/stop with performance.now() inside the
 * keypress handler — a table build on the main thread would land inside a solve.
 *
 * Protocol:
 *   Req: { id, op: 'gen', spec, count }
 *   Res: { id, ok: true, states: CubieCube[] }   // fewer than `count` = the window is
 *                                               // unreachable / the budget ran out
 *        { id, ok: false, err: string }
 *
 * States, not scrambles: turning a state into notation is min2phase's job (WASM, a few ms)
 * and it lives on the main thread already.
 */

/// <reference lib="webworker" />

import { frameLabel, sampleTrainerState, trainerSolution, type TrainerSpec } from '@/lib/cross-trainer';
import type { CubieCube } from './kociemba/cube';

interface ReqGen { id: number; op: 'gen'; spec: TrainerSpec; count: number }
/** Solve the case (the trainer's "show me the answer"), on demand — never eagerly: a deep
 *  XXCross descent costs a few hundred ms and most scrambles are never asked about. */
interface ReqSolve { id: number; op: 'solve'; spec: TrainerSpec; state: CubieCube; isZh: boolean }
type Req = ReqGen | ReqSolve;

interface ResOk { id: number; ok: true; states: CubieCube[]; depths: number[]; notation?: string; frame?: string }
interface ResErr { id: number; ok: false; err: string }
type Res = ResOk | ResErr;

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

ctx.addEventListener('message', (ev: MessageEvent<Req>) => {
  const req = ev.data;
  try {
    if (req.op === 'solve') {
      const sol = trainerSolution(req.spec, req.state);
      const res: Res = {
        id: req.id, ok: true, states: [], depths: [],
        notation: sol?.notation ?? '', frame: sol ? frameLabel(sol.frame, req.isZh) : '',
      };
      ctx.postMessage(res);
      return;
    }
    const states: CubieCube[] = [];
    const depths: number[] = [];
    for (let i = 0; i < Math.max(1, req.count); i++) {
      const got = sampleTrainerState(req.spec);
      if (!got) break; // unreachable window → tell the caller by returning short
      states.push(got.state);
      depths.push(got.depth);
    }
    const res: Res = { id: req.id, ok: true, states, depths };
    ctx.postMessage(res);
  } catch (e: unknown) {
    const res: Res = { id: req.id, ok: false, err: e instanceof Error ? e.message : String(e) };
    ctx.postMessage(res);
  }
});

export {};
