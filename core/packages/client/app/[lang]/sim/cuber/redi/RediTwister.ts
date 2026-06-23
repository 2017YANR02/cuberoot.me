/**
 * RediTwister — animation orchestrator for RediCube.
 *
 * Same shape as DinoTwister / Sq1Twister: uses the global tweener so the Director
 * panel's offline stepping records redi too; one tween per move, frames synced with
 * the speed slider via CubeGroup.frames. Each frame rotates the moving pivots (3
 * edges + the corner) by q(axis, angle·v) · startQuat. Setup/push parse with the
 * redi parser.
 */
import * as THREE from 'three';
import tweener, { type Tween } from '../tweener';
import CubeGroup from '../group';
import type RediCube from './RediCube';
import type { PieceAnim } from './RediCube';
import { parseRediMoves, applyRediMove, type RediMove } from './rediState';

export default class RediTwister {
  cube: RediCube;
  queue: RediMove[] = [];
  private activeTween: Tween | null = null;
  lastSetupCpuMs = 0;

  constructor(cube: RediCube) { this.cube = cube; }

  get length(): number { return this.queue.length; }

  finish(): void {
    const pending = this.queue.splice(0);
    if (this.activeTween) {
      tweener.finish(this.activeTween);
      this.activeTween = null;
    }
    for (const m of pending) this.cube.applyMoveInstant(m);
  }

  setup(scramble: string): void {
    const t0 = performance.now();
    this.finish();
    this.cube.reset();
    const moves = parseRediMoves(scramble);
    for (const m of moves) this.cube.applyMoveInstant(m);
    this.cube.history.clear();
    this.cube.history.init = scramble;
    this.cube.dirty = true;
    this.lastSetupCpuMs = performance.now() - t0;
    for (const cb of this.cube.callbacks) cb();
  }

  setupAsync(scramble: string): Promise<void> {
    this.setup(scramble);
    return Promise.resolve();
  }

  push(scramble: string): void {
    const moves = parseRediMoves(scramble);
    if (moves.length === 0) return;
    for (const m of moves) this.queue.push(m);
    this._kick();
  }

  /**
   * Apply or animate one move.
   *  - fast=true  : instant snap
   *  - force=true : flush an active tween first, then animate
   *  - default    : if a tween is active, drop the move (return false)
   */
  twist(move: RediMove, fast: boolean, force: boolean): boolean {
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
    const replay = (this.cube.history.init + ' ' + this.cube.history.moves.join(' ')).trim();
    this._silentApply(parseRediMoves(replay));
  }

  redo(): void {
    const next = this.cube.history.redoStack.pop();
    if (!next) return;
    this.cube.history.moves.push(next);
    const replay = (this.cube.history.init + ' ' + this.cube.history.moves.join(' ')).trim();
    this._silentApply(parseRediMoves(replay));
  }

  private _silentApply(moves: RediMove[]): void {
    this.finish();
    this.cube.reset();
    for (const m of moves) {
      const anims = this.cube.beginMove(m);
      for (const a of anims) a.pivot.quaternion.copy(a.endQuat);
      this.cube.state = applyRediMove(this.cube.state, m);
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

  private _animate(move: RediMove): void {
    const anims: PieceAnim[] = this.cube.beginMove(move);
    // 120° ≈ 1.33 × a 90° turn → use 4/3 in CubeGroup.tweenDuration's 90°-unit scale.
    const frames = Math.max(2, Math.round(CubeGroup.tweenDuration(4 / 3)));
    const deltaCur = new THREE.Quaternion();
    this.activeTween = tweener.tween(0, 1, frames, (v) => {
      for (let i = 0; i < anims.length; i++) {
        const a = anims[i];
        deltaCur.setFromAxisAngle(a.axis, a.angle * v);
        a.pivot.quaternion.multiplyQuaternions(deltaCur, a.startQuat);
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
