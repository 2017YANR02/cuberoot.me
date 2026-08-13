/**
 * RexTwister — RexCube's animation orchestrator. All the queue / setup / push /
 * twist / undo / redo machinery lives in the shared TweenTwister base; Rex only
 * supplies its parser.
 */
import TweenTwister from '../TweenTwister';
import type RexCube from './RexCube';
import { parseRexMoves, type RexMove } from './rexState';

export default class RexTwister extends TweenTwister<RexMove> {
  constructor(cube: RexCube) { super(cube); }
  protected parse(scramble: string): RexMove[] { return parseRexMoves(scramble); }
}
