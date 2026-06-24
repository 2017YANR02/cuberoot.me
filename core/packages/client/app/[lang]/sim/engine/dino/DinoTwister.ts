/**
 * DinoTwister — DinoCube's animation orchestrator. All the queue / setup / push /
 * twist / undo / redo machinery lives in the shared TweenTwister base; Dino only
 * supplies its parser and (constant 120°) tween length.
 */
import TweenTwister from '../TweenTwister';
import { tweenDuration } from '../tweenTiming';
import type DinoCube from './DinoCube';
import { parseDinoMoves, type DinoMove } from './dinoState';

export default class DinoTwister extends TweenTwister<DinoMove> {
  constructor(cube: DinoCube) { super(cube); }
  protected parse(scramble: string): DinoMove[] { return parseDinoMoves(scramble); }
  // Every Dino turn is 120° ≈ 4/3 of a 90° turn.
  protected framesFor(): number { return tweenDuration(4 / 3); }
}
