/**
 * One walk, any method.
 *
 * `stage_segments.ts` walks the move stream for CFOP and stores what it finds on
 * the solve (case names, cross side — things only CFOP has). This walks the same
 * stream for whichever method the reader picked, and produces only what every
 * method has: when each stage finished, how long it took, how many turns, and
 * the recognition/execution split.
 *
 * It is deliberately NOT a replacement for `stage_segments.ts`. That one is the
 * persisted, CFOP-specific record every stat page reads; this one is derived on
 * demand for the report and stores nothing. Two consumers, two lifetimes.
 *
 * The rules are the same ones the CFOP walk already fixed, because a reader
 * switching the dropdown must not see the numbers change meaning:
 *   - first arrival wins, and reaching stage N back-fills every earlier stage
 *     (a block that lands two stages at once is a skip, not a rewind);
 *   - turns are HTM, merged over the whole stream once, attributed to where the
 *     move STARTED (`htm.ts`);
 *   - recognition / execution follow Cubeast's definitions via `metricForRange`.
 */

import type { CubeFaces } from '../cube/state';
import { applyScramble, solved } from '../cube/state';
import { htmMoves } from './htm';
import { applyOneToken } from './stage_segments';
import type { SolveMove } from './stage_segments';
import { metricForRange } from './step_metrics';
import { facesToFacelets, methodById } from './methods';
import type { MethodId, SolveMethod } from './methods';

export interface MethodStageMetric {
  key: string;
  zh: string;
  en: string;
  /** Index of the move that finished the stage; null when never reached. */
  endIdx: number | null;
  /** Finished by the same move as the previous stage. */
  skipped: boolean;
  recognitionMs: number | null;
  executionMs: number | null;
  stepMs: number | null;
  /** Timer start → this stage finished. */
  cumulativeMs: number | null;
  turns: number | null;
  tps: number | null;
}

export interface MethodWalkResult {
  method: SolveMethod;
  stages: MethodStageMetric[];
  /** Timer start → first turn. */
  pickupMs: number;
  /** Last turn → timer stop; null when the solve never finished. */
  putDownMs: number | null;
  totalRecognitionMs: number;
  totalExecutionMs: number;
  totalTurns: number;
  /** How far the solve got, as a stage index; -1 = not even the first stage. */
  reachedIdx: number;
}

export function walkMethod(
  methodId: MethodId | string,
  scramble: string,
  moves: SolveMove[],
  totalMs: number,
): MethodWalkResult | null {
  if (!moves || moves.length === 0) return null;
  const method = methodById(methodId);

  let state: CubeFaces;
  try {
    state = applyScramble(3, scramble);
  } catch {
    state = solved(3);
  }

  const endIdx: Array<number | null> = method.stages.map(() => null);
  for (let i = 0; i < moves.length; i++) {
    state = applyOneToken(state, moves[i].m);
    // Facelets are only built when some stage still needs them — that string is
    // rebuilt per move and the walk runs on every report open.
    let facelets: string | null = null;
    for (let s = 0; s < method.stages.length; s++) {
      if (endIdx[s] !== null) continue;
      facelets ??= facesToFacelets(state);
      if (!method.stages[s].done(state, facelets)) continue;
      endIdx[s] = i;
      // Back-fill: finishing stage s means every earlier one is finished too,
      // even if the cube skipped straight past them.
      for (let k = 0; k < s; k++) if (endIdx[k] === null) endIdx[k] = i;
    }
  }

  const counted = htmMoves(moves);
  const stages: MethodStageMetric[] = [];
  let prevEndIdx = -1;
  let prevEndTs = moves[0].ts;
  let reachedIdx = -1;

  for (let s = 0; s < method.stages.length; s++) {
    const st = method.stages[s];
    const end = endIdx[s];
    if (end === null) {
      stages.push({ key: st.key, zh: st.zh, en: st.en, endIdx: null, skipped: false,
        recognitionMs: null, executionMs: null, stepMs: null, cumulativeMs: null,
        turns: null, tps: null });
      continue;
    }
    reachedIdx = s;
    if (end === prevEndIdx) {
      stages.push({ key: st.key, zh: st.zh, en: st.en, endIdx: end, skipped: true,
        recognitionMs: null, executionMs: null, stepMs: 0, cumulativeMs: moves[end].ts,
        turns: 0, tps: null });
      continue;
    }
    const m = metricForRange(moves, counted, prevEndIdx, prevEndTs, end);
    stages.push({ key: st.key, zh: st.zh, en: st.en, endIdx: end, skipped: false,
      recognitionMs: m.recognitionMs, executionMs: m.executionMs, stepMs: m.stepMs,
      cumulativeMs: m.cumulativeMs, turns: m.turns, tps: m.tps });
    prevEndIdx = end;
    prevEndTs = m.cumulativeMs;
  }

  const lastEnd = endIdx[method.stages.length - 1];
  return {
    method,
    stages,
    pickupMs: Math.max(0, moves[0].ts),
    putDownMs: lastEnd !== null ? Math.max(0, totalMs - moves[lastEnd].ts) : null,
    totalRecognitionMs: stages.reduce((n, s) => n + (s.recognitionMs ?? 0), 0),
    totalExecutionMs: stages.reduce((n, s) => n + (s.executionMs ?? 0), 0),
    totalTurns: stages.reduce((n, s) => n + (s.turns ?? 0), 0),
    reachedIdx,
  };
}
