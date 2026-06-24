/**
 * SkewbTwister — SkewbCube's animation orchestrator. All the queue / setup / push /
 * twist / undo / redo machinery lives in the shared TweenTwister base; Skewb only
 * supplies its parser and (constant 120°) tween length.
 */
import TweenTwister from '../TweenTwister';
import { tweenDuration } from '../tweenTiming';
import type SkewbCube from './SkewbCube';
import { parseSkewbMoves, type SkewbMove } from './skewbState';

export default class SkewbTwister extends TweenTwister<SkewbMove> {
  constructor(cube: SkewbCube) { super(cube); }
  protected parse(scramble: string): SkewbMove[] { return parseSkewbMoves(scramble); }
  // Every Skewb turn is 120° ≈ 4/3 of a 90° turn.
  protected framesFor(): number { return tweenDuration(4 / 3); }
}
