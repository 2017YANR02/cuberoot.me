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
import { normalizeWcaScramble } from '../normalize_wca_scramble';
import { invertAlg } from '../alg_transform';

export interface SmartCubeScrambleHint {
  done: string[];
  /** Remaining undo moves, displayed in red before the next normal move. */
  corrections?: string[];
  /** Stable display history, including completed undo turns; never used for cube state or storage. */
  displayMoves?: SmartCubeScrambleDisplayMove[];
  current: string | null;
  pending: string[];
  complete: boolean;
}

export type SmartCubeScrambleMoveState = 'done' | 'correction' | 'current' | 'pending';
export interface SmartCubeScrambleDisplayMove {
  id: number;
  move: string;
  /** Live remaining turn; a split half turn keeps its original display text. */
  token: string;
  state: SmartCubeScrambleMoveState;
}

function hintMoves(hint: SmartCubeScrambleHint): Omit<SmartCubeScrambleDisplayMove, 'id'>[] {
  return [
    ...hint.done.map(move => ({ move, state: 'done' as const })),
    ...(hint.corrections ?? []).map(move => ({ move, state: 'correction' as const })),
    ...(hint.current === null ? [] : [{ move: hint.current, state: 'current' as const }]),
    ...hint.pending.map(move => ({ move, state: 'pending' as const })),
  ].map(move => ({ ...move, token: move.move }));
}

export interface SmartCubeScrambleDisplayState {
  hint: SmartCubeScrambleHint | null;
  scramble?: string;
  moves: SmartCubeScrambleDisplayMove[];
  nextId: number;
}

/** Display-only history. Call for each observed move, before a UI can batch updates. */
export function projectSmartCubeScrambleDisplay(
  previous: SmartCubeScrambleDisplayState | null,
  hint: SmartCubeScrambleHint | null,
  scramble?: string,
): SmartCubeScrambleDisplayState {
  let nextId = previous?.nextId ?? 0;
  const incoming = hint ? hintMoves(hint) : [];
  let moves: SmartCubeScrambleDisplayMove[];
  const normalPath = (value: SmartCubeScrambleHint) => [...value.done, value.current, ...value.pending].filter(Boolean).join(' ');
  const reset = !hint || !previous?.hint || previous.scramble !== scramble
    || hint.done.length < previous.hint.done.length
    || (!hint.complete && !hint.corrections?.length && !previous.hint.corrections?.length
      && normalPath(hint) !== normalPath(previous.hint));
  if (reset) {
    moves = incoming.map(move => ({ ...move, id: nextId++ }));
  } else {
    const done = previous.moves.filter(move => move.state === 'done');
    const before = previous.moves.filter(move => move.state !== 'done');
    const after = incoming.filter(move => move.state !== 'done');
    // The unconsumed suffix retains its nodes and positions, even when an
    // inverse is inserted or a normal half-turn's remaining amount changes.
    let common = 0;
    while (common < before.length && common < after.length) {
      const oldMove = before[before.length - 1 - common];
      const newMove = after[after.length - 1 - common];
      const sameNormalFace = oldMove.state !== 'correction' && newMove.state !== 'correction'
        && oldMove.token[0] === newMove.token[0];
      const partialCorrection = oldMove.state === 'correction' && newMove.state === 'correction'
        && oldMove.token.endsWith('2') && oldMove.token[0] === newMove.token[0];
      if (oldMove.token !== newMove.token && !sameNormalFace && !partialCorrection) break;
      common++;
    }
    const removed = before.slice(0, before.length - common);
    const added = after.slice(0, after.length - common);
    moves = [
      ...done,
      // Only a consumed prefix completes. A newly wrong turn can replace the
      // inverse prefix, but must not mark that discarded advice as performed.
      ...(added.length === 0 ? removed.map(move => ({ ...move, state: 'done' as const })) : []),
      ...added.map(move => ({ ...move, id: nextId++ })),
      ...before.slice(before.length - common).map((move, index) => ({
        ...move, token: after[after.length - common + index].token, state: after[after.length - common + index].state,
      })),
    ];
  }
  return { hint, scramble, moves, nextId };
}

interface FaceTurn {
  face: string;
  quarters: 1 | 2 | 3;
  token: string;
  displayToken: string;
}

export function parseHintableSmartCubeScramble(scramble: string, orientation = ''): FaceTurn[] | null {
  const normalizedScramble = normalizeWcaScramble(scramble);
  if (normalizedScramble === null) return null;
  const tokens = normalizedScramble.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  const physicalTokens = normalizeWcaScramble(`${orientation} ${normalizedScramble}`)?.trim().split(/\s+/);
  if (!physicalTokens || physicalTokens.length !== tokens.length) return null;
  const turns: FaceTurn[] = [];
  for (const [index, token] of physicalTokens.entries()) {
    const parsed = faceTurnToken(token);
    if (!parsed) return null;
    const normalized = parsed.trim();
    turns.push({
      face: normalized[0],
      quarters: normalized.endsWith('2') ? 2 : normalized.endsWith("'") ? 3 : 1,
      token: normalized,
      displayToken: tokens[index],
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
  orientation = '',
): SmartCubeScrambleHint | null {
  return scrambleProgress(scramble, facelets, fromFacelets, orientation, false)?.hint ?? null;
}

export interface SmartCubeScrambleProgress {
  hint: SmartCubeScrambleHint;
  /** Exact remaining turns, including the unfinished half turn, in display coordinates. */
  remaining: string[];
}

/** Only half turns admit an intermediate quarter turn on the timer's active path. */
export function smartCubeScrambleProgress(
  scramble: string,
  facelets: string,
  fromFacelets: string = SOLVED_3X3,
  orientation = '',
): SmartCubeScrambleProgress | null {
  return scrambleProgress(scramble, facelets, fromFacelets, orientation, true);
}

function scrambleProgress(
  scramble: string,
  facelets: string,
  fromFacelets: string,
  orientation: string,
  strictPartial: boolean,
): SmartCubeScrambleProgress | null {
  const turns = parseHintableSmartCubeScramble(scramble, orientation);
  if (!turns
    || !cubieStateFromFacelets(facelets)
    || !cubieStateFromFacelets(fromFacelets)) return null;

  let currentFacelets = fromFacelets;
  let next = currentFacelets === facelets ? 0 : -1;
  let partial = 0;
  for (let index = 0; index < turns.length; index++) {
    const turn = turns[index];
    for (const quarters of [1, 2, 3] as const) {
      if (strictPartial && quarters !== turn.quarters && turn.quarters !== 2) continue;
      if (cubeMove(currentFacelets, turnToken(turn.face, quarters)) !== facelets) continue;
      next = quarters === turn.quarters ? index + 1 : index;
      partial = next === index ? quarters : 0;
      break;
    }
    if (next === index) break;
    currentFacelets = cubeMove(currentFacelets, turn.token);
  }
  if (next < 0) return null;
  const hint = {
    done: turns.slice(0, next).map((turn) => turn.displayToken),
    current: next < turns.length ? turns[next].displayToken : null,
    pending: turns.slice(next + 1).map((turn) => turn.displayToken),
    complete: next >= turns.length,
  };
  const remaining = turns.slice(next).map((turn) => turn.displayToken);
  if (partial && remaining.length) {
    remaining[0] = turnToken(remaining[0][0], ((turns[next].quarters - partial + 4) % 4) as 1 | 2 | 3);
  }
  return { hint, remaining };
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
  orientation = '',
): SmartCubeScrambleVerification {
  const match = currentFacelets === targetFacelets;
  if (fixup) {
    const correction = hintSmartCubeScramble(
      normalizeWcaScramble(`${invertAlg(orientation)} ${fixup.scramble}`) ?? fixup.scramble,
      currentFacelets,
      fixup.fromFacelets,
      orientation,
    );
    if (correction && !correction.complete) {
      return { correctionActive: true, hint: correction, match, needsFixup: false };
    }
  }
  const hint = hintSmartCubeScramble(scramble, currentFacelets, SOLVED_3X3, orientation);
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
          const hint = smartCubeScrambleProgress(scramble, currentFacelets, fromFacelets)?.hint;
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
