/**
 * SkewbTwister — SkewbCube's animation orchestrator. All the queue / setup / push /
 * twist / undo / redo machinery lives in the shared TweenTwister base; Skewb only
 * supplies its parser.
 */
import TweenTwister from '../TweenTwister';
import type SkewbCube from './SkewbCube';
import { parseSkewbMoves, type SkewbMove } from './skewbState';

export default class SkewbTwister extends TweenTwister<SkewbMove> {
  constructor(cube: SkewbCube) { super(cube); }
  protected parse(scramble: string): SkewbMove[] { return parseSkewbMoves(scramble); }
}
