/**
 * GearTwister — GearCube's animation orchestrator. Queue / setup / undo machinery
 * lives in the shared TweenTwister base; gear supplies its parser and a tween
 * length scaled by the flip count (one flip = 180° face + 90° middle = 2 quarter
 * turns; multi-flip tokens sweep in one smooth compound, capped so U6 stays snappy).
 */
import TweenTwister from '../TweenTwister';
import { tweenDuration } from '../tweenTiming';
import type GearCube from './GearCube';
import { parseGearMoves, type GearMove } from './gearState';

export default class GearTwister extends TweenTwister<GearMove> {
  constructor(cube: GearCube) { super(cube); }
  protected parse(scramble: string): GearMove[] { return parseGearMoves(scramble); }
  protected framesFor(move: GearMove): number {
    return tweenDuration(Math.min(2 * Math.abs(move.amt), 6));
  }
}
