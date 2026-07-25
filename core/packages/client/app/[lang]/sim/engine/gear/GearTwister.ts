/**
 * GearTwister — GearCube's animation orchestrator. Queue / setup / undo machinery
 * lives in the shared TweenTwister base; gear supplies its parser and a tween
 * length scaled by the flip count (one flip = 180° face + 90° middle = 2 quarter
 * turns; multi-flip tokens sweep in one smooth compound, capped so U6 stays snappy).
 */
import TweenTwister from '../TweenTwister';
import { tweenDuration } from '../tweenTiming';
import type GearCube from './GearCube';
import { parseGearMoves, isGearRot, type GearAnyMove } from './gearState';

export default class GearTwister extends TweenTwister<GearAnyMove> {
  constructor(cube: GearCube) { super(cube); }
  protected parse(scramble: string): GearAnyMove[] { return parseGearMoves(scramble); }
  protected framesFor(move: GearAnyMove): number {
    // A whole-cube rotation is a 90° (or 180° for x2) reorientation, timed like a
    // normal quarter / half turn.
    if (isGearRot(move)) return tweenDuration(move.dir === 2 ? 2 : 1);
    return tweenDuration(Math.min(2 * Math.abs(move.amt), 6));
  }
}
