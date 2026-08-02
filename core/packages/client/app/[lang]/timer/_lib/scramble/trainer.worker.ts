/**
 * Web Worker generating cross-trainer states (see lib/cross-trainer).
 *
 * Off the main thread because the exact distance tables cost ~0.3 s (cross) to ~10 s (XXCross)
 * to build, and the timer measures start/stop with performance.now() inside the keypress
 * handler — a table build on the main thread would land inside a solve.
 *
 * Protocol:
 *   Req: { id, op: 'gen',   spec, count } → { id, ok, states, depths, verdict }
 *        { id, op: 'solve', spec, state } → { id, ok, notation, frame }
 *
 * A `gen` builds the stage's tables first (see `warm`), so there is no separate warm request to
 * queue ahead of the work the user is waiting for.
 *
 * `verdict` is the important part: 'empty' means no cube has this difficulty (a proof), 'budget'
 * means this attempt ran out of time — a cold build, a rare window, a busy machine. The caller
 * must never turn 'budget' into "this difficulty does not exist".
 *
 * States, not scrambles: turning a state into notation is min2phase's job (WASM, a few ms) and it
 * lives on the main thread already.
 */

/// <reference lib="webworker" />

import {
  drawTrainerState, frameLabel, trainerCaps, trainerSolution, type TrainerSpec,
} from '@/lib/cross-trainer';
import type { CubieCube } from './kociemba/cube';

interface ReqGen { id: number; op: 'gen'; spec: TrainerSpec; count: number; budgetMs?: number }
/** Solve the case (the trainer's "show me the answer"), on demand — never eagerly: a deep
 *  XXCross descent costs a few hundred ms and most scrambles are never asked about. */
interface ReqSolve { id: number; op: 'solve'; spec: TrainerSpec; state: CubieCube; isZh: boolean }
type Req = ReqGen | ReqSolve;

export type GenVerdict = 'ok' | 'empty' | 'budget';

interface ResOk {
  id: number; ok: true;
  states: CubieCube[]; depths: number[];
  verdict?: GenVerdict; notation?: string | null; frame?: string;
}
interface ResErr { id: number; ok: false; err: string }
type Res = ResOk | ResErr;

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

/** Stages whose tables are already built in this worker, so a draw is pure search. */
const warmed = new Set<string>();

/**
 * Build a stage's tables. BUILD ONLY: the budget is 1 ms, because a draw's table build happens on
 * the very first chunk — before any clock starts — so one near-zero-budget draw pays for the build
 * and then stops instead of searching. (It used to ask for a 60 s draw, which meant a warm could
 * occupy the worker for a minute, outlast nothing but the 90 s request timeout, and get the worker
 * terminated mid-build on a slow phone.)
 */
function warm(spec: TrainerSpec): number {
  const key = `${spec.variant}/${spec.stage}`;
  if (warmed.has(key)) return 0;
  const t0 = Date.now();
  const caps = trainerCaps(spec.variant, spec.stage);
  if (caps) {
    // A single-colour, fixed-slot draw in the stage's own band touches exactly the tables every
    // other frame reuses (all frames collapse onto the canonical one).
    drawTrainerState(
      { variant: spec.variant, stage: spec.stage, colors: 'W', slot: 0, lo: caps.band[0], hi: caps.band[1] },
      Math.random, 1,
    );
  }
  warmed.add(key);
  return Date.now() - t0;
}

ctx.addEventListener('message', (ev: MessageEvent<Req>) => {
  const req = ev.data;
  try {
    if (req.op === 'solve') {
      const sol = trainerSolution(req.spec, req.state);
      // `null`, not '': a 0-move case IS a legitimate answer (the stage is already solved), so an
      // empty string cannot double as "no answer" — the caller would flip the panel open on nothing.
      ctx.postMessage({
        id: req.id, ok: true, states: [], depths: [],
        notation: sol ? sol.notation : null, frame: sol ? frameLabel(sol.frame, req.isZh) : '',
      } satisfies Res);
      return;
    }
    warm(req.spec);
    const states: CubieCube[] = [];
    const depths: number[] = [];
    let verdict: GenVerdict = 'ok';
    // One budget for the whole batch: the queue is a nicety, the scramble in front of the user
    // is not. Whatever is ready when the clock runs out gets sent.
    const budget = req.budgetMs ?? 3000;
    const deadline = Date.now() + budget;
    for (let i = 0; i < Math.max(1, req.count); i++) {
      const left = deadline - Date.now();
      const got = drawTrainerState(req.spec, Math.random, i === 0 ? budget : Math.max(200, left));
      if (!got.ok) { verdict = states.length ? 'ok' : got.reason; break; }
      states.push(got.state);
      depths.push(got.depth);
      if (Date.now() > deadline) break;
    }
    ctx.postMessage({ id: req.id, ok: true, states, depths, verdict } satisfies Res);
  } catch (e: unknown) {
    ctx.postMessage({ id: req.id, ok: false, err: e instanceof Error ? e.message : String(e) } satisfies Res);
  }
});

export {};
