import * as THREE from 'three';
import type DuoCube from '@cuberoot/puzzle-render-core/engine/duo/DuoCube';
import { DUO_VERTEX_AXES, type DuoMove } from '@cuberoot/puzzle-solvers/pyraminx-duo';
import { scoreCornerTwist } from './cuberDrag';

const ALL_AXES = [0, 1, 2, 3];
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const axis = new THREE.Vector3();

export interface DuoPickHit {
  point: THREE.Vector3;
  candidates: number[];
}

/** The picked centre's live face determines its three available axes. Corners
 * stay at their home vertex; dark body/core hits are equally draggable. */
export function duoPickHit(
  cube: DuoCube, scene: THREE.Scene, camera: THREE.Camera,
  x: number, y: number, width: number, height: number,
): DuoPickHit | null {
  ndc.set(x / width * 2 - 1, 1 - y / height * 2);
  scene.updateMatrixWorld();
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObject(cube, true).find(item => {
    for (let object: THREE.Object3D | null = item.object; object; object = object.parent) if (!object.visible) return false;
    return true;
  });
  if (!hit) return null;
  const point = hit.point.clone();
  for (let object: THREE.Object3D | null = hit.object; object && object !== cube; object = object.parent) {
    if (typeof object.userData.duoCorner === 'number') return { point, candidates: [object.userData.duoCorner] };
    if (typeof object.userData.duoCentre === 'number') {
      const face = cube.state.centers.indexOf(object.userData.duoCentre);
      return { point, candidates: ALL_AXES.filter(corner => corner !== face) };
    }
  }
  return { point, candidates: ALL_AXES };
}

export function duoResolveLive(
  cube: DuoCube, hit: DuoPickHit, scene: THREE.Scene, camera: THREE.Camera,
  dx: number, dy: number, width: number, height: number,
): { move: DuoMove; tangentX: number; tangentY: number } | null {
  scene.updateMatrixWorld();
  const origin = new THREE.Vector3().setFromMatrixPosition(cube.matrixWorld);
  const score = scoreCornerTwist(hit.candidates, corner => axis.set(...DUO_VERTEX_AXES[corner]).normalize().transformDirection(cube.matrixWorld),
    hit.point, origin, dx, dy, camera, width, height, 0.2);
  if (!score) return null;
  return { move: { corner: score.corner, dir: score.dir }, tangentX: score.tangentX, tangentY: score.tangentY };
}

export function duoResolveMove(
  cube: DuoCube, hit: DuoPickHit, scene: THREE.Scene, camera: THREE.Camera,
  dx: number, dy: number, width: number, height: number,
): DuoMove | null {
  return duoResolveLive(cube, hit, scene, camera, dx, dy, width, height)?.move ?? null;
}
