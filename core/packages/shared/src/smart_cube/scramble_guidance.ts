import {
  createSmartCubeFixupRequester,
  verifySmartCubeScramble,
  type SmartCubeFixupPath,
  type SmartCubeScrambleHint,
} from './scramble_hint';

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
  const pendingGenerations = new Set<number>();

  const emit = (next: SmartCubeGuidanceState): SmartCubeGuidanceState => {
    state = next;
    deps.onChange?.(state);
    return state;
  };

  const clear = (resetCompletion: boolean, notify = true) => {
    correction = null;
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
      const verification = verifySmartCubeScramble(
        context.scramble,
        targetFacelets,
        currentFacelets,
        correction,
      );
      wanted = verification.needsFixup;
      if (!verification.correctionActive) correction = null;
      emit({
        correctionActive: verification.correctionActive,
        hint: verification.match ? null : verification.hint,
        match: verification.match,
      });
    }).finally(() => {
      pendingGenerations.delete(requestGeneration);
    });
  };

  const evaluate = (
    facelets: string,
    allowCompletion: boolean,
  ): SmartCubeGuidanceObservation => {
    if (disposed || !connected || running || !context) {
      return { completedNow: false, state };
    }
    currentFacelets = facelets;
    if (guidanceComplete) {
      const next = facelets === context.targetFacelets
        ? { correctionActive: false, hint: null, match: true }
        : EMPTY_STATE;
      return { completedNow: false, state: emit(next) };
    }

    const verification = verifySmartCubeScramble(
      context.scramble,
      context.targetFacelets,
      facelets,
      correction,
    );
    wanted = verification.needsFixup;
    if (verification.match) {
      guidanceComplete = allowCompletion;
      wanted = false;
      correction = null;
      return {
        completedNow: allowCompletion,
        state: emit({ correctionActive: false, hint: null, match: true }),
      };
    }
    if (!verification.correctionActive) correction = null;
    const next = emit({
      correctionActive: verification.correctionActive,
      hint: verification.hint,
      match: false,
    });
    if (verification.needsFixup) requestCorrection(context.targetFacelets, generation);
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

    observe(facelets: string): SmartCubeGuidanceObservation {
      return evaluate(facelets, true);
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
