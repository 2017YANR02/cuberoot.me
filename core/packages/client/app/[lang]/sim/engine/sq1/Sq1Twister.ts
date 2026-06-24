/**
 * Sq1Twister — Sq1Cube's animation orchestrator. The queue / setup / push /
 * undo / redo machinery lives in the shared TweenTwister base. SQ1 adds three
 * specializations: a magnitude-dependent tween length, a per-move slice
 * DIRECTION (which arc the 180° slice swings through), and a slice-legality gate
 * on the public `twist`.
 */
import TweenTwister from '../TweenTwister';
import { tweenDuration } from '../tweenTiming';
import { type PieceAnim } from '../pieceAnim';
import type Sq1Cube from './Sq1Cube';
import { parseSq1Scramble, isSlashValid, type Sq1Move } from './sq1State';

export default class Sq1Twister extends TweenTwister<Sq1Move> {
  /** Narrow the base's `cube` to the concrete type (Sq1Cube satisfies
   *  TweenCube<Sq1Move>) so the SQ1-specific surface (state, beginMove dir) is
   *  reachable without casts. */
  declare cube: Sq1Cube;
  /** Slice direction for the NEXT animated move (set by `twist`, consumed once by
   *  `beginAnims`). Queue playback leaves it undefined → inferred from sliceSolved. */
  private nextSliceDir?: 1 | -1;

  constructor(cube: Sq1Cube) { super(cube); }

  protected parse(scramble: string): Sq1Move[] { return parseSq1Scramble(scramble); }

  protected framesFor(move: Sq1Move): number {
    // Magnitude in 90° units: slice = 180° around the chord-perp axis; a turn =
    // max(|top|,|bot|) thirty-degree clicks.
    const d = move.kind === 'slice'
      ? 2
      : Math.max(Math.abs(move.top ?? 0), Math.abs(move.bot ?? 0)) / 3;
    return tweenDuration(d);
  }

  protected beginAnims(move: Sq1Move): PieceAnim[] {
    // dir priority: explicit (drag) > sliceSolved inference > +1. From solved the
    // first slice = -1 (R2 visual: east top half flips forward-down), alternating
    // after each flip. Turns ignore dir.
    let dir: 1 | -1 = 1;
    if (this.nextSliceDir !== undefined) dir = this.nextSliceDir;
    else if (move.kind === 'slice') dir = this.cube.state.sliceSolved ? -1 : 1;
    this.nextSliceDir = undefined; // consume
    return this.cube.beginMove(move, dir);
  }

  /** Slice gating: a `/` from a shape where a corner straddles the cut would pop
   *  the cube. The manual `/` button + equator tap route through here, so block at
   *  this seam too. (setup / push use applyMoveInstant and bypass this, so a typed
   *  scramble plays exactly as written.) `sliceDir` lets a drag pick the arc. */
  twist(move: Sq1Move, fast: boolean, force: boolean, sliceDir?: 1 | -1): boolean {
    if (move.kind === 'slice' && !isSlashValid(this.cube.state)) return false;
    this.nextSliceDir = sliceDir;
    const started = super.twist(move, fast, force);
    this.nextSliceDir = undefined; // clear if the fast / dropped path didn't consume it
    return started;
  }
}
