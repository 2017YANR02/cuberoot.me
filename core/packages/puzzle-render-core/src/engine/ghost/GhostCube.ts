import * as THREE from 'three';
import MoveHistory from '../MoveHistory';
import { makeAnim, type PieceAnim } from '../pieceAnim';
import type { TweenCube } from '../TweenTwister';
import { buildGhostPieces, GHOST_DEFAULT_FACE_COLORS, GHOST_FACE_LABELS, type GhostPiece } from './ghostGeometry';
import { GHOST_DISPLAY_QUATERNION } from './ghostModel';
import { GHOST_FACES, applyGhostMove, ghostMoveFrame, ghostMoveToString, ghostSelection, solvedGhostPose, type GhostMove } from './ghostState';
import GhostTwister from './GhostTwister';

export default class GhostCube extends THREE.Group implements TweenCube<GhostMove> {
  readonly puzzleType = 'ghost' as const;
  readonly order = 0;
  readonly history = new MoveHistory();
  readonly pieces: GhostPiece[];
  readonly twister: GhostTwister;
  callbacks: (() => void)[] = [];
  dirty = true;
  constructor() {
    super();
    this.quaternion.copy(GHOST_DISPLAY_QUATERNION);
    this.pieces = buildGhostPieces();
    for (const piece of this.pieces) this.add(piece.pivot);
    this.twister = new GhostTwister(this);
  }
  get pose(): THREE.Quaternion[] { return this.pieces.map(p => p.pivot.quaternion); }
  beginMove(move: GhostMove): PieceAnim[] {
    const selected = ghostSelection(this.pose, move);
    if (!selected) throw new Error(`Ghost layers are not aligned for ${ghostMoveToString(move)}`);
    const axis = ghostMoveFrame(move).axis, angle = -THREE.MathUtils.degToRad(move.degrees);
    const delta = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    return selected.map(i => makeAnim(this.pieces[i].pivot, delta, axis, angle));
  }
  finishMove(anims: PieceAnim[], move: GhostMove): void {
    for (const anim of anims) anim.pivot.quaternion.copy(anim.endQuat).normalize();
    this.history.record(ghostMoveToString(move));
    this.dirty = true;
    for (const cb of this.callbacks) cb();
  }
  applyMoveInstant(move: GhostMove): void { this.finishMove(this.beginMove(move), move); }
  applyMoveSilent(move: GhostMove): void {
    for (const anim of this.beginMove(move)) anim.pivot.quaternion.copy(anim.endQuat).normalize();
    this.dirty = true;
  }
  applyMovesInstant(moves: GhostMove[]): void {
    const pose = solvedGhostPose();
    for (const move of moves) applyGhostMove(pose, move);
    this.twister.finish();
    this.reset();
    for (const move of moves) this.applyMoveInstant(move);
  }
  reset(): void {
    for (const { pivot } of this.pieces) { pivot.quaternion.identity(); pivot.position.set(0, 0, 0); }
    this.dirty = true;
    for (const cb of this.callbacks) cb();
  }
  get complete(): boolean {
    const reference = this.pieces[0].pivot.quaternion;
    return this.pieces.every(p => !p.cell.facets.length || reference.angleTo(p.pivot.quaternion) < 1e-5);
  }
  setCarve(on: boolean): void {
    const selected = on ? GHOST_FACES.map(family => ghostSelection(this.pose, { family, degrees: 90 })).find(Boolean) : null;
    for (let i = 0; i < this.pieces.length; i++) this.pieces[i].pivot.visible = !selected?.includes(i);
    this.dirty = true;
  }
  setFaceColors(colors: typeof GHOST_DEFAULT_FACE_COLORS): void {
    this.traverse(obj => {
      if (!(obj instanceof THREE.Mesh) || obj.userData.simRole !== 'sticker') return;
      // Home shell identity follows the piece through turns; never recolor by live normals.
      const face = GHOST_FACE_LABELS[obj.userData.ghostFace as number];
      const materials = obj.userData.simBaseMat ?? obj.material;
      const cap = (Array.isArray(materials) ? materials[0] : materials) as THREE.MeshPhongMaterial;
      cap.color.set(colors[face]);
    });
    this.dirty = true;
  }
  dispose(): void {
    this.twister.finish();
    const materials = new Set<THREE.Material>();
    this.traverse(obj => {
      if (!(obj instanceof THREE.Mesh)) return;
      obj.geometry.dispose();
      // Body overlays are shared app-lifetime materials; only the original base,
      // per-piece raw cache, stickers and lazily-created hint copies belong to us.
      const owned = obj.userData.simBaseMat ?? obj.material;
      for (const mat of Array.isArray(owned) ? owned : [owned]) materials.add(mat);
      if (obj.userData.simRawMat) materials.add(obj.userData.simRawMat);
    });
    for (const mat of materials) mat.dispose();
    this.callbacks.length = 0;
  }
}
