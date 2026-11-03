import {
  createSmartCubeFixupRequester,
  smartCubeScrambleProgress,
  projectSmartCubeScrambleDisplay,
  type SmartCubeScrambleDisplayState,
  type SmartCubeFixupPath,
  type SmartCubeScrambleProgress,
  type SmartCubeScrambleHint,
} from './scramble_hint';
import { cubeMove, faceTurnToken, SOLVED_3X3 } from '@cuberoot/puzzle-solvers/timer-333-cube';
import { mergeAdjacentMoves } from '../alg_notation';
import { invertAlg } from '../alg_transform';
import { normalizeWcaScramble } from '../normalize_wca_scramble';
import { normalizeSmartCubeCorrectionLimit } from '../timer/settings-contract';

export interface SmartCubeGuidanceState {
  correctionActive: boolean;
  hint: SmartCubeScrambleHint | null;
  match: boolean | null;
}

export interface SmartCubeGuidanceObservation {
  completedNow: boolean;
  state: SmartCubeGuidanceState;
}

export interface SmartCubeGuidanceContext {
  id: string | number;
  scramble: string;
  targetFacelets: string;
  /** Display-to-device frame; raw device states and solver paths stay physical. */
  orientation?: string;
}

const EMPTY_STATE: SmartCubeGuidanceState = {
  correctionActive: false,
  hint: null,
  match: null,
};

/** Runtime-neutral lifecycle for Solo smart-cube scramble guidance. */
export function createSmartCubeGuidanceController(deps: {
  onChange?(state: SmartCubeGuidanceState): void;
  solve(fromFacelets: string, targetFacelets: string): Promise<string | null>;
  correctionLimit?(): number | undefined;
}) {
  let connected = false;
  let context: SmartCubeGuidanceContext | null = null;
  let correction: SmartCubeFixupPath | null = null;
  let currentFacelets: string | null = null;
  let disposed = false;
  let generation = 0;
  let guidanceComplete = false;
  let running = false;
  let state = EMPTY_STATE;
  let wanted = false;
  let anchor: SmartCubeScrambleProgress | null = null;
  let deviation: string[] = [];
  let presentation: SmartCubeScrambleDisplayState | null = null;
  let retainCorrections = false;
  const pendingGenerations = new Set<number>();

  const emit = (next: SmartCubeGuidanceState): SmartCubeGuidanceState => {
    // GAN can deliver several moves synchronously. Accumulate completed moves
    // here so React batching cannot discard a correction followed by a new error.
    presentation = projectSmartCubeScrambleDisplay(presentation, next.hint, context?.scramble);
    if (!next.hint) retainCorrections = false;
    else if (next.hint.corrections?.length) retainCorrections = true;
    state = retainCorrections && next.hint
      ? { ...next, hint: { ...next.hint, displayMoves: presentation.moves } }
      : next;
    deps.onChange?.(state);
    return state;
  };

  const clear = (resetCompletion: boolean, notify = true) => {
    correction = null;
    anchor = null;
    deviation = [];
    presentation = null;
    retainCorrections = false;
    currentFacelets = null;
    wanted = false;
    if (resetCompletion) guidanceComplete = false;
    if (notify) emit(EMPTY_STATE);
    else state = EMPTY_STATE;
  };

  const requester = createSmartCubeFixupRequester({
    facelets: () => currentFacelets,
    solve: deps.solve,
    valid: (targetFacelets) => !disposed
      && connected
      && !running
      && !guidanceComplete
      && wanted
      && context?.targetFacelets === targetFacelets,
  });

  const requestCorrection = (targetFacelets: string, requestGeneration: number) => {
    if (pendingGenerations.has(requestGeneration)) return;
    pendingGenerations.add(requestGeneration);
    void requester.request(targetFacelets).then((result) => {
      if (!result
        || disposed
        || requestGeneration !== generation
        || !connected
        || running
        || guidanceComplete
        || !wanted
        || context?.targetFacelets !== targetFacelets
        || !currentFacelets) return;

      correction = {
        fromFacelets: result.fromFacelets,
        scramble: result.scramble,
      };
      anchor = null;
      deviation = [];
      evaluate(currentFacelets, false);
    }).finally(() => {
      pendingGenerations.delete(requestGeneration);
    });
  };

  const evaluate = (
    facelets: string,
    allowCompletion: boolean,
    move?: string,
  ): SmartCubeGuidanceObservation => {
    if (disposed || !connected || running || !context) {
      return { completedNow: false, state };
    }
    const previousFacelets = currentFacelets;
    currentFacelets = facelets;
    if (guidanceComplete) {
      const next = facelets === context.targetFacelets
        ? { correctionActive: false, hint: null, match: true }
        : EMPTY_STATE;
      return { completedNow: false, state: emit(next) };
    }

    if (facelets === context.targetFacelets) {
      guidanceComplete = allowCompletion;
      wanted = false;
      correction = null;
      anchor = null;
      deviation = [];
      return {
        completedNow: allowCompletion,
        state: emit({ correctionActive: false, hint: null, match: true }),
      };
    }
    const orientation = context.orientation ?? '';
    const displayAlg = (alg: string) => normalizeWcaScramble(`${invertAlg(orientation)} ${alg}`) ?? alg;
    let progress = correction ? smartCubeScrambleProgress(
      displayAlg(correction.scramble), facelets, correction.fromFacelets, orientation,
    ) : null;
    if (!progress) {
      progress = smartCubeScrambleProgress(context.scramble, facelets, SOLVED_3X3, orientation);
      if (progress) correction = null;
    }
    let hint: SmartCubeScrambleHint | null = null;
    wanted = false;
    if (progress) {
      anchor = progress;
      deviation = [];
      hint = progress.hint;
    } else {
      // State frames may repeat a move's final state. Never count it twice, or
      // invent missing turns when reconnect/history recovery jumps the cube.
      if (anchor && previousFacelets !== facelets) {
        const turn = previousFacelets ? observedTurn(previousFacelets, facelets, move) : null;
        if (turn) deviation = mergeAdjacentMoves([...deviation, turn].join(' ')).split(/\s+/).filter(Boolean);
        else anchor = null;
      }
      if (anchor && deviation.length > 0
        && deviation.length <= normalizeSmartCubeCorrectionLimit(deps.correctionLimit?.())) {
        const corrections = displayAlg(invertAlg(deviation.join(' '))).split(/\s+/).filter(Boolean);
        const remaining = [...anchor.remaining];
        // DCTimer-BLE's correction-first presentation, with the same adjacent
        // face merge used elsewhere in CubeRoot (including across this boundary).
        while (corrections.length && remaining.length && corrections.at(-1)![0] === remaining[0][0]) {
          const merged = mergeAdjacentMoves(`${corrections.pop()} ${remaining.shift()}`);
          if (merged) corrections.push(merged);
        }
        hint = { done: anchor.hint.done, corrections, current: remaining[0] ?? null, pending: remaining.slice(1), complete: false };
      } else {
        if (!anchor) deviation = [];
        wanted = true;
      }
    }
    const next = emit({
      correctionActive: Boolean(correction || hint?.corrections?.length),
      hint,
      match: false,
    });
    if (wanted) requestCorrection(context.targetFacelets, generation);
    return { completedNow: false, state: next };
  };

  return {
    dispose() {
      disposed = true;
      generation++;
      context = null;
      connected = false;
      running = false;
      clear(true, false);
    },

    observe(facelets: string, move?: string): SmartCubeGuidanceObservation {
      return evaluate(facelets, true, move);
    },

    setConnected(next: boolean) {
      if (disposed || connected === next) return;
      connected = next;
      generation++;
      if (!connected) clear(true);
    },

    setContext(next: SmartCubeGuidanceContext | null) {
      if (disposed
        || (context?.id === next?.id
          && context?.scramble === next?.scramble
          && context?.orientation === next?.orientation
          && context?.targetFacelets === next?.targetFacelets)) return;
      context = next;
      generation++;
      clear(true);
    },

    setRunning(next: boolean) {
      if (disposed || running === next) return;
      running = next;
      if (running) {
        generation++;
        clear(false);
      }
    },

    /** Refresh from an authoritative state frame without manufacturing a move edge. */
    syncFacelets(facelets: string): SmartCubeGuidanceState {
      return evaluate(facelets, false).state;
    },

    snapshot: () => state,
  };
}

function observedTurn(from: string, to: string, move?: string): string | null {
  if (move) {
    const turn = faceTurnToken(move);
    return turn && cubeMove(from, turn) === to ? turn : null;
  }
  // Compatibility for state-only consumers: accept only an exact single turn.
  for (const face of 'URFDLB') {
    for (const suffix of ['', '2', "'"]) {
      const turn = face + suffix;
      if (cubeMove(from, turn) === to) return turn;
    }
  }
  return null;
}
