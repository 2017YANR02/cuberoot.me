import * as THREE from 'three';
import {
  applyMagicMove, initialMagicState, magicLayerOffsets, magicMoveToString,
  magicPoses, magicRoutePosition, magicStateFromMoves, magicStepCount, parseMagicMoves,
  type MagicMove, type MagicPose, type MagicPuzzle, type MagicState,
} from '@cuberoot/puzzle-solvers/magic';
import { magicArtwork, MAGIC_TILE_COLOR, type MagicInk } from '../../magic-artwork.js';
import MoveHistory from '../MoveHistory.js';
import TweenTwister from '../TweenTwister.js';
import tweener from '../tweener.js';
import { timing } from '../tweenTiming.js';
import type { PieceAnim } from '../pieceAnim.js';
import { SIZE } from '../define.js';

export const MAGIC_HALF_THICKNESS = 0.012;
export const MAGIC_TILE_SIZE = SIZE * 1.25;

/** Ideal rigid panels plus continuous, render-only spacing for stacked layers.
 * The mechanical route is zero-thickness; this does not solve nylon tension or
 * contact forces. Subtracting the assembly centroid is a whole-object regrip.
 */
export function magicRenderPoses(puzzle: MagicPuzzle, position: number): MagicPose[] {
  const poses = magicPoses(puzzle, position);
  const offsets = magicLayerOffsets(puzzle, position);
  const centre = [0, 0, 0];
  for (const pose of poses) for (let k = 0; k < 3; k++) centre[k] += pose.position[k] / poses.length;
  return poses.map((pose, i) => ({
    ...pose,
    position: [0, 1, 2].map(k => pose.position[k] - centre[k] + pose.normal[k] * MAGIC_HALF_THICKNESS * offsets[i]) as [number, number, number],
  }));
}

function inkGeometry(ink: MagicInk, back: boolean, layer: number): THREE.BufferGeometry {
  const vertices: number[] = [];
  const z = (MAGIC_HALF_THICKNESS + 0.0003 + layer * 0.00004) * (back ? -1 : 1);
  for (const poly of ink.polygons) {
    const area = poly.reduce((sum, p, i) => {
      const q = poly[(i + 1) % poly.length];
      return sum + p[0] * q[1] - q[0] * p[1];
    }, 0);
    const reverse = back ? area > 0 : area < 0;
    for (let i = 1; i < poly.length - 1; i++) {
      for (const j of reverse ? [0, i + 1, i] : [0, i, i + 1]) vertices.push(poly[j][0], poly[j][1], z);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Eight/twelve real two-sided tiles driven along a verified folding route. */
export default class MagicCube extends THREE.Group {
  readonly order = 0;
  readonly puzzleType: MagicPuzzle;
  dirty = true;
  callbacks: (() => void)[] = [];
  history = new MoveHistory();
  twister: MagicTwister;
  state: MagicState = initialMagicState();
  readonly tiles: THREE.Group[] = [];
  private displayPosition = 0;

  constructor(puzzle: MagicPuzzle) {
    super();
    this.puzzleType = puzzle;
    this.scale.setScalar(MAGIC_TILE_SIZE);
    const artwork = magicArtwork(puzzle);
    for (let id = 0; id < artwork.length; id++) {
      const tile = new THREE.Group();
      tile.userData.magicTile = id;
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.982, 0.982, MAGIC_HALF_THICKNESS * 2),
        new THREE.MeshPhongMaterial({ color: MAGIC_TILE_COLOR, shininess: 90 }),
      );
      body.userData.simRole = 'body';
      body.userData.magicTile = id;
      tile.add(body);
      for (const side of ['front', 'back'] as const) artwork[id][side].forEach((ink, layer) => {
        const mesh = new THREE.Mesh(inkGeometry(ink, side === 'back', layer), new THREE.MeshBasicMaterial({ color: ink.color }));
        // The SVG painter merges near-coplanar surfaces. Preserve printed
        // overpasses and highlights within that band at every camera distance.
        mesh.renderOrder = layer + 1;
        mesh.userData.magicTile = id;
        // These are printed ink fragments; generic sticker inset/raw-body
        // replacement would erase the rings, so capabilities disable those.
        mesh.userData.simRole = 'artwork';
        tile.add(mesh);
      });
      this.tiles.push(tile);
      this.add(tile);
    }
    this.twister = new MagicTwister(this);
    this.renderPosition(0);
  }

  get complete(): boolean { return this.state.step === magicStepCount(this.puzzleType); }
  get positionOnRoute(): number { return this.displayPosition; }
  canFold(dir: 1 | -1): boolean {
    return dir === 1 ? this.state.step < magicStepCount(this.puzzleType) : this.state.step > 0;
  }

  renderPosition(position: number): void {
    this.displayPosition = position;
    const poses = magicRenderPoses(this.puzzleType, position);
    const basis = new THREE.Matrix4();
    poses.forEach((pose, index) => {
      const tile = this.tiles[index];
      tile.position.fromArray(pose.position);
      basis.makeBasis(new THREE.Vector3(...pose.right), new THREE.Vector3(...pose.up), new THREE.Vector3(...pose.normal));
      tile.quaternion.setFromRotationMatrix(basis);
    });
    this.dirty = true;
  }

  setState(state: MagicState): void {
    this.state = { ...state };
    this.renderPosition(magicRoutePosition(this.puzzleType, state));
    this.fire();
  }

  // TweenCube compatibility: a fold has coupled hinges and translations, so
  // MagicTwister evaluates the route instead of a single quaternion per tile.
  beginMove(_move: MagicMove): PieceAnim[] { return []; }
  finishMove(_anims: PieceAnim[], move: MagicMove): void { this.applyMoveInstant(move); }
  onAnimationStart(): void { this.fire(); }

  applyMoveInstant(move: MagicMove): void {
    const next = applyMagicMove(this.state, move, this.puzzleType);
    this.history.record(magicMoveToString(move));
    this.setState(next);
  }

  applyMoveSilent(move: MagicMove): void {
    this.setState(applyMagicMove(this.state, move, this.puzzleType));
  }

  reset(): void {
    this.twister?.finish();
    this.setState(initialMagicState());
  }

  dispose(): void {
    this.twister.finish();
    this.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
      }
    });
    this.tiles.length = 0;
    this.callbacks.length = 0;
    this.clear();
  }

  private fire(): void { for (const callback of this.callbacks) callback(); }
}

export class MagicTwister extends TweenTwister<MagicMove> {
  declare cube: MagicCube;
  private activeMove: MagicMove | null = null;
  constructor(cube: MagicCube) { super(cube); }
  protected parse(text: string): MagicMove[] { return parseMagicMoves(text, this.cube.puzzleType); }

  override setup(text: string): void {
    const next = magicStateFromMoves(this.cube.puzzleType, text);
    // Validate the entire route before settling any current tween or clearing
    // history. Invalid pastes leave the last legal state completely untouched.
    this.finish();
    this.cube.history.clear();
    this.cube.history.init = text;
    this.cube.setState(next);
  }

  override push(text: string): void {
    const moves = this.parse(text);
    let future = this.cube.state;
    for (const move of [...(this.activeMove ? [this.activeMove] : []), ...this.queue, ...moves]) {
      future = applyMagicMove(future, move, this.cube.puzzleType);
    }
    super.push(text);
  }

  override twist(move: MagicMove, fast: boolean, force: boolean): boolean {
    if (this.busy && !force) return false;
    if (force) this.finish();
    try { applyMagicMove(this.cube.state, move, this.cube.puzzleType); } catch { return false; }
    return super.twist(move, fast, false);
  }

  protected override _animate(move: MagicMove): void {
    const next = applyMagicMove(this.cube.state, move, this.cube.puzzleType);
    if (move.kind === 'setup') {
      this.cube.applyMoveInstant(move);
      this._kick();
      return;
    }
    const from = magicRoutePosition(this.cube.puzzleType, this.cube.state);
    const to = magicRoutePosition(this.cube.puzzleType, next);
    this.activeMove = move;
    this.activeTween = tweener.tween(0, 1, Math.max(2, timing.frames), fraction => {
      this.cube.renderPosition(from + (to - from) * fraction);
      if (fraction >= 1) {
        this.activeMove = null;
        this.activeTween = null;
        this.cube.applyMoveInstant(move);
        this._kick();
        return true;
      }
      return false;
    });
    this.cube.onAnimationStart();
  }

  override undo(): void { this.finish(); super.undo(); }
  override redo(): void { this.finish(); super.redo(); }
}
