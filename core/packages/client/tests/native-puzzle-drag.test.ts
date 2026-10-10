import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Move } from 'cubing/alg';
import { getPuzzleGeometryByDesc } from 'cubing/puzzle-geometry';
import { NATIVE_PUZZLES, nativePuzzleMoves, type NativePuzzleId } from '@cuberoot/puzzle-solvers/native-puzzles';
import { nativePuzzleKPuzzle } from '@cuberoot/puzzle-solvers/native-puzzle-model';
import {
  createNativePuzzleDragGeometry, pickNativePuzzleDrag, type NativePuzzleDragDepth,
} from '@/components/puzzle-models/gestures/pgDrag';

const CASES = [
  { id: 'superz', stickers: 48, moves: 14, outer: 14, inner: 0, wide: 0 },
  { id: 'cube3dino', stickers: 96, moves: 42, outer: 14, inner: 14, wide: 14 },
  { id: 'dogic', stickers: 80, moves: 36, outer: 12, inner: 12, wide: 12 },
  { id: 'octahedron4', stickers: 32, moves: 18, outer: 6, inner: 6, wide: 6 },
  { id: 'dinoskewb', stickers: 72, moves: 24, outer: 8, inner: 8, wide: 8 },
] as const;
const VIEWPORT = { width: 960, height: 720 };

function moveDepth(move: Move): NativePuzzleDragDepth {
  return move.family.endsWith('w') ? 'wide' : move.innerLayer === 2 ? 'inner' : 'outer';
}

/** Expected direction comes from an actual infinitesimal clockwise rotation,
 * independently of the production cross-product screen-tangent scorer. */
function clockwiseDelta(
  point: THREE.Vector3, normal: THREE.Vector3, world: THREE.Matrix4, camera: THREE.Camera,
): { x: number; y: number } | null {
  const a = point.clone().applyMatrix4(world).project(camera);
  const b = point.clone().applyAxisAngle(normal, -1e-5).applyMatrix4(world).project(camera);
  const x = (b.x - a.x) * VIEWPORT.width / 2, y = -(b.y - a.y) * VIEWPORT.height / 2;
  const length = Math.hypot(x, y);
  return length < 1e-6 ? null : { x: 50 * x / length, y: 50 * y / length };
}

function surfaceCamera(point: THREE.Vector3, world: THREE.Matrix4): THREE.PerspectiveCamera {
  const origin = new THREE.Vector3().setFromMatrixPosition(world);
  const direction = point.clone().normalize().transformDirection(world);
  const camera = new THREE.PerspectiveCamera(35, VIEWPORT.width / VIEWPORT.height, 0.01, 100);
  camera.position.copy(origin).addScaledVector(direction, 4).add(new THREE.Vector3(0.217, 0.139, -0.083));
  camera.lookAt(origin);
  camera.updateMatrixWorld(true);
  return camera;
}

function fixture(id: NativePuzzleId) {
  const pg = getPuzzleGeometryByDesc(NATIVE_PUZZLES[id].description, {
    allMoves: true, orientCenters: true, addRotations: true,
  });
  const data = pg.get3d();
  const axes = new Map(data.axis.map((axis) => [
    data.notationMapper.notationToExternal(new Move(axis.quantumMove.toString()))!.family,
    new THREE.Vector3(axis.coordinates[0], axis.coordinates[1], axis.coordinates[2]).normalize(),
  ]));
  const stickers = data.stickers.filter((s) => !s.isDup).map((sticker) => {
    const vertices: THREE.Vector3[] = [];
    for (let i = 0; i < sticker.coords.length; i += 3) {
      vertices.push(new THREE.Vector3(sticker.coords[i], sticker.coords[i + 1], sticker.coords[i + 2]).multiplyScalar(0.5));
    }
    const center = vertices.reduce((sum, p) => sum.add(p), new THREE.Vector3()).divideScalar(vertices.length);
    return { ...sticker, vertices, center };
  });
  return { stickers, axes };
}

describe('Native PG drag selection', () => {
  it.each(CASES)('$id has all real visible regions and all legal layer choices', ({ id, stickers, moves, outer, inner, wide }) => {
    const geometry = createNativePuzzleDragGeometry(id);
    expect(createNativePuzzleDragGeometry(id)).toBe(geometry);
    expect(geometry.stickers.length).toBe(stickers);
    expect(geometry.moves.length).toBe(moves);
    expect(geometry.moves.filter((m) => m.depth === 'outer').length).toBe(outer);
    expect(geometry.moves.filter((m) => m.depth === 'inner').length).toBe(inner);
    expect(geometry.moves.filter((m) => m.depth === 'wide').length).toBe(wide);
    const puzzle = nativePuzzleKPuzzle(id);
    for (const move of geometry.moves) {
      expect(() => puzzle.moveToTransformation(move.move)).not.toThrow();
      expect(move.move.endsWith('v')).toBe(false);
      expect(move.movingStickers.size === 0).toBe(false);
    }
  });

  it.each(CASES)('$id can drag every axis and layer in both directions after changing the view', ({ id, moves }) => {
    const geometry = createNativePuzzleDragGeometry(id);
    const { stickers, axes } = fixture(id);
    const puzzle = nativePuzzleKPuzzle(id);
    const world = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.31, -0.57, 0.23));
    world.setPosition(0.12, -0.08, 0.17);
    const selected = new Set<string>();
    for (const { move } of nativePuzzleMoves(id)) {
      const parsed = new Move(move), depth = moveDepth(parsed);
      const normal = axes.get(parsed.family.replace(/w$/, ''))!;
      const transformation = puzzle.moveToTransformation(parsed).transformationData;
      let witness = false;
      for (const sticker of stickers) {
        const orbit = transformation[sticker.orbit];
        if (orbit.permutation[sticker.ord] === sticker.ord && orbit.orientationDelta[sticker.ord] === 0) continue;
        // Interior points avoid seam ambiguity; multiple points also cover a
        // sticker centered exactly on its own turning axis.
        const points = [sticker.center, ...sticker.vertices.map((v) => sticker.center.clone().lerp(v, 0.23))];
        for (const point of points) {
          const camera = surfaceCamera(point, world);
          const delta = clockwiseDelta(point, normal, world, camera);
          if (!delta) continue;
          const token = pickNativePuzzleDrag(geometry, point, world, camera, delta, VIEWPORT, depth);
          // With three physical layers the middle slice has two equivalent
          // names: 2F = 2B'. Either name records the same directed motion.
          const middleAlias = id === 'cube3dino' && depth === 'inner' && token !== null
            && puzzle.moveToTransformation(token).isIdentical(puzzle.moveToTransformation(parsed));
          if (token !== move && !middleAlias) continue;
          const reversed = pickNativePuzzleDrag(geometry, point, world, camera, { x: -delta.x, y: -delta.y }, VIEWPORT, depth);
          if (middleAlias) {
            expect(reversed).not.toBeNull();
            expect(puzzle.moveToTransformation(reversed!).isIdentical(puzzle.moveToTransformation(parsed.invert()))).toBe(true);
          } else expect(reversed).toBe(`${move}'`);
          expect(puzzle.moveToTransformation(token!).isIdentical(puzzle.moveToTransformation(parsed))).toBe(true);
          selected.add(move);
          witness = true;
          break;
        }
        if (witness) break;
      }
      expect(witness, `No reachable ${id} drag for ${move}`).toBe(true);
    }
    expect(selected.size).toBe(moves);
  });

  it.each(CASES)('$id only chooses a layer containing the currently hit spatial slot', ({ id }) => {
    const geometry = createNativePuzzleDragGeometry(id);
    const { stickers } = fixture(id);
    const puzzle = nativePuzzleKPuzzle(id);
    const world = new THREE.Matrix4();
    let selected = 0;
    for (const sticker of stickers) {
      const point = sticker.center.clone().lerp(sticker.vertices[0], 0.13);
      const camera = surfaceCamera(point, world);
      for (const delta of [{ x: 35, y: 19 }, { x: -17, y: 41 }]) {
        const token = pickNativePuzzleDrag(geometry, point, world, camera, delta, VIEWPORT);
        expect(token, `No auto slice for ${id} ${sticker.orbit}:${sticker.ord}`).not.toBeNull();
        const move = new Move(token!);
        expect(move.family.endsWith('w')).toBe(false);
        const orbit = puzzle.moveToTransformation(move).transformationData[sticker.orbit];
        expect(orbit.permutation[sticker.ord] !== sticker.ord || orbit.orientationDelta[sticker.ord] !== 0).toBe(true);
        selected++;
      }
    }
    expect(selected).toBe(NATIVE_PUZZLES[id].visibleFacelets * 2);
  });

  it('accepts black cut seams without requiring a precisely centered sticker hit', () => {
    const geometry = createNativePuzzleDragGeometry('superz');
    const { stickers } = fixture('superz');
    const point = stickers[0].vertices[0].clone().lerp(stickers[0].vertices[1], 0.5);
    const world = new THREE.Matrix4();
    const camera = surfaceCamera(point, world);
    const token = pickNativePuzzleDrag(geometry, point, world, camera, { x: 40, y: 25 }, VIEWPORT);
    expect(token).not.toBeNull();
    expect(() => nativePuzzleKPuzzle('superz').moveToTransformation(token!)).not.toThrow();
  });

  it.each(CASES)('$id leaves non-surface points and invalid drags unclaimed', ({ id }) => {
    const geometry = createNativePuzzleDragGeometry(id);
    const world = new THREE.Matrix4();
    const point = fixture(id).stickers[0].center;
    const camera = surfaceCamera(point, world);
    const delta = { x: 35, y: 19 };
    for (const empty of [new THREE.Vector3(), point.clone().multiplyScalar(4), new THREE.Vector3(NaN, 0, 0)]) {
      expect(pickNativePuzzleDrag(geometry, empty, world, camera, delta, VIEWPORT)).toBeNull();
    }
    expect(pickNativePuzzleDrag(geometry, point, world, camera, { x: 0, y: 0 }, VIEWPORT)).toBeNull();
    expect(pickNativePuzzleDrag(geometry, point, world, camera, { x: Infinity, y: 0 }, VIEWPORT)).toBeNull();
    expect(pickNativePuzzleDrag(geometry, point, world, camera, delta, { width: 0, height: 720 })).toBeNull();
    if (id === 'superz') {
      expect(pickNativePuzzleDrag(geometry, point, world, camera, delta, VIEWPORT, 'inner')).toBeNull();
      expect(pickNativePuzzleDrag(geometry, point, world, camera, delta, VIEWPORT, 'wide')).toBeNull();
    }
  });
});
