/**
 * RediTwister — RediCube's animation orchestrator. The queue / setup / push /
 * twist / undo / redo machinery lives in the shared TweenTwister base; Redi only
 * supplies its parser and (constant 120°) tween length.
 */
import TweenTwister from '../TweenTwister';
import { tweenDuration } from '../tweenTiming';
import type RediCube from './RediCube';
import { parseRediMoves, type RediMove } from './rediState';

export default class RediTwister extends TweenTwister<RediMove> {
  constructor(cube: RediCube) { super(cube); }
  protected parse(scramble: string): RediMove[] { return parseRediMoves(scramble); }
  // Every Redi turn is 120° ≈ 4/3 of a 90° turn.
  protected framesFor(): number { return tweenDuration(4 / 3); }
}
