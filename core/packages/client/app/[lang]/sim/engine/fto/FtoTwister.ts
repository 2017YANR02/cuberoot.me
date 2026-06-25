/**
 * FtoTwister — FtoCube's animation orchestrator. The queue / setup / push / twist /
 * undo / redo machinery lives in the shared TweenTwister base; FTO only supplies its
 * parser and (constant 120°) tween length.
 */
import TweenTwister from '../TweenTwister';
import { tweenDuration } from '../tweenTiming';
import type FtoCube from './FtoCube';
import { parseFtoMoves, type FtoMove } from './ftoState';

export default class FtoTwister extends TweenTwister<FtoMove> {
  constructor(cube: FtoCube) { super(cube); }
  protected parse(scramble: string): FtoMove[] { return parseFtoMoves(scramble); }
  // Every FTO face turn is 120° ≈ 4/3 of a 90° turn.
  protected framesFor(): number { return tweenDuration(4 / 3); }
}
