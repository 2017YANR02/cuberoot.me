import './_raf_stub';
import { afterAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import GhostCube from '@cuberoot/puzzle-render-core/engine/ghost/GhostCube';
import { GHOST_ALIGN, ghostDragMove, ghostSelection, parseGhostMoves, type GhostLayer } from '@cuberoot/puzzle-render-core/engine/ghost/ghostState';
import { ghostPickHit, ghostResolveLive, ghostResolveMove } from '@/app/[lang]/sim/engine/ghost/ghostDrag';
import { CornerTurnGesture, type CornerGestureCtx } from '@/app/[lang]/sim/engine/cornerTurnGesture';
import { worldToScreenPx } from '@/app/[lang]/sim/engine/cuberDrag';

const cube = new GhostCube(), scene = new THREE.Scene();
scene.add(cube);
afterAll(() => cube.dispose());
const width = 600, height = 600;
// Independent notation axes; clockwise is a negative angle around the named axis.
const axes: Record<GhostLayer, [number, number, number]> = {
  U: [0, 1, 0], D: [0, -1, 0], R: [1, 0, 0], L: [-1, 0, 0], F: [0, 0, 1], B: [0, 0, -1],
  M: [-1, 0, 0], E: [0, -1, 0], S: [0, 0, 1],
};
interface Drag { camera: THREE.Camera; x: number; y: number; dx: number; dy: number; piece: number }

function visibleDrags(families: GhostLayer[]): Map<GhostLayer, Drag> {
  const found = new Map<GhostLayer, Drag>();
  for (const position of [[400, 300, 500], [-400, 300, -500], [400, -300, -500]]) {
    const camera = new THREE.PerspectiveCamera(40, 1, 1, 3000);
    camera.position.fromArray(position); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    scene.updateMatrixWorld(true);
    for (const [piece, { pivot, cell }] of cube.pieces.entries()) for (const facet of cell.facets) {
      const point = facet.raw.reduce((p, [u, v]) => p.addScaledVector(facet.u, u).addScaledVector(facet.v, v), new THREE.Vector3())
        .divideScalar(facet.raw.length).add(facet.origin).applyMatrix4(pivot.matrixWorld);
      const { x, y } = worldToScreenPx(point, camera, width, height);
      if (x <= 0 || x >= width || y <= 0 || y >= height) continue;
      const hit = ghostPickHit(cube, scene, camera, x, y, width, height);
      if (!hit || hit.point.distanceTo(point) > 2) continue; // Occluded facet, not the piece being grabbed.
      const local = cube.worldToLocal(hit.point.clone());
      for (const family of families) {
        if (found.has(family) || !ghostSelection(cube.pose, { family, degrees: 90 })?.includes(piece)) continue;
        const rotated = local.clone().applyAxisAngle(new THREE.Vector3(...axes[family]), -0.00001);
        const end = worldToScreenPx(cube.localToWorld(rotated), camera, width, height);
        const length = Math.hypot(end.x - x, end.y - y);
        if (length < 1e-6) continue;
        const dx = (end.x - x) / length * 60, dy = (end.y - y) / length * 60;
        const move = ghostResolveMove(cube, hit, scene, camera, dx, dy, width, height);
        if (move?.family === family && move.degrees > 0) found.set(family, { camera, x, y, dx, dy, piece });
      }
    }
  }
  expect([...found.keys()].sort()).toEqual([...families].sort());
  return found;
}

describe('Ghost outer and middle layer drags', () => {
  it.each([GHOST_ALIGN, `${GHOST_ALIGN} R U F2 M E S'`, `${GHOST_ALIGN} x y z2`])(
    'picks all nine live layers and both directions after %s', setup => {
      cube.twister.setup(setup);
      scene.rotation.set(0.2, -0.4, 0.1);
      const drags = visibleDrags(Object.keys(axes) as GhostLayer[]);
      for (const [family, { camera, x, y, dx, dy, piece }] of drags) {
        const hit = ghostPickHit(cube, scene, camera, x, y, width, height)!;
        for (const sign of [1, -1]) {
          const plan = ghostResolveLive(cube, hit, scene, camera, sign * dx, sign * dy, width, height)!;
          expect(plan.move).toEqual({ family, degrees: sign * 90 });
          expect(ghostSelection(cube.pose, plan.move)).toContain(piece);
          expect(plan.tangentX * sign * dx + plan.tangentY * sign * dy).toBeGreaterThan(59.9);
        }
      }
    },
  );

  it('keeps solved cap detents, allows E, and blocks misaligned M/S cuts', () => {
    cube.twister.setup(''); scene.rotation.set(0, 0, 0);
    const drags = visibleDrags(['U', 'D', 'E']);
    for (const [family, degrees] of [['U', 29], ['D', 35], ['E', 90]] as const) {
      const { camera, x, y, dx, dy } = drags.get(family)!;
      const hit = ghostPickHit(cube, scene, camera, x, y, width, height)!;
      expect(ghostResolveMove(cube, hit, scene, camera, dx, dy, width, height)).toEqual({ family, degrees });
    }
    for (const setup of ['', 'U29°', 'U28° D35°']) {
      cube.twister.setup(setup);
      for (const family of ['M', 'S'] as const) for (const clockwise of [true, false]) {
        expect(ghostDragMove(cube.pose, family, clockwise)).toBeNull();
      }
    }
    expect(ghostPickHit(cube, scene, drags.get('U')!.camera, 0, 0, 0, height)).toBeNull();
  });

  it.each(['mouse', 'touch'])('records slice gestures and restores frozen slices with %s input', pointerType => {
    cube.twister.setup(GHOST_ALIGN); scene.rotation.set(0, 0, 0);
    const drags = visibleDrags(['M', 'E', 'S']);
    for (const [family, drag] of drags) for (const sign of [1, -1]) {
      cube.twister.setup(GHOST_ALIGN);
      const before = cube.pose.map(q => q.clone()), emitted: string[] = [];
      let restore: (() => void) | undefined, holdPartialTurn = true;
      const ctx = {
        world: { cube, scene, camera: drag.camera, width, height, dirty: false },
        dom: { getBoundingClientRect: () => ({ left: 0, top: 0 }), setPointerCapture() {}, releasePointerCapture() {} },
        settings: () => ({ holdPartialTurn, dragEmpty: 'rotate' }), pinching: () => false,
        emitMove: (token: string) => emitted.push(token), orbit: () => { throw new Error('A grabbed slice must not orbit'); },
        clearPartialFreeze: () => { restore?.(); restore = undefined; }, setPartialSnapBack: (fn: () => void) => { restore = fn; },
      } as unknown as CornerGestureCtx;
      const gesture = new CornerTurnGesture({
        match: (c): c is GhostCube => c === cube, pickHit: ghostPickHit, resolveLive: ghostResolveLive, resolveMove: ghostResolveMove,
        beginMove: (c, m) => c.beginMove(m), moveToString: m => `${m.family}${m.degrees < 0 ? "'" : ''}`, fullPx: 150, threshold: 6,
      }, ctx);
      const pointer = (amount: number) => ({ clientX: drag.x + sign * drag.dx * amount, clientY: drag.y + sign * drag.dy * amount, pointerId: 1, pointerType }) as PointerEvent;
      const swipe = () => { gesture.begin(pointer(0)); gesture.onMove(pointer(1)); gesture.onUp(pointer(1)); };
      swipe();
      expect(emitted).toEqual([]);
      expect(cube.pose.some((q, i) => q.angleTo(before[i]) > 0.1)).toBe(true);
      holdPartialTurn = false;
      swipe(); // The previous frozen slice must be restored before raycast/selection.
      cube.twister.finish();
      const token = `${family}${sign < 0 ? "'" : ''}`;
      expect(emitted).toEqual([token]);
      expect(cube.history.moves).toEqual([token]);
      const selected = new Set(ghostSelection(before, parseGhostMoves(token)[0])!);
      cube.pose.forEach((q, i) => expect(q.angleTo(before[i])).toBeCloseTo(selected.has(i) ? Math.PI / 2 : 0, 6));
      cube.twister.undo(); cube.twister.finish();
      cube.pose.forEach((q, i) => expect(q.angleTo(before[i])).toBeLessThan(1e-6));
    }
  });
});
