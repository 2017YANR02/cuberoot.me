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

import type { CubeFaces } from './state';
import { applyScramble, solved } from './state';
import { htmMoves } from './htm';
import { applyOneToken } from './stage_segments';
import type { SolveMove } from './stage_segments';
import { metricForRange } from './step_metrics';
import { facesToFacelets, methodById } from './methods';
import type { MethodId, SolveMethod } from './methods';
import { methodFrame } from './method_frame';
import { isSolved } from './cfop-detect';
export { methodFrame } from './method_frame';

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
  preferredRotation?: string | null,
): MethodWalkResult | null {
  if (!moves || moves.length === 0) return null;
  const method = methodById(methodId);
  if (method.id !== 'cfop') {
    const frame = methodFrame(method.id, scramble, moves, preferredRotation);
    scramble = frame.scramble;
    moves = frame.moves;
  }
  return walkFramed(method, scramble, moves, totalMs);
}

function walkFramed(method: SolveMethod, scramble: string, moves: SolveMove[], totalMs: number): MethodWalkResult {
  let state: CubeFaces;
  try {
    state = applyScramble(3, scramble);
  } catch {
    state = solved(3);
  }

  const endIdx: Array<number | null> = method.stages.map(() => null);
  if (method.id !== 'cfop') {
    const facelets = facesToFacelets(state);
    for (let s = 0; s < method.stages.length; s++) {
      if (method.stages[s].done(state, facelets)) {
        for (let k = 0; k <= s; k++) endIdx[k] = -1;
      }
    }
  }
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
        recognitionMs: null, executionMs: null, stepMs: 0, cumulativeMs: moves[end]?.ts ?? 0,
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
    putDownMs: lastEnd !== null ? Math.max(0, totalMs - (moves[lastEnd]?.ts ?? 0)) : null,
    totalRecognitionMs: stages.reduce((n, s) => n + (s.recognitionMs ?? 0), 0),
    totalExecutionMs: stages.reduce((n, s) => n + (s.executionMs ?? 0), 0),
    totalTurns: stages.reduce((n, s) => n + (s.turns ?? 0), 0),
    reachedIdx,
  };
}

/** Infer the report from the observed milestone order, using the same stage
 * predicates and single-frame selection as its report. Intent is unknowable
 * for equivalent/short sequences; those retain the CFOP report. ZB variants
 * stay within CFOP and are identified by the existing case recognizer. */
export function detectSolveMethod(scramble: string, moves: SolveMove[], totalMs: number, preferredRotation?: string | null): MethodId {
  if (moves.length < 4) return 'cfop';
  // A partial stream does not yet establish a complete method. This cheap
  // check also keeps live BLE updates out of the 24-orientation report work.
  try {
    let final = applyScramble(3,scramble);
    for (const move of moves) final = applyOneToken(final,move.m);
    if (!isSolved(final)) return 'cfop';
  } catch { return 'cfop'; }
  const cfopFrame = methodFrame('cfop',scramble,moves,preferredRotation);
  const cfop = walkMethod('cfop',cfopFrame.scramble,cfopFrame.moves,totalMs);
  const cross = cfop?.stages[0].endIdx ?? Infinity;
  const f2l = cfop?.stages[1].endIdx ?? Infinity;
  const roux = walkMethod('roux',scramble,moves,totalMs,preferredRotation);
  const end = (walk: MethodWalkResult | null, index: number) => walk?.stages[index].endIdx ?? Infinity;
  // Two blocks and corner completion while the CFOP cross/F2L are still open
  // are the distinctive Roux milestones; merely visiting solved blocks is not.
  if (end(roux,0) < cross && end(roux,1) < f2l && end(roux,1) <= end(roux,2)
    && end(roux,2) <= end(roux,3) && end(roux,1) < end(roux,3)
    && Number.isFinite(end(roux,3))) return 'roux';
  const frame = methodFrame('zz',scramble,moves,preferredRotation);
  const zz = walkFramed(methodById('zz'),frame.scramble,frame.moves,totalMs);
  const eo = end(zz,0), blocks = end(zz,2);
  if (eo < cross && eo < end(zz,1) && end(zz,1) < blocks && blocks < end(zz,3)) {
    let state = applyScramble(3,frame.scramble);
    for (let i = 0; i <= blocks; i++) {
      state = applyOneToken(state,frame.moves[i].m);
      // Accidental early EOLine which is immediately broken is not ZZ.
      if (i >= eo && !methodById('zz').stages[0].done(state,facesToFacelets(state))) return 'cfop';
    }
    return 'zz';
  }
  return 'cfop';
}
