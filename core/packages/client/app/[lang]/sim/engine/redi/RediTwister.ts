/**
 * RediTwister — RediCube's animation orchestrator. The queue / setup / push /
 * twist / undo / redo machinery lives in the shared TweenTwister base; Redi only
 * supplies its parser.
 */
import TweenTwister from '../TweenTwister';
import type RediCube from './RediCube';
import { parseRediMoves, type RediMove } from './rediState';

export default class RediTwister extends TweenTwister<RediMove> {
  constructor(cube: RediCube) { super(cube); }
  protected parse(scramble: string): RediMove[] { return parseRediMoves(scramble); }
}
