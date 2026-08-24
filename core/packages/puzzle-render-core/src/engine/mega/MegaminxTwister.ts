/**
 * MegaminxTwister — MegaminxCube's animation orchestrator. All the queue / setup / push /
 * twist / undo / redo machinery lives in the shared TweenTwister base; megaminx only
 * supplies its parser.
 */
import TweenTwister from '../TweenTwister';
import type MegaminxCube from './MegaminxCube';
import { parseMegaMoves, type MegaMove } from './megaState';

export default class MegaminxTwister extends TweenTwister<MegaMove> {
  constructor(cube: MegaminxCube) { super(cube); }
  protected parse(scramble: string): MegaMove[] { return parseMegaMoves(scramble); }
}
