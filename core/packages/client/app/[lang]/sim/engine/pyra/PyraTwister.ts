/**
 * PyraTwister — PyraCube's animation orchestrator. All the queue / setup / push /
 * twist / undo / redo machinery lives in the shared TweenTwister base; Pyraminx only
 * supplies its parser and (constant 120°) tween length.
 */
import TweenTwister from '../TweenTwister';
import { tweenDuration } from '../tweenTiming';
import type PyraCube from './PyraCube';
import { parsePyraMoves, type PyraMove } from './pyraState';

export default class PyraTwister extends TweenTwister<PyraMove> {
  constructor(cube: PyraCube) { super(cube); }
  protected parse(scramble: string): PyraMove[] { return parsePyraMoves(scramble); }
  // Every pyraminx turn (corner or tip) is 120° ≈ 4/3 of a 90° turn.
  protected framesFor(): number { return tweenDuration(4 / 3); }
}
