import * as THREE from 'three';
import { Move } from 'cubing/alg';
import { getPuzzleGeometryByDesc } from 'cubing/puzzle-geometry';
import { NATIVE_PUZZLES, nativePuzzleMoves, type NativePuzzleId } from '@cuberoot/puzzle-solvers/native-puzzles';
import { nativePuzzleKPuzzle } from '@cuberoot/puzzle-solvers/native-puzzle-model';
import { scoreCornerTwist } from './cuberDrag';

export type NativePuzzleDragDepth = 'outer' | 'inner' | 'wide';

interface DragSticker {
  readonly vertices: readonly THREE.Vector3[];
  readonly orbit: string;
  readonly slot: number;
}

interface DragMove {
  readonly move: string;
  readonly depth: NativePuzzleDragDepth;
  readonly axis: THREE.Vector3;
  readonly movingStickers: ReadonlySet<number>;
}

export interface NativePuzzleDragGeometry {
  readonly id: NativePuzzleId;
  readonly stickers: readonly DragSticker[];
  readonly moves: readonly DragMove[];
  readonly radius: number;
}

const cache = new Map<NativePuzzleId, NativePuzzleDragGeometry>();
// PG3D scales both its rendered sticker meshes and public control planes by 0.5.
// Keep these polygons in the PG object's local coordinates, not raw PG units.
const PG_RENDER_SCALE = 0.5;

/** Native move support is spatial: PG recolors fixed slots after every completed
 * turn. No solved-piece identity or current color is used to choose a slice. */
export function createNativePuzzleDragGeometry(id: NativePuzzleId): NativePuzzleDragGeometry {
  const cached = cache.get(id);
  if (cached) return cached;
  const pg = getPuzzleGeometryByDesc(NATIVE_PUZZLES[id].description, {
    allMoves: true, orientCenters: true, addRotations: true,
  });
  const data = pg.get3d();
  const puzzle = nativePuzzleKPuzzle(id);
  const axes = new Map<string, THREE.Vector3>();
  for (const axis of data.axis) {
    const external = data.notationMapper.notationToExternal(new Move(axis.quantumMove.toString()));
    if (external) axes.set(external.family, new THREE.Vector3(axis.coordinates[0], axis.coordinates[1], axis.coordinates[2]).normalize());
  }
  let radius = 0;
  const stickers: DragSticker[] = data.stickers.filter((sticker) => !sticker.isDup).map((sticker) => {
    const vertices: THREE.Vector3[] = [];
    for (let i = 0; i < sticker.coords.length; i += 3) {
      const point = new THREE.Vector3(sticker.coords[i], sticker.coords[i + 1], sticker.coords[i + 2]).multiplyScalar(PG_RENDER_SCALE);
      radius = Math.max(radius, point.length());
      vertices.push(point);
    }
    return { vertices, orbit: sticker.orbit, slot: sticker.ord };
  });
  const moves = nativePuzzleMoves(id).map(({ move }): DragMove => {
    const parsed = new Move(move);
    const axis = axes.get(parsed.family.replace(/w$/, ''));
    if (!axis) throw new Error(`Missing native drag axis for ${id}: ${move}`);
    // This also rejects a mistyped registry family or an unsupported slice/wide
    // alias before it can become a dead manual gesture.
    const transformation = puzzle.moveToTransformation(parsed).transformationData;
    const movingStickers = new Set<number>();
    stickers.forEach((sticker, index) => {
      const orbit = transformation[sticker.orbit];
      if (orbit.permutation[sticker.slot] !== sticker.slot || orbit.orientationDelta[sticker.slot] !== 0) movingStickers.add(index);
    });
    return {
      move, axis, movingStickers,
      depth: parsed.family.endsWith('w') ? 'wide' : parsed.innerLayer === 2 ? 'inner' : 'outer',
    };
  });
  const geometry = { id, stickers, moves, radius };
  cache.set(id, geometry);
  return geometry;
}

const triangle = new THREE.Triangle();
const closest = new THREE.Vector3();
const worldPoint = new THREE.Vector3();
const worldOrigin = new THREE.Vector3();
const worldAxis = new THREE.Vector3();

/** Resolve a settled native PG surface hit into one clockwise or anticlockwise
 * move. The caller owns raycasting, the movement threshold, and pointer capture.
 * `localToWorld` is the PG object's world matrix (its 0.5 mesh scale is included
 * in the cached polygons already). Omitted depth picks outer/inner single slices;
 * a modifier or explicit control can request a wide turn instead.
 */
export function pickNativePuzzleDrag(
  geometry: NativePuzzleDragGeometry,
  pointLocal: THREE.Vector3,
  localToWorld: THREE.Matrix4,
  camera: THREE.Camera,
  deltaPx: { x: number; y: number },
  viewport: { width: number; height: number },
  depth?: NativePuzzleDragDepth,
): string | null {
  if (![pointLocal.x, pointLocal.y, pointLocal.z, deltaPx.x, deltaPx.y, viewport.width, viewport.height].every(Number.isFinite)
    || viewport.width <= 0 || viewport.height <= 0 || Math.hypot(deltaPx.x, deltaPx.y) < 1e-6) return null;

  // Untrimmed polygons cover black sticker gaps too. At a seam retain both
  // adjacent slots instead of requiring the user to hit a narrow colored patch.
  let minimum = Infinity;
  const distances = geometry.stickers.map(({ vertices }) => {
    let distance = Infinity;
    for (let i = 1; i < vertices.length - 1; i++) {
      triangle.set(vertices[0], vertices[i], vertices[i + 1]);
      triangle.closestPointToPoint(pointLocal, closest);
      distance = Math.min(distance, closest.distanceToSquared(pointLocal));
    }
    minimum = Math.min(minimum, distance);
    return distance;
  });
  // The foundation is slightly inset from the sticker surface. A small relative
  // tolerance accepts it while rejecting points inside/outside the actual solid.
  if (minimum > (geometry.radius * 0.01) ** 2) return null;
  const slots = distances.flatMap((distance, index) => distance <= minimum + 1e-12 ? [index] : []);
  const candidates = geometry.moves.flatMap((move, index) => (
    (depth ? move.depth === depth : move.depth !== 'wide')
      && slots.some((slot) => move.movingStickers.has(slot)) ? [index] : []
  ));
  if (candidates.length === 0) return null;
  worldPoint.copy(pointLocal).applyMatrix4(localToWorld);
  worldOrigin.setFromMatrixPosition(localToWorld);
  const score = scoreCornerTwist(
    candidates,
    (index) => worldAxis.copy(geometry.moves[index].axis).transformDirection(localToWorld),
    worldPoint, worldOrigin, deltaPx.x, deltaPx.y,
    camera, viewport.width, viewport.height, 0.2,
  );
  if (!score) return null;
  // The shared scorer measures positive right-handed rotation. Native PG bare
  // moves are clockwise from outside, so their amount has the opposite sign.
  return new Move(geometry.moves[score.corner].move).modified({ amount: -score.dir }).toString();
}
