/**
 * Step-by-step scramble hinting.
 *
 * Today the smart cube gives a binary verdict: "scrambled" or "doesn't match".
 * That is the least useful moment to be told — the user has already applied 20
 * moves and now has to find which one went wrong. csTimer instead tells you
 * where you are in the scramble WHILE you apply it: the moves you have done go
 * dim, the one you owe is highlighted, the rest wait. This is the same thing.
 *
 * Ported from csTimer's `scrHinter.checkInSeq` (`tools/bluetoothutil.js:29`).
 * We work at the facelet level rather than the cubie level because the smart
 * cube tracker already speaks facelets; the algorithm is unchanged.
 *
 * The idea: replay the scramble one move at a time from solved, and at each
 * step ask whether ANY power of the next face reaches the state the cube is
 * actually in. If some power does:
 *   - it is the expected power  -> that move is finished, we are at i + 1
 *   - it is a different power   -> that move is half done, we are still at i
 * If no prefix of the scramble reaches the cube's state, the cube is off the
 * path entirely and there is nothing to highlight: `hintScramble` returns null
 * and the caller decides what to do (csTimer regenerates an equivalent
 * scramble from where the cube is — a separate unit, see SMART_CUBE_PROGRESS).
 *
 * Cost: at most 3 turns and one comparison per scramble move, i.e. ~60 facelet
 * turns for a 20-move scramble, recomputed on each turn of the cube. That is
 * nothing next to the BLE notification rate.
 */

import type { CubeFaces } from '../cube/state';
import { applyMoves, facesEqual, solved } from '../cube/state';
import { parseScramble } from '../cube/moves';
import type { ParsedMove } from '../cube/moves';

/** 3x3 only — every smart cube we support is a 3x3. */
const N = 3;

export interface ScrambleHint {
  /** Moves already applied, in scramble order. */
  done: string[];
  /**
   * The move the user owes next, or null when the scramble is complete.
   *
   * Rewritten to the REMAINING amount when the move is partly applied: a
   * scramble asking for `R2` when the cube has had one `R` reads as `R`, not
   * `R2`. That is the whole point of hinting — the string is what to do now,
   * not what the scramble said.
   */
  current: string | null;
  /** Moves after `current`, in scramble order. */
  pending: string[];
  /** True when the cube is in the fully scrambled state. */
  complete: boolean;
}

/** A scramble move we can hint on: one outer face, one quarter or half turn. */
interface FaceTurn {
  /** Index into `URFDLB`. */
  face: number;
  /** 1 = 90 cw, 2 = 180, 3 = 90 ccw. csTimer's `m[2]`. */
  quarters: 1 | 2 | 3;
}

const URFDLB = 'URFDLB';

/** Format a face turn back into WCA notation. */
function turnToString(t: FaceTurn): string {
  return URFDLB.charAt(t.face) + ['', '', '2', "'"][t.quarters];
}

/** One `ParsedMove` as a single-move array, for `applyMoves`. */
function asMoves(face: number, quarters: 1 | 2 | 3): ParsedMove[] {
  const amount = quarters === 1 ? 1 : quarters === 2 ? 2 : -1;
  return [{
    face: URFDLB.charAt(face) as ParsedMove['face'],
    amount,
    layers: 1,
    isRotation: false,
  }];
}

/**
 * Split a scramble into hintable face turns.
 *
 * Returns null if it contains anything a smart cube cannot report — wide
 * moves, slices, whole-cube rotations. Those appear in big-cube and FMC
 * scrambles, never in a WCA 3x3 scramble, and hinting on a move the cube
 * cannot see would strand the user on a step they can never complete.
 */
export function parseHintableScramble(scramble: string): FaceTurn[] | null {
  const parsed = parseScramble(scramble);
  if (parsed.length === 0) return null;
  const out: FaceTurn[] = [];
  for (const mv of parsed) {
    if (mv.isRotation || mv.layers !== 1) return null;
    const face = URFDLB.indexOf(mv.face);
    if (face < 0) return null;
    const quarters = mv.amount === 1 ? 1 : mv.amount === -1 ? 3 : 2;
    out.push({ face, quarters });
  }
  return out;
}

/**
 * Where in `scramble` the cube currently is.
 *
 * Returns null when the state is not on the scramble's path, which is the
 * signal that the user turned something the scramble never asked for.
 */
export function hintScramble(scramble: string, faces: CubeFaces): ScrambleHint | null {
  const seq = parseHintableScramble(scramble);
  if (!seq) return null;
  return hintFromSequence(seq, faces);
}

function hintFromSequence(seq: FaceTurn[], faces: CubeFaces): ScrambleHint | null {
  /** -1 = the state is not anywhere on this path. */
  const NOT_FOUND = -1;
  let cur = solved(N);
  /** Index of the move the user owes. `seq.length` means "scramble finished". */
  let next = NOT_FOUND;
  /** Quarters actually applied to the move at `next`, when it is partly done. */
  let partial: 1 | 2 | 3 | null = null;

  if (facesEqual(cur, faces)) next = 0;

  for (let i = 0; i < seq.length; i++) {
    // Only the iteration that stops the walk gets to declare a partial turn.
    partial = null;
    for (const q of [1, 2, 3] as const) {
      if (!facesEqual(applyMoves(cur, N, asMoves(seq[i].face, q)), faces)) continue;
      if (q === seq[i].quarters) {
        next = i + 1;           // this move is finished; keep walking forward
      } else {
        next = i;               // half done, with `q` of it applied
        partial = q;
      }
      break;
    }
    // `next === i` means this iteration did not get us past move i — either
    // nothing matched (so the furthest match was the previous iteration's
    // `i - 1 + 1`) or the match was a partial turn of move i. Either way the
    // walk is over. This is csTimer's `if (next == i) break`, and it is why an
    // ambiguous state (a scramble that revisits one, which needs a
    // cancellation) resolves to the EARLIEST position rather than the latest.
    if (next === i) break;
    cur = applyMoves(cur, N, asMoves(seq[i].face, seq[i].quarters));
  }

  if (next === NOT_FOUND) return null;

  const done = seq.slice(0, next).map(turnToString);
  const pending = seq.slice(next + 1).map(turnToString);
  let current: string | null = null;
  if (next < seq.length) {
    const t = seq[next];
    if (partial === null) {
      current = turnToString(t);
    } else {
      // Remaining quarters. csTimer's `(m[2] - pow + 7) % 4`, where its `pow`
      // is `partial - 1`. It only applies this rewrite at position 0
      // (`next == 0 && i == 0`, bluetoothutil.js:62); we apply it wherever the
      // partial move is, because a user who has done one R of an R2 in the
      // middle of the scramble needs to be told "R" there just as much.
      const remaining = ((t.quarters - (partial - 1) + 7) % 4) as 0 | 1 | 2 | 3;
      // remaining === 0 cannot happen: a power that completes the move would
      // have matched the expected-power branch above.
      current = remaining === 0 ? turnToString(t) : turnToString({ face: t.face, quarters: remaining as 1 | 2 | 3 });
    }
  }

  return { done, current, pending, complete: next >= seq.length };
}
