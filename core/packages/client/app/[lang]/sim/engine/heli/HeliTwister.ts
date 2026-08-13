/**
 * HeliTwister — HeliCube's animation orchestrator. All the queue / setup / push /
 * twist / undo / redo machinery lives in the shared TweenTwister base; Heli only
 * supplies its parser.
 */
import TweenTwister from '../TweenTwister';
import type HeliCube from './HeliCube';
import { parseHeliMoves, type HeliMove } from './heliState';

export default class HeliTwister extends TweenTwister<HeliMove> {
  constructor(cube: HeliCube) { super(cube); }
  protected parse(scramble: string): HeliMove[] { return parseHeliMoves(scramble); }
}
