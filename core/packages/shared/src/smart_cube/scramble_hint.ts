import {
  cubeMove,
  faceTurnToken,
  SOLVED_3X3,
} from '@cuberoot/puzzle-solvers/timer-333-cube';
import {
  inverseCubie,
  isSolvedCubie,
  multiply,
  type CubieCube,
} from '@cuberoot/puzzle-solvers/kociemba/cube';

import { cubieStateFromFacelets, type CubieState } from './cubie';

export interface SmartCubeScrambleHint {
  done: string[];
  current: string | null;
  pending: string[];
  complete: boolean;
}

interface FaceTurn {
  face: string;
  quarters: 1 | 2 | 3;
  token: string;
}

export function parseHintableSmartCubeScramble(scramble: string): FaceTurn[] | null {
  const tokens = scramble.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  const turns: FaceTurn[] = [];
  for (const token of tokens) {
    const parsed = faceTurnToken(token);
    if (!parsed) return null;
    const normalized = parsed.trim();
    turns.push({
      face: normalized[0],
      quarters: normalized.endsWith('2') ? 2 : normalized.endsWith("'") ? 3 : 1,
      token: normalized,
    });
  }
  return turns;
}

function turnToken(face: string, quarters: 1 | 2 | 3): string {
  return `${face}${quarters === 1 ? '' : quarters === 2 ? '2' : "'"}`;
}

/** csTimer-compatible move-by-move guidance over canonical URFDLB facelets. */
export function hintSmartCubeScramble(
  scramble: string,
  facelets: string,
  fromFacelets: string = SOLVED_3X3,
): SmartCubeScrambleHint | null {
  const turns = parseHintableSmartCubeScramble(scramble);
  if (!turns
    || !cubieStateFromFacelets(facelets)
    || !cubieStateFromFacelets(fromFacelets)) return null;

  let currentFacelets = fromFacelets;
  let next = currentFacelets === facelets ? 0 : -1;
  for (let index = 0; index < turns.length; index++) {
    const turn = turns[index];
    for (const quarters of [1, 2, 3] as const) {
      if (cubeMove(currentFacelets, turnToken(turn.face, quarters)) !== facelets) continue;
      next = quarters === turn.quarters ? index + 1 : index;
      break;
    }
    if (next === index) break;
    currentFacelets = cubeMove(currentFacelets, turn.token);
  }
  if (next < 0) return null;
  return {
    done: turns.slice(0, next).map((turn) => turn.token),
    current: next < turns.length ? turns[next].token : null,
    pending: turns.slice(next + 1).map((turn) => turn.token),
    complete: next >= turns.length,
  };
}

export interface SmartCubeFixupPath {
  fromFacelets: string;
  scramble: string;
}

export interface SmartCubeScrambleVerification {
  correctionActive: boolean;
  hint: SmartCubeScrambleHint | null;
  match: boolean;
  needsFixup: boolean;
}

/** One shared correction-first verdict for the Web and installed timer views. */
export function verifySmartCubeScramble(
  scramble: string,
  targetFacelets: string,
  currentFacelets: string,
  fixup: SmartCubeFixupPath | null,
): SmartCubeScrambleVerification {
  const match = currentFacelets === targetFacelets;
  if (fixup) {
    const correction = hintSmartCubeScramble(
      fixup.scramble,
      currentFacelets,
      fixup.fromFacelets,
    );
    if (correction && !correction.complete) {
      return { correctionActive: true, hint: correction, match, needsFixup: false };
    }
  }
  const hint = hintSmartCubeScramble(scramble, currentFacelets);
  return {
    correctionActive: false,
    hint,
    match,
    needsFixup: !match && hint === null,
  };
}

function solverCubie(state: CubieState): CubieCube {
  return {
    cp: state.ca.map((value) => value & 7),
    co: state.ca.map((value) => value >> 3),
    ep: state.ea.map((value) => value >> 1),
    eo: state.ea.map((value) => value & 1),
  };
}

/** The generator X in from * X = target, ready for the shared Kociemba solver. */
export function smartCubeFixupState(
  fromFacelets: string,
  targetFacelets: string,
): CubieCube | null {
  const from = cubieStateFromFacelets(fromFacelets);
  const target = cubieStateFromFacelets(targetFacelets);
  if (!from || !target) return null;
  const fixup = multiply(inverseCubie(solverCubie(from)), solverCubie(target));
  return isSolvedCubie(fixup) ? null : fixup;
}

export interface SmartCubeFixupResult extends SmartCubeFixupPath {
  hint: SmartCubeScrambleHint;
}

export interface SmartCubeFixupRequester {
  busy(): boolean;
  request(targetFacelets: string): Promise<SmartCubeFixupResult | null>;
}

export interface SmartCubeFixupDeps {
  facelets(): string | null;
  solve(fromFacelets: string, targetFacelets: string): Promise<string | null>;
  valid(targetFacelets: string): boolean;
}

/** Serializes correction solves and retries when the cube moves during one. */
export function createSmartCubeFixupRequester(
  deps: SmartCubeFixupDeps,
  attempts = 3,
): SmartCubeFixupRequester {
  let active: {
    targetFacelets: string;
    promise: Promise<SmartCubeFixupResult | null>;
  } | null = null;

  const request = async (targetFacelets: string): Promise<SmartCubeFixupResult | null> => {
    if (active) {
      if (active.targetFacelets === targetFacelets) return active.promise;
      await active.promise;
      return request(targetFacelets);
    }

    const promise = (async () => {
      try {
        for (let attempt = 0; attempt < attempts; attempt++) {
          const fromFacelets = deps.facelets();
          if (!fromFacelets || !deps.valid(targetFacelets)) return null;
          const scramble = await deps.solve(fromFacelets, targetFacelets);
          if (!scramble || !deps.valid(targetFacelets)) return null;
          const currentFacelets = deps.facelets() ?? fromFacelets;
          const hint = hintSmartCubeScramble(scramble, currentFacelets, fromFacelets);
          if (hint?.complete) return null;
          if (hint) return { fromFacelets, scramble, hint };
        }
        return null;
      } catch {
        return null;
      }
    })();
    active = { targetFacelets, promise };
    try {
      return await promise;
    } finally {
      if (active?.promise === promise) active = null;
    }
  };

  return {
    busy: () => active !== null,
    request,
  };
}
