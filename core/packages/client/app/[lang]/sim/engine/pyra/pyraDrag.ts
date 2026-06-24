/**
 * Pyraminx drag-to-turn.
 *
 * Pointerdown raycasts the whole puzzle. Hitting any piece (or the core) starts a
 * pending drag; missing falls back to view rotation (SimPage / the shared gesture
 * controller). On the first move past a threshold we resolve which vertex to twist
 * and the direction from the drag vector, then fire the whole 120° corner (big) turn
 * — drag only does the corner layer; tips are turned via the alg box / keyboard.
 *
 * Candidate vertices: a tip/corner piece → its own vertex; an edge → the 2 vertices
 * its layer currently spans (read live); the core → all 4. The tangential-projection
 * scoring lives in the shared cuberDrag, same as Dino — vertex axes are in cube-local
 * space, so they're transformed by the cube's matrixWorld (the puzzle group carries an
 * apex-up rotation, unlike the cube-frame engines).
 */
import * as THREE from 'three';
import type PyraCube from './PyraCube';
import { vertexAxis } from './pyraGeometry';
import { type PyraMove } from './pyraState';
import { scoreCornerTwist } from '../cuberDrag';

export { applyPartial as pyraApplyPartial, snapBack as pyraSnapBack } from '../cuberDrag';

const _ndc = new THREE.Vector2();
const _raycaster = new THREE.Raycaster();
const _axis = new THREE.Vector3();

export interface PyraPickHit {
  point: THREE.Vector3;
  /** Vertex indices (0..3) that can move the hit piece. */
  candidates: number[];
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
      if (ud.pyraKind === 'edge') return { point, candidates: cube.edgeVertices(ud.pyraEdge as number) };
      return { point, candidates: [ud.pyraVertex as number] };
    }
    obj = obj.parent;
  }
  // core hit — any vertex is a candidate
  return { point, candidates: [0, 1, 2, 3] };
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
  const score = scoreCornerTwist(
    hit.candidates,
    (vertex) => _axis.copy(vertexAxis(vertex)).transformDirection(cube.matrixWorld),
    hit.point, originWorld, dxPx, dyPx, camera, width, height, 0.2,
  );
  if (!score) return null;
  return {
    move: { vertex: score.corner, tip: false, dir: score.dir },
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
