/**
 * MegaminxTwister — MegaminxCube's animation orchestrator. All the queue / setup / push /
 * twist / undo / redo machinery lives in the shared TweenTwister base; megaminx only
 * supplies its parser and (constant 72°) tween length.
 */
import TweenTwister from '../TweenTwister';
import { tweenDuration } from '../tweenTiming';
import type MegaminxCube from './MegaminxCube';
import { parseMegaMoves, type MegaMove } from './megaState';

export default class MegaminxTwister extends TweenTwister<MegaMove> {
  constructor(cube: MegaminxCube) { super(cube); }
  protected parse(scramble: string): MegaMove[] { return parseMegaMoves(scramble); }
  // Every megaminx turn is 72° = 0.8 of a 90° turn.
  protected framesFor(): number { return tweenDuration(0.8); }
}
