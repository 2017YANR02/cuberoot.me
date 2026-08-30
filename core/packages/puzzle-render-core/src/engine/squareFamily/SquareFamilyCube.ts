/** In-house 3D engine shared by Square-2 and ordinary Square-4. */
import * as THREE from 'three';
import MoveHistory from '../MoveHistory';
import { makeAnim, type PieceAnim } from '../pieceAnim';
import tweener, { type Tween } from '../tweener';
import type { TweenCube } from '../TweenTwister';
import {
  buildUniformSquareMiddle,
  buildUniformSquarePiece,
  type UniformMiddleBuild,
} from './squareFamilyGeometry';
import {
  SQUARE_FAMILY_SPECS,
  applySquareFamilyMove,
  isFiniteSquareMove,
  solvedSquareFamily,
  squareFamilyComplete,
  squareFamilyMoveToString,
  type SquareFamilyKind,
  type SquareFamilyMove,
  type SquareFamilySpec,
  type SquareFamilyState,
} from './squareFamilyState';
import SquareFamilyTwister from './SquareFamilyTwister';

export interface SquareFamilyPieceEntry {
  pieceId: number;
  pivot: THREE.Object3D;
  /** Solved local centroid; pivot.matrix maps it into the current cube-local pose. */
  probe: THREE.Vector3;
}

export interface SquareFamilyMiddleEntry extends UniformMiddleBuild {}

export default class SquareFamilyCube extends THREE.Group implements TweenCube<SquareFamilyMove> {
  readonly puzzleType: SquareFamilyKind;
  readonly spec: SquareFamilySpec;
  readonly sliceAxis: THREE.Vector3;
  pieces: SquareFamilyPieceEntry[] = [];
  middle: SquareFamilyMiddleEntry[] = [];
  state: SquareFamilyState;
  callbacks: (() => void)[] = [];
  dirty = true;
  order = 0;
  history = new MoveHistory();
  twister: SquareFamilyTwister;
  private interactionTween: Tween | null = null;

  constructor(kind: SquareFamilyKind) {
    super();
    this.puzzleType = kind;
    this.spec = SQUARE_FAMILY_SPECS[kind];
    this.sliceAxis = new THREE.Vector3(
      Math.cos(this.spec.sliceAxisAngle),
      0,
      Math.sin(this.spec.sliceAxisAngle),
    ).normalize();
    this.state = solvedSquareFamily(this.spec);

    const n = this.spec.slotsPerLayer;
    for (let slot = 0; slot < n; slot++) {
      const built = buildUniformSquarePiece(slot, true, this.spec);
      this.add(built.pivot);
      this.pieces.push({ pieceId: slot, pivot: built.pivot, probe: built.probe });
    }
    for (let slot = 0; slot < n; slot++) {
      const built = buildUniformSquarePiece(slot, false, this.spec);
      this.add(built.pivot);
      this.pieces.push({ pieceId: n + slot, pivot: built.pivot, probe: built.probe });
    }
    this.middle = buildUniformSquareMiddle(this.spec);
    for (const entry of this.middle) this.add(entry.pivot);
    this.twister = new SquareFamilyTwister(this);
  }

  currentProbe(entry: SquareFamilyPieceEntry, target = new THREE.Vector3()): THREE.Vector3 {
    entry.pivot.updateMatrix();
    return target.copy(entry.probe).applyMatrix4(entry.pivot.matrix);
  }

  animateInteraction(frames: number, update: (value: number) => void): void {
    this.finishInteractionTween();
    let tween!: Tween;
    tween = tweener.tween(0, 1, frames, (value) => {
      update(value);
      if (value < 1) return false;
      if (this.interactionTween === tween) this.interactionTween = null;
      return true;
    });
    this.interactionTween = tween;
  }

  finishInteractionTween(): void {
    const tween = this.interactionTween;
    if (!tween) return;
    this.interactionTween = null;
    tweener.finish(tween);
  }

  finishAnimations(): void {
    this.finishInteractionTween();
    this.twister?.finish();
  }

  reset(): void {
    this.finishAnimations();
    for (const piece of this.pieces) piece.pivot.quaternion.identity();
    for (const middle of this.middle) middle.pivot.quaternion.identity();
    this.state = solvedSquareFamily(this.spec);
    this.dirty = true;
  }

  beginMove(move: SquareFamilyMove, sliceDir: 1 | -1 = 1): PieceAnim[] {
    this.finishInteractionTween();
    if (!isFiniteSquareMove(move)) return [];
    const anims: PieceAnim[] = [];
    if (move.kind === 'turn') {
      const axis = new THREE.Vector3(0, 1, 0);
      const topAngle = -move.top * this.spec.unitRadians;
      const botAngle = move.bot * this.spec.unitRadians;
      const topDelta = new THREE.Quaternion().setFromAxisAngle(axis, topAngle);
      const botDelta = new THREE.Quaternion().setFromAxisAngle(axis, botAngle);
      const probe = new THREE.Vector3();
      for (const piece of this.pieces) {
        this.currentProbe(piece, probe);
        if (probe.y > 0 && topAngle !== 0) {
          anims.push(makeAnim(piece.pivot, topDelta, axis, topAngle));
        } else if (probe.y < 0 && botAngle !== 0) {
          anims.push(makeAnim(piece.pivot, botDelta, axis, botAngle));
        }
      }
      return anims;
    }

    const angle = sliceDir * Math.PI;
    const delta = new THREE.Quaternion().setFromAxisAngle(this.sliceAxis, angle);
    const probe = new THREE.Vector3();
    for (const piece of this.pieces) {
      this.currentProbe(piece, probe);
      if (probe.dot(this.sliceAxis) > 0.5) {
        anims.push(makeAnim(piece.pivot, delta, this.sliceAxis, angle));
      }
    }
    for (const middle of this.middle) {
      if (middle.side === 1) anims.push(makeAnim(middle.pivot, delta, this.sliceAxis, angle));
    }
    return anims;
  }

  finishMove(anims: PieceAnim[], move: SquareFamilyMove): void {
    if (!isFiniteSquareMove(move)) return;
    for (const anim of anims) anim.pivot.quaternion.copy(anim.endQuat);
    this.state = applySquareFamilyMove(this.state, move, this.spec);
    this.history.record(squareFamilyMoveToString(move));
    this.dirty = true;
    for (const callback of this.callbacks) callback();
  }

  applyMoveSilent(move: SquareFamilyMove): void {
    if (!isFiniteSquareMove(move)) return;
    const anims = this.beginMove(move);
    for (const anim of anims) anim.pivot.quaternion.copy(anim.endQuat);
    this.state = applySquareFamilyMove(this.state, move, this.spec);
    this.dirty = true;
  }

  applyMoveInstant(move: SquareFamilyMove): void {
    if (!isFiniteSquareMove(move)) return;
    this.finishMove(this.beginMove(move), move);
  }

  applyMovesInstant(moves: readonly SquareFamilyMove[]): void {
    this.reset();
    for (const move of moves) this.applyMoveInstant(move);
  }

  get complete(): boolean {
    return squareFamilyComplete(this.state, this.spec);
  }

  dispose(): void {
    this.finishAnimations();
    this.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry?.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) for (const entry of material) entry.dispose();
      else material?.dispose();
    });
    this.pieces.length = 0;
    this.middle.length = 0;
    this.callbacks.length = 0;
  }
}
