import * as THREE from 'three';
import Cube from '@/components/puzzle-models/nxn/cube';
import Cubelet from '@/components/puzzle-models/nxn/cubelet';
import CubeGroup from '@/components/puzzle-models/nxn/group';
import { TwistAction } from '@/components/puzzle-models/nxn/twister';
import Sq1Cube from '@cuberoot/puzzle-render-core/engine/sq1/Sq1Cube';
import PyraCube from '@cuberoot/puzzle-render-core/engine/pyra/PyraCube';
import MegaminxCube from '@cuberoot/puzzle-render-core/engine/mega/MegaminxCube';
import SkewbCube from '@cuberoot/puzzle-render-core/engine/skewb/SkewbCube';
import { parseSq1Scramble } from '@cuberoot/puzzle-render-core/engine/sq1/sq1State';
import { parsePyraMoves, pyraMoveToString } from '@cuberoot/puzzle-render-core/engine/pyra/pyraState';
import { parseMegaMoves, megaMoveToString } from '@cuberoot/puzzle-render-core/engine/mega/megaState';
import { parseSkewbMoves, skewbMoveToString } from '@cuberoot/puzzle-render-core/engine/skewb/skewbState';
import { pyraPickHit, pyraResolveMove } from '@/components/puzzle-models/gestures/pyraDrag';
import { megaPickHit, megaResolveMove } from '@/components/puzzle-models/gestures/megaDrag';
import { skewbPickHit, skewbResolveMove } from '@/components/puzzle-models/gestures/skewbDrag';
import { scoreCornerTwist } from '@/components/puzzle-models/gestures/cuberDrag';
import type { PuzzleKind } from './space-state';

export type SpacePuzzle = Cube | Sq1Cube | PyraCube | MegaminxCube | SkewbCube;
export const turnBusy = (cube: SpacePuzzle) => cube instanceof Cube ? cube.busy : cube.twister.busy;
export function turnPuzzle(cube: SpacePuzzle, token: string, fast = false): boolean {
  if (turnBusy(cube)) return false;
  if (cube instanceof Cube) return cube.twister.twist(new TwistAction(token), fast, false);
  if (cube instanceof Sq1Cube) { const m = parseSq1Scramble(token)[0]; return !!m && cube.twister.twist(m, fast, false); }
  if (cube instanceof PyraCube) { const m = parsePyraMoves(token)[0]; return !!m && cube.twister.twist(m, fast, false); }
  if (cube instanceof MegaminxCube) { const m = parseMegaMoves(token)[0]; return !!m && cube.twister.twist(m, fast, false); }
  const m = parseSkewbMoves(token)[0]; return !!m && cube.twister.twist(m, fast, false);
}
export function turnButtons(kind: PuzzleKind) {
  return kind === 'sq1' ? ['(1,0)', '(-1,0)', '(0,1)', '(0,-1)', '/'] :
    kind === 'pyram' ? ['U', 'L', 'R', 'B', 'u', 'l', 'r', 'b'] :
      kind === 'skewb' ? ['R', 'U', 'L', 'B', 'F', 'D', 'UL', 'UR'] :
        kind === 'minx' ? ['U', 'R', 'F', 'L', 'BL', 'BR', 'BF', 'D', 'C', 'A', 'I', 'E'] : ['R', 'U', 'F', 'L', 'D', 'B'];
}

// Capture the simulator's pick once; the returned resolver consumes the drag in CSS pixels.
export function pickTurn(cube: SpacePuzzle, scene: THREE.Scene, camera: THREE.Camera, x: number, y: number, w: number, h: number): ((dx: number, dy: number) => string | null) | null {
  if (turnBusy(cube)) return null;
  scene.updateMatrixWorld(true);
  if (cube instanceof PyraCube) {
    const hit = pyraPickHit(cube, scene, camera, x, y, w, h);
    return hit && ((dx, dy) => { const m = pyraResolveMove(cube, hit, scene, camera, dx, dy, w, h); return m && pyraMoveToString(m); });
  }
  if (cube instanceof MegaminxCube) {
    const hit = megaPickHit(cube, scene, camera, x, y, w, h);
    return hit && ((dx, dy) => { const m = megaResolveMove(cube, hit, scene, camera, dx, dy, w, h); return m && megaMoveToString(m); });
  }
  if (cube instanceof SkewbCube) {
    const hit = skewbPickHit(cube, scene, camera, x, y, w, h);
    return hit && ((dx, dy) => { const m = skewbResolveMove(cube, hit, scene, camera, dx, dy, w, h); return m && skewbMoveToString(m); });
  }
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(x / w * 2 - 1, 1 - y / h * 2), camera);
  const hit = ray.intersectObject(cube, true).find(v => v.object.visible && (v.object as THREE.Mesh).material && !(Array.isArray((v.object as THREE.Mesh).material) ? (v.object as THREE.Mesh).material as THREE.Material[] : [(v.object as THREE.Mesh).material as THREE.Material]).every(m => !m.visible));
  if (!hit) return null;
  const local = cube.worldToLocal(hit.point.clone());
  const origin = cube.localToWorld(new THREE.Vector3());
  if (cube instanceof Sq1Cube) {
    let slab = false;
    for (let obj: THREE.Object3D | null = hit.object; obj && obj !== cube; obj = obj.parent) if (cube.middle.some(m => m.pivot === obj)) slab = true;
    return (dx, dy) => {
      if (slab || Math.abs(dy) > Math.abs(dx) * 1.6) return '/';
      const score = scoreCornerTwist([0], () => new THREE.Vector3(0, 1, 0).transformDirection(cube.matrixWorld), hit.point, origin, dx, dy, camera, w, h);
      return score ? local.y >= 0 ? '(' + -score.dir + ',0)' : '(0,' + -score.dir + ')' : null;
    };
  }
  // NxN uses the same wide-layer rule as the simulator, including inner slices on 4×4/5×5.
  const faceAxis = [Math.abs(local.x), Math.abs(local.y), Math.abs(local.z)].indexOf(Math.max(Math.abs(local.x), Math.abs(local.y), Math.abs(local.z)));
  return (dx, dy) => {
    const score = scoreCornerTwist([0, 1, 2].filter(a => a !== faceAxis), a => new THREE.Vector3().setComponent(a, -1).transformDirection(cube.matrixWorld), hit.point, origin, dx, dy, camera, w, h, 0.25);
    if (!score) return null;
    const layer = Math.max(0, Math.min(cube.order - 1, Math.floor(local.getComponent(score.corner) / Cubelet.SIZE + cube.order / 2)));
    const sign = CubeGroup.wideFromClick('xyz'[score.corner], layer, cube.order).sign;
    return new TwistAction(sign, score.dir < 0).value;
  };
}
