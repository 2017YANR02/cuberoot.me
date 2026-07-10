/**
 * SkewbTwister — SkewbCube's animation orchestrator. All the queue / setup / push /
 * twist / undo / redo machinery lives in the shared TweenTwister base; Skewb only
 * supplies its parser and (constant 120°) tween length.
 */
import TweenTwister from '../TweenTwister';
import { tweenDuration } from '../tweenTiming';
import type SkewbCube from './SkewbCube';
import { parseSkewbMoves, isSkewbRot, type SkewbMove } from './skewbState';

export default class SkewbTwister extends TweenTwister<SkewbMove> {
  constructor(cube: SkewbCube) { super(cube); }
  protected parse(scramble: string): SkewbMove[] { return parseSkewbMoves(scramble); }
  // A grip twist is 120° ≈ 4/3 of a 90° turn; a whole-cube rotation is a 90° (or 180°
  // for x2) reorientation, timed like a normal quarter / half turn.
  protected framesFor(move: SkewbMove): number {
    if (isSkewbRot(move)) return tweenDuration(move.dir === 2 ? 2 : 1);
    return tweenDuration(4 / 3);
  }
}
