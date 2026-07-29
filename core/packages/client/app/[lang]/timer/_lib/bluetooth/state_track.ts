/**
 * Move-stream → cube-state tracker.
 *
 * Drivers emit moves one at a time as plain WCA face notation strings
 * (e.g. `R`, `R'`, `R2`, `U`). We keep a 3x3 face state, apply each
 * incoming move, and expose `isSolved()` so the hook can fire `onSolved`
 * when the cube reaches the canonical solved configuration.
 *
 * Reset semantics: the user is expected to physically reset the cube to
 * solved before each scramble. Calling `reset()` re-initializes our model
 * to a fresh solved cube so that the next stream of moves represents a
 * complete scramble→solve trajectory.
 */

import { applyMoves, facesEqual, fromFaceletString, solved } from '../cube/state';
import type { CubeFaces } from '../cube/state';
import { parseScramble } from '../cube/moves';

const N = 3;

export class CubeStateTracker {
  private state: CubeFaces;
  private readonly solvedRef: CubeFaces;

  constructor() {
    this.solvedRef = solved(N);
    this.state = solved(N);
  }

  /** Re-initialize the tracked state to a solved cube. */
  reset(): void {
    this.state = solved(N);
  }

  /**
   * Adopt a state the CUBE reported about itself (54-char facelet string, see
   * `CubeDriverContext.onState`). Returns false — leaving our state untouched —
   * if the string is malformed.
   *
   * This is what makes "assume the cube starts solved" unnecessary: pairing a
   * cube that is already scrambled, or reconnecting after a drop the user
   * turned through, both land here instead of silently starting from a wrong
   * baseline.
   */
  adoptFacelets(facelets: string): boolean {
    const faces = fromFaceletString(facelets);
    if (!faces) return false;
    this.state = faces;
    return true;
  }

  /**
   * Apply one move (WCA face notation, single token like `R` or `R'`).
   * Returns true if the cube is now in a solved configuration. Tokens that
   * don't parse to any move (whitespace, comments, megaminx ++/--) are
   * silently ignored.
   */
  applyMove(move: string): boolean {
    const parsed = parseScramble(move);
    if (parsed.length === 0) return facesEqual(this.state, this.solvedRef);
    this.state = applyMoves(this.state, N, parsed);
    return facesEqual(this.state, this.solvedRef);
  }

  isSolved(): boolean {
    return facesEqual(this.state, this.solvedRef);
  }

  /** Read-only snapshot of the current facelet state. Used by CFOP stage
   *  detection. We return a shallow-cloned copy so the caller can't mutate
   *  our internal state. */
  getFaces(): CubeFaces {
    return {
      U: this.state.U.slice(),
      D: this.state.D.slice(),
      F: this.state.F.slice(),
      B: this.state.B.slice(),
      L: this.state.L.slice(),
      R: this.state.R.slice(),
    };
  }
}
