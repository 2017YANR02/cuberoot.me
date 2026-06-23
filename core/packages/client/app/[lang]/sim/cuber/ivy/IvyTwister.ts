/**
 * IvyTwister — animation orchestrator for IvyCube (mirrors Sq1Twister).
 * Uses the global tweener so DirectorPanel offline recording works. One tween
 * per move; each frame rotates the affected pivots about the corner axis.
 */
import * as THREE from 'three';
import tweener, { type Tween } from '../tweener';
import CubeGroup from '../group';
import type IvyCube from './IvyCube';
import type { IvyAnim, IvyMove } from './IvyCube';

const AXIS_LETTER = 'RLDB';
const TOKEN_RE = /^([RLDB])('?)$/i;

/** Parse an Ivy scramble (R L D B with ') into moves, in the /sim's STANDARD
 *  notation: a bare letter = ONE 120° twist (times 1), a primed letter = its
 *  inverse (times 2 = the base turn twice). This is the natural cube convention,
 *  so a dragged single twist records + replays as "R" (not "R'"). NOTE: this is
 *  intentionally the OPPOSITE of lib/ivy-solver's cstimer notation (bare = the base
 *  turn applied twice), which /scramble must keep for cstimer scramble
 *  compatibility — the /sim is a self-contained world (its own random scramble +
 *  drags, no solveIvy), so it uses the intuitive convention. Keep in sync with
 *  IvyCube.pickMove's naming. Strict (throws on a bad token); the live /sim boxes
 *  gate on `classifyIvyTokens` first so a stray token never reaches here. */
export function parseIvyMoves(scramble: string): IvyMove[] {
  const out: IvyMove[] = [];
  for (const tok of scramble.trim().split(/\s+/)) {
    if (!tok) continue;
    const m = TOKEN_RE.exec(tok);
    if (!m) throw new Error(`bad: ${tok}`);
    const axis = AXIS_LETTER.indexOf(m[1].toUpperCase());
    const primed = !!m[2];
    out.push({ axis, times: primed ? 2 : 1, name: AXIS_LETTER[axis] + (primed ? "'" : '') });
  }
  return out;
}

export default class IvyTwister {
  cube: IvyCube;
  queue: IvyMove[] = [];
  private activeTween: Tween | null = null;
  lastSetupCpuMs = 0;

  constructor(cube: IvyCube) {
    this.cube = cube;
  }

  get length(): number {
    return this.queue.length;
  }

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
    for (const m of parseIvyMoves(scramble)) this.cube.applyMoveInstant(m);
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
    const moves = parseIvyMoves(scramble);
    if (moves.length === 0) return;
    for (const m of moves) this.queue.push(m);
    this._kick();
  }

  twist(move: IvyMove, fast: boolean, force: boolean): boolean {
    if (fast) {
      this.cube.applyMoveInstant(move);
      return true;
    }
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
    this._replay();
  }

  redo(): void {
    const next = this.cube.history.redoStack.pop();
    if (!next) return;
    this.cube.history.moves.push(next);
    this._replay();
  }

  private _replay(): void {
    this.finish();
    // history.moves already holds the intended user list (undo/redo mutated it).
    // Replay init + user moves silently so history isn't re-recorded.
    const replay = (this.cube.history.init + ' ' + this.cube.history.moves.join(' ')).trim();
    this.cube.reset();
    for (const m of parseIvyMoves(replay)) this.cube.applyMoveSilent(m);
    this.cube.dirty = true;
    for (const cb of this.cube.callbacks) cb();
  }

  private _kick(): void {
    if (this.activeTween) return;
    const next = this.queue.shift();
    if (!next) return;
    this._animate(next);
  }

  private _animate(move: IvyMove): void {
    const anims: IvyAnim[] = this.cube.beginMove(move);
    const d = Math.abs(anims[0].angle) / (Math.PI / 2); // 120° ≈ 1.33 of 90°
    const frames = Math.max(2, Math.round(CubeGroup.tweenDuration(d)));
    const deltaCur = new THREE.Quaternion();
    this.activeTween = tweener.tween(0, 1, frames, (v) => {
      for (const a of anims) {
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
