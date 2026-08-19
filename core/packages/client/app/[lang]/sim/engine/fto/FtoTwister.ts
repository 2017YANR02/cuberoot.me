/**
 * FtoTwister — FtoCube's animation orchestrator. The queue / setup / push / twist /
 * undo / redo machinery lives in the shared TweenTwister base; FTO only supplies its
 * parser.
 */
import TweenTwister from '../TweenTwister';
import type FtoCube from './FtoCube';
import type { FtoAnimationMove } from './ftoAnimation';
import { parseFtoMoves, type FtoMove } from './ftoState';

export default class FtoTwister extends TweenTwister<FtoAnimationMove> {
  constructor(cube: FtoCube) { super(cube); }
  protected parse(scramble: string): FtoMove[] { return parseFtoMoves(scramble); }

  /** Reset and apply already-parsed EIF moves without losing their extra layer semantics. */
  setupMoves(moves: readonly FtoAnimationMove[], init = ''): void {
    const t0 = performance.now();
    this.finish();
    this.cube.reset();
    for (const move of moves) this.cube.applyMoveInstant(move);
    this.cube.history.clear();
    this.cube.history.init = init;
    this.cube.dirty = true;
    this.lastSetupCpuMs = performance.now() - t0;
    for (const callback of this.cube.callbacks) callback();
  }

  /** Queue native EIF moves so a wide turn stays simultaneous and macros remain visible. */
  pushMoves(moves: readonly FtoAnimationMove[]): void {
    if (moves.length === 0) return;
    this.queue.push(...moves);
    this._kick();
  }
}
