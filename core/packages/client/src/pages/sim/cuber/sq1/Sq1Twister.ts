/**
 * Sq1Twister — animation orchestrator for Sq1Cube.
 *
 * Uses the global `tweener` (cuber/tweener.ts) so DirectorPanel's offline
 * `tweener.paused=true` + manual `tweener.update()` stepping records sq1 too.
 *
 * Per move: one tween, frames = CubeGroup.frames (synced with NxN speed slider
 * via PlayerControls). Each frame the callback slerps pivot.quat + lerps
 * pivot.pos between the begin/end snapshots Sq1Cube provided.
 */
import * as THREE from 'three';
import tweener, { type Tween } from '../tweener';
import CubeGroup from '../group';
import type Sq1Cube from './Sq1Cube';
import type { PieceAnim } from './Sq1Cube';
import { parseSq1Scramble, applySq1Move, isSlashValid, type Sq1Move } from './sq1State';

export default class Sq1Twister {
  cube: Sq1Cube;
  /** Pending moves waiting to be animated. */
  queue: Sq1Move[] = [];
  private activeTween: Tween | null = null;
  /** ms-tracking field used by PlayerControls perf overlay (sq1 sync setup → 0). */
  lastSetupCpuMs = 0;

  constructor(cube: Sq1Cube) {
    this.cube = cube;
  }

  get length(): number {
    return this.queue.length;
  }

  /** Flush all pending tweens to their end states. */
  finish(): void {
    if (this.activeTween) {
      tweener.finish(this.activeTween);
      this.activeTween = null;
    }
    while (this.queue.length > 0) {
      const m = this.queue.shift()!;
      this.cube.applyMoveInstant(m);
    }
  }

  /** Reset cube and apply scramble instantly. Clears history. */
  setup(scramble: string): void {
    const t0 = performance.now();
    this.finish();
    this.cube.reset();
    const moves = parseSq1Scramble(scramble);
    for (const m of moves) this.cube.applyMoveInstant(m);
    this.cube.history.clear();
    this.cube.history.init = scramble;
    this.cube.dirty = true;
    this.lastSetupCpuMs = performance.now() - t0;
    for (const cb of this.cube.callbacks) cb();
  }

  /** Async variant — sq1 is fast enough to be sync, but PlayerControls
   *  expects an awaitable. */
  setupAsync(scramble: string): Promise<void> {
    this.setup(scramble);
    return Promise.resolve();
  }

  /** Queue moves for animated playback. */
  push(scramble: string): void {
    const moves = parseSq1Scramble(scramble);
    if (moves.length === 0) return;
    for (const m of moves) this.queue.push(m);
    this._kick();
  }

  /** Apply or animate one move.
   *   - fast=true       : instant snap, no animation
   *   - force=true      : if a tween is active, flush it then animate
   *   - default         : if locked, return false (drop the move)
   *
   *  Slice gating: a `/` from a shape where a corner straddles the cut would
   *  pop the cube. The drag commit already refuses to leave that shape, but
   *  the manual `/` button and equator-slab tap go through here, so we also
   *  block at this seam. (Scramble loading uses applyMoveInstant via setup
   *  / push, which bypass this check — typed scrambles play exactly as
   *  written even if they pop.) */
  twist(move: Sq1Move, fast: boolean, force: boolean, sliceDir?: 1 | -1): boolean {
    if (move.kind === 'slice' && !isSlashValid(this.cube.state)) return false;
    if (fast) {
      this.cube.applyMoveInstant(move);
      return true;
    }
    if (force && this.activeTween) {
      tweener.finish(this.activeTween);
      this.activeTween = null;
    }
    if (this.activeTween) return false;
    this._animate(move, sliceDir);
    return true;
  }

  /** Replay-based undo. SQ1 sequences are short — replaying the entire history
   *  on each undo is fine. */
  undo(): void {
    if (this.cube.history.moves.length === 0) return;
    const last = this.cube.history.moves.pop()!;
    this.cube.history.redoStack.push(last);
    const replay = this.cube.history.init + ' ' + this.cube.history.moves.join(' ');
    const moves = parseSq1Scramble(replay);
    this._silentApply(moves);
  }

  redo(): void {
    const next = this.cube.history.redoStack.pop();
    if (!next) return;
    this.cube.history.moves.push(next);
    const replay = this.cube.history.init + ' ' + this.cube.history.moves.join(' ');
    const moves = parseSq1Scramble(replay);
    this._silentApply(moves);
  }

  private _silentApply(moves: Sq1Move[]): void {
    this.finish();
    this.cube.reset();
    for (const m of moves) {
      const anims = this.cube.beginMove(m);
      for (const a of anims) {
        a.pivot.quaternion.copy(a.endQuat);
        a.pivot.position.copy(a.endPos);
      }
      // State change without history mutation (we're replaying current history).
      this.cube.state = applySq1Move(this.cube.state, m);
    }
    this.cube.dirty = true;
    for (const cb of this.cube.callbacks) cb();
  }

  private _kick(): void {
    if (this.activeTween) return;
    const next = this.queue.shift();
    if (!next) return;
    this._animate(next);
  }

  private _animate(move: Sq1Move, sliceDir?: 1 | -1): void {
    // dir 优先级:显式参数 > state.sliceSolved 推断 > +1。
    // queue 播放 / 单步 scrub 不传 dir,走 sliceSolved:从 solved 出发第 1 个
    // slice = -1 (R2 视觉,东半顶层向前翻下来),翻面后下一个 = +1,依次交替。
    // 手 drag 触发显式传 dy 符号,不走这条。
    let dir: 1 | -1 = 1;
    if (sliceDir !== undefined) {
      dir = sliceDir;
    } else if (move.kind === 'slice') {
      dir = this.cube.state.sliceSolved ? -1 : 1;
    }
    const anims: PieceAnim[] = this.cube.beginMove(move, dir);
    // Magnitude in 90° units, so CubeGroup.tweenDuration gives the same curve
    // NxN twists use: 30° → 0.5×frames, 90° → frames, 180° → ~1.33×frames.
    const d = move.kind === 'slice'
      ? 2  // 180° around chord-perp axis
      : Math.max(Math.abs(move.top ?? 0), Math.abs(move.bot ?? 0)) / 3;
    const frames = Math.max(2, Math.round(CubeGroup.tweenDuration(d)));
    // Interpolate as q(angle·v, axis) instead of slerp(start, end, v): slerp's
    // shortest-path flip at dot<0 is non-deterministic when the start↔end pair
    // is 90° apart in quaternion space (= 180° rotation), so top=±6 randomly
    // swings the wrong way depending on float drift from prior moves.
    // Direct axis-angle keeps the sign of `angle` as the source of truth.
    const deltaCur = new THREE.Quaternion();
    // tweener.update() applies Quadratic.Out easing; `v` here is the post-easing
    // 0..1, same shape NxN's CubeGroup.twist sees. Use it directly.
    this.activeTween = tweener.tween(0, 1, frames, (v) => {
      for (let i = 0; i < anims.length; i++) {
        const a = anims[i];
        deltaCur.setFromAxisAngle(a.axis, a.angle * v);
        a.pivot.quaternion.multiplyQuaternions(deltaCur, a.startQuat);
        a.pivot.position.copy(a.startPos).applyQuaternion(deltaCur);
      }
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

