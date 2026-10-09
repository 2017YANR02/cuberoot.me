import * as THREE from 'three';
import { magicRoutePosition, type MagicMove } from '@cuberoot/puzzle-solvers/magic';
import MagicCube, { magicRenderPoses } from './MagicCube.js';

export interface MagicPickHit { tile: number; local: THREE.Vector3 }

export function magicPickHit(cube: MagicCube, scene: THREE.Scene, camera: THREE.Camera, x: number, y: number, w: number, h: number): MagicPickHit | null {
  if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) return null;
  scene.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(x / w * 2 - 1, 1 - y / h * 2), camera);
  for (const hit of ray.intersectObject(cube, true)) {
    const tile = hit.object.userData.magicTile as number | undefined;
    if (tile === undefined) continue;
    return { tile, local: cube.tiles[tile].worldToLocal(hit.point.clone()) };
  }
  return null;
}

/** Resolve an actual tile grab against the next/previous route's projected
 * displacement. Non-moving tiles and perpendicular drags stay view gestures.
 */
export function magicResolveMove(cube: MagicCube, hit: MagicPickHit, scene: THREE.Scene, camera: THREE.Camera, dx: number, dy: number, w: number, h: number): MagicMove | null {
  if (![dx, dy, w, h].every(Number.isFinite) || Math.hypot(dx, dy) < 1e-6 || w <= 0 || h <= 0) return null;
  scene.updateMatrixWorld(true);
  const position = magicRoutePosition(cube.puzzleType, cube.state);
  const project = (p: number) => {
    const pose = magicRenderPoses(cube.puzzleType, p)[hit.tile];
    if (!pose) return null;
    const point = new THREE.Vector3(...pose.position)
      .addScaledVector(new THREE.Vector3(...pose.right), hit.local.x)
      .addScaledVector(new THREE.Vector3(...pose.up), hit.local.y);
    point.applyMatrix4(cube.matrixWorld).project(camera);
    return new THREE.Vector2(point.x * w / 2, -point.y * h / 2);
  };
  const start = project(position);
  if (!start) return null;
  let best = 0.25, chosen: MagicMove | null = null;
  for (const dir of [1, -1] as const) {
    if (!cube.canFold(dir)) continue;
    const increment = dir * (cube.state.direction === 'Forward' ? 1 : -1);
    // A half-turn initially travels mostly into depth. A quarter of the
    // step provides a stable tangent even from a straight-on board view.
    const end = project(position + increment * 0.3);
    if (!end) continue;
    const tangent = end.sub(start);
    if (tangent.length() < 1) continue;
    const score = tangent.dot(new THREE.Vector2(dx, dy)) / (tangent.length() * Math.hypot(dx, dy));
    if (score > best) { best = score; chosen = { kind: 'fold', dir }; }
  }
  return chosen;
}
