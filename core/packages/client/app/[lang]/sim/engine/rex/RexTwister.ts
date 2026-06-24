/**
 * RexTwister — RexCube's animation orchestrator. All the queue / setup / push /
 * twist / undo / redo machinery lives in the shared TweenTwister base; Rex only
 * supplies its parser and (constant 120°) tween length.
 */
import TweenTwister from '../TweenTwister';
import { tweenDuration } from '../tweenTiming';
import type RexCube from './RexCube';
import { parseRexMoves, type RexMove } from './rexState';

export default class RexTwister extends TweenTwister<RexMove> {
  constructor(cube: RexCube) { super(cube); }
  protected parse(scramble: string): RexMove[] { return parseRexMoves(scramble); }
  // Every Rex turn is 120° ≈ 4/3 of a 90° turn.
  protected framesFor(): number { return tweenDuration(4 / 3); }
}
