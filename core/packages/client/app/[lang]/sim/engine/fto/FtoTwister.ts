/**
 * FtoTwister — FtoCube's animation orchestrator. The queue / setup / push / twist /
 * undo / redo machinery lives in the shared TweenTwister base; FTO only supplies its
 * parser.
 */
import TweenTwister from '../TweenTwister';
import type FtoCube from './FtoCube';
import { parseFtoMoves, type FtoMove } from './ftoState';

export default class FtoTwister extends TweenTwister<FtoMove> {
  constructor(cube: FtoCube) { super(cube); }
  protected parse(scramble: string): FtoMove[] { return parseFtoMoves(scramble); }
}
