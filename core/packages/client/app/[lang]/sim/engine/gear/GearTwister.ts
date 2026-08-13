/**
 * GearTwister — GearCube's animation orchestrator. Queue / setup / undo machinery
 * lives in the shared TweenTwister base; gear supplies its parser.
 */
import TweenTwister from '../TweenTwister';
import type GearCube from './GearCube';
import { parseGearMoves, type GearAnyMove } from './gearState';

export default class GearTwister extends TweenTwister<GearAnyMove> {
  constructor(cube: GearCube) { super(cube); }
  protected parse(scramble: string): GearAnyMove[] { return parseGearMoves(scramble); }
}
