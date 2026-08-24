/**
 * PyraTwister — PyraCube's animation orchestrator. All the queue / setup / push /
 * twist / undo / redo machinery lives in the shared TweenTwister base; Pyraminx only
 * supplies its parser.
 */
import TweenTwister from '../TweenTwister';
import type PyraCube from './PyraCube';
import { parsePyraMoves, type PyraMove } from './pyraState';

export default class PyraTwister extends TweenTwister<PyraMove> {
  constructor(cube: PyraCube) { super(cube); }
  protected parse(scramble: string): PyraMove[] { return parsePyraMoves(scramble); }
}
