import * as THREE from 'three';
import type GhostCube from '@cuberoot/puzzle-render-core/engine/ghost/GhostCube';
import { GHOST_FACES, ghostDragMove, ghostMoveFrame, ghostSelection, type GhostMove } from '@cuberoot/puzzle-render-core/engine/ghost/ghostState';
import { scoreCornerTwist } from '../cuberDrag';

// Whole-piece cut membership selects the layer, including the three middle slices.
const DRAG_LAYERS = [...GHOST_FACES, 'M', 'E', 'S'] as const;

export interface GhostPickHit { point: THREE.Vector3; candidates: number[] }
export function ghostPickHit(cube: GhostCube, scene: THREE.Scene, camera: THREE.Camera,
  x: number, y: number, width: number, height: number): GhostPickHit | null {
  if (width <= 0 || height <= 0) return null;
  scene.updateMatrixWorld(true);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(x / width * 2 - 1, 1 - y / height * 2), camera);
  const hit = raycaster.intersectObject(cube, true).find(h => {
    for (let p: THREE.Object3D | null = h.object; p; p = p.parent) if (!p.visible) return false;
    return true;
  });
  if (!hit) return null;
  let obj = hit.object;
  while (obj.parent && obj.parent !== cube) obj = obj.parent;
  const piece = obj.userData.ghostPiece as number | undefined;
  const legal = DRAG_LAYERS.map((family, i) => ({ i, selected: ghostSelection(cube.pose, { family, degrees: 90 }) }))
    .filter(p => p.selected);
  const containing = legal.filter(p => piece !== undefined && p.selected!.includes(piece));
  return { point: hit.point.clone(), candidates: (containing.length ? containing : legal).map(p => p.i) };
}
export function ghostResolveLive(cube: GhostCube, hit: GhostPickHit, scene: THREE.Scene, camera: THREE.Camera,
  dx: number, dy: number, width: number, height: number) {
  scene.updateMatrixWorld(true);
  const score = scoreCornerTwist(hit.candidates, i => ghostMoveFrame({ family: DRAG_LAYERS[i], degrees: 90 }).axis
    .transformDirection(cube.matrixWorld), hit.point, new THREE.Vector3().setFromMatrixPosition(cube.matrixWorld),
  dx, dy, camera, width, height, 0);
  if (!score) return null;
  const move = ghostDragMove(cube.pose, DRAG_LAYERS[score.corner], score.dir < 0);
  return move ? { move, tangentX: score.tangentX, tangentY: score.tangentY } : null;
}
export function ghostResolveMove(...args: Parameters<typeof ghostResolveLive>): GhostMove | null {
  return ghostResolveLive(...args)?.move ?? null;
}
