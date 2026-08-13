/**
 * DinoTwister — DinoCube's animation orchestrator. All the queue / setup / push /
 * twist / undo / redo machinery lives in the shared TweenTwister base; Dino only
 * supplies its parser.
 */
import TweenTwister from '../TweenTwister';
import type DinoCube from './DinoCube';
import { parseDinoMoves, type DinoMove } from './dinoState';

export default class DinoTwister extends TweenTwister<DinoMove> {
  constructor(cube: DinoCube) { super(cube); }
  protected parse(scramble: string): DinoMove[] { return parseDinoMoves(scramble); }
}
