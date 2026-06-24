/**
 * HeliTwister — HeliCube's animation orchestrator. All the queue / setup / push /
 * twist / undo / redo machinery lives in the shared TweenTwister base; Heli only
 * supplies its parser and (constant 180°) tween length.
 */
import TweenTwister from '../TweenTwister';
import { tweenDuration } from '../tweenTiming';
import type HeliCube from './HeliCube';
import { parseHeliMoves, type HeliMove } from './heliState';

export default class HeliTwister extends TweenTwister<HeliMove> {
  constructor(cube: HeliCube) { super(cube); }
  protected parse(scramble: string): HeliMove[] { return parseHeliMoves(scramble); }
  // Every Helicopter turn is 180° = 2× a 90° turn.
  protected framesFor(): number { return tweenDuration(2); }
}
