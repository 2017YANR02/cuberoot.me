/**
 * TweenTwister — animation orchestrator shared by the non-NxN cuber engines
 * (Ivy / Dino / Redi / SQ1). Uses the global `tweener` so the sim's offline mp4
 * export (`tweener.paused=true` + manual `tweener.update()` stepping) records every puzzle.
 * One tween per move; frames synced with the speed slider via `tweenTiming`.
 *
 * Subclass and implement `parse` + `framesFor`. Override `beginAnims` / `twist`
 * for puzzle quirks (SQ1 threads a slice direction + gates illegal slices).
 *
 * Playback contract (relied on by PlayerControls' completion-driven play loop):
 *   twist(move, false, false) returns false while a turn is mid-animation, so the
 *   caller waits and the current turn always finishes before the next begins.
 *   Do NOT reintroduce force=true on a fixed-interval timer — it truncates the
 *   in-progress turn.
 */
import tweener, { type Tween } from './tweener';
import { applyAnimFrame, type PieceAnim } from './pieceAnim';
import type MoveHistory from './MoveHistory';

/** The cube surface a TweenTwister drives. All four engines conform. */
export interface TweenCube<TMove> {
  beginMove(move: TMove): PieceAnim[];
  finishMove(anims: PieceAnim[], move: TMove): void;
  /** Snap to end pose + advance discrete state + record history. */
  applyMoveInstant(move: TMove): void;
  /** Snap to end pose + advance discrete state, but do NOT record history
   *  (used by undo/redo replay). */
  applyMoveSilent(move: TMove): void;
  reset(): void;
  history: MoveHistory;
  callbacks: (() => void)[];
  dirty: boolean;
}

export default abstract class TweenTwister<TMove> {
  cube: TweenCube<TMove>;
  queue: TMove[] = [];
  protected activeTween: Tween | null = null;
  /** ms-tracking field read by PlayerControls' perf overlay. */
  lastSetupCpuMs = 0;

  constructor(cube: TweenCube<TMove>) { this.cube = cube; }

  /** Parse a scramble / alg string into discrete moves. */
  protected abstract parse(scramble: string): TMove[];
  /** Tween length in frames for `move` (magnitude-dependent). */
  protected abstract framesFor(move: TMove): number;
  /** Anims for a move; override to inject a direction (SQ1 slice). */
  protected beginAnims(move: TMove): PieceAnim[] { return this.cube.beginMove(move); }

  get length(): number { return this.queue.length; }

  /** Flush all pending tweens to their end states. */
  finish(): void {
    // splice the queue FIRST: tweener.finish synchronously fires the active
    // tween's v=1 callback, which _kick()s the next queued move into a NEW tween;
    // clearing activeTween afterwards would orphan that NEW tween (tweener keeps
    // updating it but we lose the handle → it mutates pivots post-reset). Empty
    // queue → _kick is a no-op, so activeTween = null is the true terminator.
    const pending = this.queue.splice(0);
    if (this.activeTween) {
      tweener.finish(this.activeTween);
      this.activeTween = null;
    }
    for (const m of pending) this.cube.applyMoveInstant(m);
  }

  /** Reset cube + apply scramble instantly. Clears history. */
  setup(scramble: string): void {
    const t0 = performance.now();
    this.finish();
    this.cube.reset();
    for (const m of this.parse(scramble)) this.cube.applyMoveInstant(m);
    this.cube.history.clear();
    this.cube.history.init = scramble;
    this.cube.dirty = true;
    this.lastSetupCpuMs = performance.now() - t0;
    for (const cb of this.cube.callbacks) cb();
  }

  /** Async variant — these puzzles are fast enough to be sync, but
   *  PlayerControls expects an awaitable. */
  setupAsync(scramble: string): Promise<void> {
    this.setup(scramble);
    return Promise.resolve();
  }

  /** Queue moves for animated playback. */
  push(scramble: string): void {
    const moves = this.parse(scramble);
    if (moves.length === 0) return;
    for (const m of moves) this.queue.push(m);
    this._kick();
  }

  /** Apply or animate one move.
   *   - fast=true  : instant snap, no animation
   *   - force=true : flush an active tween first, then animate
   *   - default    : if a tween is active, drop the move (return false) */
  twist(move: TMove, fast: boolean, force: boolean): boolean {
    if (fast) { this.cube.applyMoveInstant(move); return true; }
    if (force && this.activeTween) {
      tweener.finish(this.activeTween);
      this.activeTween = null;
    }
    if (this.activeTween) return false;
    this._animate(move);
    return true;
  }

  undo(): void {
    if (this.cube.history.moves.length === 0) return;
    const last = this.cube.history.moves.pop()!;
    this.cube.history.redoStack.push(last);
    this._replaySilently();
  }

  redo(): void {
    const next = this.cube.history.redoStack.pop();
    if (!next) return;
    this.cube.history.moves.push(next);
    this._replaySilently();
  }

  /** Rebuild the cube from history.init + history.moves without re-recording
   *  (the move list was already mutated by undo/redo). */
  protected _replaySilently(): void {
    this.finish();
    this.cube.reset();
    const replay = (this.cube.history.init + ' ' + this.cube.history.moves.join(' ')).trim();
    for (const m of this.parse(replay)) this.cube.applyMoveSilent(m);
    this.cube.dirty = true;
    for (const cb of this.cube.callbacks) cb();
  }

  protected _kick(): void {
    if (this.activeTween) return;
    const next = this.queue.shift();
    if (!next) return;
    this._animate(next);
  }

  protected _animate(move: TMove): void {
    const anims = this.beginAnims(move);
    const frames = Math.max(2, Math.round(this.framesFor(move)));
    this.activeTween = tweener.tween(0, 1, frames, (v) => {
      applyAnimFrame(anims, v);
      this.cube.dirty = true;
      if (v >= 1) {
        this.cube.finishMove(anims, move);
        this.activeTween = null;
        this._kick();
        return true;
      }
      return false;
    });
  }
}
