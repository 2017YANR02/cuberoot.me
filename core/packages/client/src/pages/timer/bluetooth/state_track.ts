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

import { applyMoves, facesEqual, solved } from '../cube/state';
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
}
