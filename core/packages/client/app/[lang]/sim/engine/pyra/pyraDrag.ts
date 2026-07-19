/**
 * Pyraminx drag-to-turn.
 *
 * Pointerdown raycasts the whole puzzle. Hitting any piece (or the core) starts a
 * pending drag; missing falls back to view rotation (SimPage / the shared gesture
 * controller). On the first move past a threshold we resolve which axis to twist
 * and the direction from the drag vector, then fire the 120° turn.
 *
 * Which layer turns follows the physical puzzle: grabbing a TIP cap (the small apex
 * piece) does the tip-only turn (lowercase u/l/r/b) at the tip's CURRENT vertex.
 * Grabbing a corner / an edge scores the drag against ALL 4 vertex axes: on the axes
 * whose layer currently holds the piece the turn is the corner layer (uppercase); on
 * the others it's the complementary FACE layer (Dw/Lw/Rw/Fw) — so dragging the bottom
 * ring sideways naturally fires Dw. The core turns corner layers only. All spins share
 * the vertex-axis direction scoring; only the affected pieces differ.
 *
 * Layer membership is read live from PyraCube (face turns permute corners/tips between
 * vertices, so home indices can't be trusted). The tangential-projection scoring lives
 * in the shared cuberDrag, same as Dino — vertex axes are in cube-local space, so
 * they're transformed by the cube's matrixWorld (the puzzle group carries an apex-up
 * rotation, unlike the cube-frame engines).
 */
import * as THREE from 'three';
import type PyraCube from './PyraCube';
import { vertexAxis } from './pyraGeometry';
import { type PyraMove, type PyraPart } from './pyraState';
import { scoreCornerTwist } from '../cuberDrag';

export { applyPartial as pyraApplyPartial, snapBack as pyraSnapBack } from '../cuberDrag';

const _ndc = new THREE.Vector2();
const _raycaster = new THREE.Raycaster();
const _axis = new THREE.Vector3();

const ALL_AXES = [0, 1, 2, 3];

export interface PyraPickHit {
  point: THREE.Vector3;
  /** Candidate axis vertices (0..3) to score the drag against. */
  candidates: number[];
  /** Per-axis: is the grabbed piece currently IN that vertex's corner layer? (in →
   *  corner-layer turn about it, out → face-layer turn). Core hits: all true. */
  inLayer: boolean[];
  /** If the grabbed piece was a tip cap, its CURRENT vertex — a drag on it turns the
   *  tip only. null for corner / edge / core hits. */
  tipVertex: number | null;
}

export function pyraPickHit(
  cube: PyraCube,
  scene: THREE.Scene, camera: THREE.Camera,
  screenX: number, screenY: number, width: number, height: number,
): PyraPickHit | null {
  _ndc.set((screenX / width) * 2 - 1, -(screenY / height) * 2 + 1);
  scene.updateMatrixWorld();
  _raycaster.setFromCamera(_ndc, camera);
  const hits = _raycaster.intersectObject(cube, true);
  if (hits.length === 0) return null;
  const point = hits[0].point.clone();

  let obj: THREE.Object3D | null = hits[0].object;
  while (obj && obj !== cube) {
    const ud = obj.userData;
    if (ud && typeof ud.pyraKind === 'string') {
      if (ud.pyraKind === 'edge') {
        return { point, candidates: ALL_AXES, inLayer: cube.layersOf('edge', ud.pyraEdge as number), tipVertex: null };
      }
      const inLayer = cube.layersOf(ud.pyraKind as 'tip' | 'corner', ud.pyraVertex as number);
      if (ud.pyraKind === 'tip') {
        // The tip's CURRENT vertex (face turns migrate tips between vertices). A frozen
        // hold-partial pose can leave it in no layer → no candidates → orbit fallback.
        const cur = inLayer.indexOf(true);
        return { point, candidates: cur < 0 ? [] : [cur], inLayer, tipVertex: cur < 0 ? null : cur };
      }
      return { point, candidates: ALL_AXES, inLayer, tipVertex: null };
    }
    obj = obj.parent;
  }
  // core hit — any vertex is a candidate (corner-layer turn only)
  return { point, candidates: ALL_AXES, inLayer: [true, true, true, true], tipVertex: null };
}

export interface PyraLivePlan {
  move: PyraMove;
  tangentX: number;
  tangentY: number;
}

export function pyraResolveLive(
  cube: PyraCube,
  hit: PyraPickHit,
  scene: THREE.Scene, camera: THREE.Camera,
  dxPx: number, dyPx: number, width: number, height: number,
): PyraLivePlan | null {
  scene.updateMatrixWorld();
  const originWorld = new THREE.Vector3().setFromMatrixPosition(cube.matrixWorld);
  const tip = hit.tipVertex !== null;
  const score = scoreCornerTwist(
    hit.candidates,
    (vertex) => _axis.copy(vertexAxis(vertex)).transformDirection(cube.matrixWorld),
    hit.point, originWorld, dxPx, dyPx, camera, width, height, 0.2,
  );
  if (!score) return null;
  const part: PyraPart = tip ? 'tip' : hit.inLayer[score.corner] ? 'corner' : 'face';
  return {
    move: { vertex: score.corner, part, dir: score.dir },
    tangentX: score.tangentX, tangentY: score.tangentY,
  };
}

export function pyraResolveMove(
  cube: PyraCube,
  hit: PyraPickHit,
  scene: THREE.Scene, camera: THREE.Camera,
  dxPx: number, dyPx: number, width: number, height: number,
): PyraMove | null {
  return pyraResolveLive(cube, hit, scene, camera, dxPx, dyPx, width, height)?.move ?? null;
}
