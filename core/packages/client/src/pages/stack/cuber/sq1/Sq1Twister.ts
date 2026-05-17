/**
 * Sq1Twister — animation system for SQ1.
 *
 * API mirrors stack/cuber/twister.ts:
 *   - setup(exp)     : reset + apply fast
 *   - push(exp)      : queue moves for animated playback
 *   - twist(move, fast, force) : apply one move (animated or instant)
 *   - finish()       : flush all in-flight tweens
 *   - undo() / redo(): history navigation
 *
 * It DOES NOT use TwistAction / TwistNode from cube twister — SQ1 has a
 * different notation. Callers (PlayerControls) detect puzzle type and route
 * scrambles directly to setup/push via the parser in `./state`.
 */
import * as THREE from 'three';
import tweener from '../tweener';
import type Sq1Cube from './Sq1Cube';
import { Sq1Piece } from './Sq1Cube';
import { parseSq1Scramble, applySq1Move, solvedSq1, type Sq1Move, type Sq1State } from './state';

const DEG = Math.PI / 180;
const FRAMES_PER_30DEG = 6; // ~100ms per 30° at 60fps
const SLASH_FRAMES = 36;

const _AXIS_X = new THREE.Vector3(1, 0, 0);

export default class Sq1Twister {
  cube: Sq1Cube;
  state: Sq1State = solvedSq1();
  /** Pending moves waiting to be animated. */
  queue: Sq1Move[] = [];
  /** True while a tween is mid-animation (locks out concurrent moves). */
  locked = false;

  constructor(cube: Sq1Cube) {
    this.cube = cube;
  }

  get length(): number {
    return this.queue.length;
  }

  finish(): void {
    while (this.queue.length > 0 || this.locked) {
      tweener.finish();
    }
    tweener.finish();
  }

  /** Reset + apply scramble instantly. */
  setup(scramble: string): void {
    this.finish();
    this.cube.reset();
    this.state = solvedSq1();
    const moves = parseSq1Scramble(scramble);
    for (const m of moves) {
      this._applyMoveInstant(m);
    }
    this.cube.history.clear();
    this.cube.history.init = scramble;
    this.cube.dirty = true;
    for (const cb of this.cube.callbacks) cb();
  }

  /** Queue moves for animated playback. */
  push(scramble: string): void {
    const moves = parseSq1Scramble(scramble);
    if (moves.length === 0) return;
    for (const m of moves) this.queue.push(m);
    this._update();
  }

  /** Animate or instantly apply a single move.
   *  - fast=true: skip animation (used by setup loop)
   *  - force=true: if locked, flush in-flight tween and try again */
  twist(move: Sq1Move, fast: boolean, force: boolean): boolean {
    if (fast || force) {
      if (force && this.locked) {
        tweener.finish();
        this.locked = false;
      }
      if (fast) {
        this._applyMoveInstant(move);
      } else {
        return this._animateMove(move);
      }
      return true;
    }
    if (this.locked) return false;
    return this._animateMove(move);
  }

  /** Internal: drain queue with animated moves. */
  private _update = (): void => {
    while (this.queue.length > 0 && !this.locked) {
      const move = this.queue.shift()!;
      const ok = this._animateMove(move);
      if (!ok) {
        this.queue.unshift(move);
        return;
      }
    }
  };

  /** Snap the move into final positions (no tween). */
  private _applyMoveInstant(move: Sq1Move): void {
    if (move.kind === 'slash') {
      this._applySlashInstant();
    } else {
      this._applyTurnInstant(move.top, move.bottom);
    }
    this.state = applySq1Move(this.state, move);
  }

  private _applyTurnInstant(top: number, bottom: number): void {
    const topDelta = top * 30 * DEG;
    const botDelta = bottom * 30 * DEG;
    for (const p of this.cube.pieces) {
      if (p.currentLayer === 'top') {
        p.rotY += topDelta;
      } else {
        p.rotY += botDelta;
      }
      p.applyTransform();
    }
    this.cube.dirty = true;
  }

  private _applySlashInstant(): void {
    for (const p of this.cube.pieces) {
      if (this._pieceInRightHalf(p)) {
        p.slashCount = (p.slashCount + 1) % 2;
        p.currentLayer = p.currentLayer === 'top' ? 'bottom' : 'top';
        p.applyTransform();
      }
    }
    this._rotateEquatorRight(Math.PI);
    this.cube.dirty = true;
  }

  /** Animate a single move using the tweener. Returns false if locked. */
  private _animateMove(move: Sq1Move): boolean {
    if (this.locked) return false;
    this.locked = true;
    if (move.kind === 'slash') {
      this._animateSlash(() => {
        this.state = applySq1Move(this.state, move);
        this.locked = false;
        for (const cb of this.cube.callbacks) cb();
        this._update();
      });
    } else {
      this._animateTurn(move.top, move.bottom, () => {
        this.state = applySq1Move(this.state, move);
        this.locked = false;
        for (const cb of this.cube.callbacks) cb();
        this._update();
      });
    }
    return true;
  }

  private _animateTurn(top: number, bottom: number, done: () => void): void {
    const topDelta = top * 30 * DEG;
    const botDelta = bottom * 30 * DEG;
    const topStart = new Map<Sq1Piece, number>();
    const botStart = new Map<Sq1Piece, number>();
    for (const p of this.cube.pieces) {
      if (p.currentLayer === 'top') topStart.set(p, p.rotY);
      else botStart.set(p, p.rotY);
    }
    const frames = Math.max(FRAMES_PER_30DEG, Math.ceil(Math.max(Math.abs(top), Math.abs(bottom)) * FRAMES_PER_30DEG));
    tweener.tween(0, 1, frames, (t) => {
      for (const [p, start] of topStart) {
        p.rotY = start + topDelta * t;
        p.applyTransform();
      }
      for (const [p, start] of botStart) {
        p.rotY = start + botDelta * t;
        p.applyTransform();
      }
      this.cube.dirty = true;
      if (t >= 1) {
        done();
        return true;
      }
      return false;
    });
  }

  private _animateSlash(done: () => void): void {
    // Take a snapshot of which pieces are in the right half — these will all
    // rotate 180° around X axis during this slash.
    const affected: Sq1Piece[] = [];
    const startSlash: number[] = [];
    const startLayer: ('top' | 'bottom')[] = [];
    for (const p of this.cube.pieces) {
      if (this._pieceInRightHalf(p)) {
        affected.push(p);
        startSlash.push(p.slashCount);
        startLayer.push(p.currentLayer);
      }
    }
    // For the tween, we interpolate the slash angle from 0 to π.
    // At each frame, we set the piece's quaternion = qX(angle) * (start orientation).
    // Capture each affected piece's "pre-slash" quaternion separately.
    const startQuats: THREE.Quaternion[] = affected.map((p) => p.quaternion.clone());
    tweener.tween(0, 1, SLASH_FRAMES, (t) => {
      const ang = Math.PI * t;
      const qDelta = new THREE.Quaternion().setFromAxisAngle(_AXIS_X, ang);
      for (let i = 0; i < affected.length; i++) {
        const q = new THREE.Quaternion().copy(qDelta).multiply(startQuats[i]);
        affected[i].quaternion.copy(q);
        affected[i].updateMatrix();
      }
      // Equator: rotate right half too.
      this._rotateEquatorRightTo(ang);
      this.cube.dirty = true;
      if (t >= 1) {
        // Snap final state.
        for (let i = 0; i < affected.length; i++) {
          affected[i].slashCount = (startSlash[i] + 1) % 2;
          affected[i].currentLayer = startLayer[i] === 'top' ? 'bottom' : 'top';
          affected[i].applyTransform();
        }
        this._rotateEquatorRight(Math.PI); // commit; quaternion state recomputed below
        this._finalizeEquatorRight();
        done();
        return true;
      }
      return false;
    });
  }

  /** True if the piece's wedge body is currently positioned with its outer-radius
   *  centroid on the +X side of the slash plane. */
  private _pieceInRightHalf(piece: Sq1Piece): boolean {
    // Piece's outer-radial direction in world: rotate (1,0,0) by piece's quaternion,
    // then check its X component.
    const dir = new THREE.Vector3(1, 0, 0).applyQuaternion(piece.quaternion);
    return dir.x > 1e-6;
  }

  /** Rotate the equator's right-side slab by `delta` radians around the X axis. */
  private _rotateEquatorRight(delta: number): void {
    for (const slab of this.cube.equator) {
      if ((slab.userData as { side?: string }).side !== 'right') continue;
      // Apply quaternion: rotate slab's position + orientation by delta around X axis.
      const q = new THREE.Quaternion().setFromAxisAngle(_AXIS_X, delta);
      slab.position.applyQuaternion(q);
      slab.quaternion.premultiply(q);
      slab.updateMatrix();
    }
  }

  /** During a tween, set the slab's intermediate angle (re-apply from `initial`). */
  private _rotateEquatorRightTo(absAngle: number): void {
    for (const slab of this.cube.equator) {
      if ((slab.userData as { side?: string }).side !== 'right') continue;
      const init = slab.userData as { initialPos: THREE.Vector3; initialRotY: number };
      const q = new THREE.Quaternion().setFromAxisAngle(_AXIS_X, absAngle);
      slab.position.copy(init.initialPos).applyQuaternion(q);
      slab.quaternion.setFromAxisAngle(_AXIS_X, absAngle);
      slab.updateMatrix();
    }
  }

  /** At end of slash tween, update initial state of the equator-right slab so
   *  that the next slash tweens from this orientation. */
  private _finalizeEquatorRight(): void {
    for (const slab of this.cube.equator) {
      if ((slab.userData as { side?: string }).side !== 'right') continue;
      const ud = slab.userData as { initialPos: THREE.Vector3; initialRotY: number };
      ud.initialPos = slab.position.clone();
    }
  }

  // ─── undo/redo (basic, parser-driven) ───────────────────────────────────
  undo(): void {
    if (this.cube.history.moves.length === 0) return;
    const last = this.cube.history.moves.pop()!;
    this.cube.history.redoStack.push(last);
    // Re-derive cube from history by replaying init + remaining moves (slow but
    // correct). For MVP we just replay.
    const replay = this.cube.history.init + ' ' + this.cube.history.moves.join(' ');
    this.setup(replay);
  }

  redo(): void {
    const next = this.cube.history.redoStack.pop();
    if (!next) return;
    this.cube.history.moves.push(next);
    const replay = this.cube.history.init + ' ' + this.cube.history.moves.join(' ');
    this.setup(replay);
  }
}
