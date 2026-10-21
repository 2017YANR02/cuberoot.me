/**
 * IvyTwister — IvyCube's animation orchestrator. The queue / setup / push /
 * twist / undo / redo machinery lives in the shared TweenTwister base; Ivy only
 * supplies its parser.
 */
import TweenTwister from '@cuberoot/puzzle-render-core/engine/TweenTwister';
import type IvyCube from './IvyCube';
import type { IvyMove } from './IvyCube';

export { parseIvyStandardMoves as parseIvyMoves } from '@cuberoot/puzzle-solvers/ivy';
import { parseIvyStandardMoves as parseIvyMoves } from '@cuberoot/puzzle-solvers/ivy';

export default class IvyTwister extends TweenTwister<IvyMove> {
  constructor(cube: IvyCube) { super(cube); }
  protected parse(scramble: string): IvyMove[] { return parseIvyMoves(scramble); }
}
