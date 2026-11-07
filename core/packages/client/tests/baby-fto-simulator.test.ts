import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Move } from 'cubing/alg';
import { puzzles } from 'cubing/puzzles';
import {
  isNativePuzzleId, isPgInteractionPuzzleId, nativePuzzleMoves,
} from '@cuberoot/puzzle-solvers/native-puzzles';
import {
  nativePuzzleKPuzzle, parseNativePuzzleAlg, simplifyNativePuzzleAlg,
} from '@cuberoot/puzzle-solvers/native-puzzle-model';
import { PG_IDS } from '@/app/[lang]/sim/pgCatalog';
import { ALL_PUZZLE_TYPE_OPTIONS, groupSimPuzzleOptions } from '@/app/[lang]/sim/puzzleOptions';
import { isTwistyPuzzle } from '@/app/[lang]/sim/twistyPuzzles';
import {
  createNativePuzzleDragGeometry, pickNativePuzzleDrag,
} from '@/components/puzzle-models/gestures/pgDrag';

const FACES = ['U', 'F', 'R', 'L', 'D', 'B', 'BR', 'BL'] as const;
const VIEWPORT = { width: 960, height: 720 };

/** Derive a screen drag from a physical clockwise rotation, independently of
 * the production tangent scorer. */
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

describe('Baby FTO simulator', () => {
  it('preserves the named loader and its distinct menu entry', () => {
    expect(isTwistyPuzzle('baby_fto')).toBe(true);
    expect(isPgInteractionPuzzleId('baby_fto')).toBe(true);
    expect(isNativePuzzleId('baby_fto')).toBe(false);
    expect(PG_IDS.has('baby_fto')).toBe(false);
    expect(ALL_PUZZLE_TYPE_OPTIONS.filter((option) => option.value === 'baby_fto')).toHaveLength(1);
    const family = groupSimPuzzleOptions().find((group) => group.id === 'octahedron');
    expect(family?.options.some((option) => option.value === 'baby_fto')).toBe(true);
    expect(family?.options.some((option) => option.value === 'fto')).toBe(true);
  });

  it('matches the real named model, including unmarked center orientation', async () => {
    const oracle = await puzzles.baby_fto.kpuzzle();
    const model = nativePuzzleKPuzzle('baby_fto');
    expect(model.definition.orbits).toEqual(oracle.definition.orbits);
    expect(model.defaultPattern().patternData).toEqual(oracle.defaultPattern().patternData);
    expect(model.defaultPattern().patternData.CENTERS.orientationMod).toEqual(Array(8).fill(1));
    expect(oracle.definition.orbits).toEqual([
      { orbitName: 'CENTERS', numPieces: 8, numOrientations: 3 },
      { orbitName: 'C4RNER', numPieces: 6, numOrientations: 4 },
    ]);
    for (const move of FACES) {
      for (const token of [move, `${move}'`, `${move}2`]) {
        expect(model.moveToTransformation(token).transformationData)
          .toEqual(oracle.moveToTransformation(token).transformationData);
      }
      expect(model.moveToTransformation(move).repetitionOrder()).toBe(3);
      expect(model.algToTransformation(`${move} ${move}'`).isIdentityTransformation()).toBe(true);
      expect(model.algToTransformation(`${move} ${move} ${move}`).isIdentityTransformation()).toBe(true);
      expect(model.moveToTransformation(`${move}2`).isIdentical(model.moveToTransformation(`${move}'`))).toBe(true);
      expect(simplifyNativePuzzleAlg('baby_fto', `${move} ${move} ${move}`)).toBe('');
    }
    const sequence = "U F' R2 L D' B BR' BL [U, R] (F L')2";
    expect(model.defaultPattern().applyAlg(sequence).patternData)
      .toEqual(oracle.defaultPattern().applyAlg(sequence).patternData);
  });

  it('has eight faces with four triangular stickers and only the eight 120-degree face turns', async () => {
    const data = (await puzzles.baby_fto.pg!()).get3d();
    const visible = data.stickers.filter((sticker) => !sticker.isDup);
    expect(data.faces).toHaveLength(8);
    expect(visible).toHaveLength(32);
    for (let face = 0; face < 8; face++) {
      expect(visible.filter((sticker) => sticker.face === face)).toHaveLength(4);
    }
    expect(visible.every((sticker) => sticker.coords.length === 9)).toBe(true);
    expect(new Set(visible.map((sticker) => `${sticker.orbit}:${sticker.ord}`)).size).toBe(14);
    const moves = nativePuzzleMoves('baby_fto');
    expect(moves.map(({ move }) => move).sort()).toEqual([...FACES].sort());
    expect(moves.every((move) => move.depth === 'outer' && move.order === 3)).toBe(true);
    const geometry = createNativePuzzleDragGeometry('baby_fto');
    expect(geometry.stickers).toHaveLength(32);
    expect(geometry.moves).toHaveLength(8);
    const faceAxes = data.axis.filter((axis) => {
      const family = data.notationMapper.notationToExternal(new Move(axis.quantumMove.toString()))!.family;
      return FACES.some((face) => face === family);
    });
    expect(faceAxes).toHaveLength(8);
    expect(faceAxes.every((axis) => axis.order === 3)).toBe(true);
  });

  it('validates external notation against the named loader and bounds expansion', async () => {
    const oracle = await puzzles.baby_fto.kpuzzle();
    for (const input of ["U F' R2 L D' B BR' BL", '[U, R] (F L)2', '[BR: BL]']) {
      const alg = parseNativePuzzleAlg('baby_fto', input);
      expect(nativePuzzleKPuzzle('baby_fto').algToTransformation(alg).transformationData)
        .toEqual(oracle.algToTransformation(input).transformationData);
    }
    for (const input of ['BB', 'INVALID', '(U', 'U1000000000', '(U R)1000000000', '()1000000000']) {
      expect(() => parseNativePuzzleAlg('baby_fto', input), input).toThrow();
    }
    expect(() => parseNativePuzzleAlg('baby_fto', 'U '.repeat(8193))).toThrow(/too long/);
    expect(() => parseNativePuzzleAlg('baby_fto', '('.repeat(33) + 'U' + ')'.repeat(33))).toThrow(/too deep/);
  });

  it('drags all eight faces in both directions after rotating the view', async () => {
    const oracle = await puzzles.baby_fto.kpuzzle();
    const data = (await puzzles.baby_fto.pg!()).get3d();
    const geometry = createNativePuzzleDragGeometry('baby_fto');
    const axes = new Map(data.axis.map((axis) => [
      data.notationMapper.notationToExternal(new Move(axis.quantumMove.toString()))!.family,
      new THREE.Vector3(axis.coordinates[0], axis.coordinates[1], axis.coordinates[2]).normalize(),
    ]));
    const stickers = data.stickers.filter((sticker) => !sticker.isDup).map((sticker) => {
      const vertices: THREE.Vector3[] = [];
      for (let i = 0; i < sticker.coords.length; i += 3) {
        vertices.push(new THREE.Vector3(sticker.coords[i], sticker.coords[i + 1], sticker.coords[i + 2]).multiplyScalar(0.5));
      }
      const center = vertices.reduce((sum, vertex) => sum.add(vertex), new THREE.Vector3()).divideScalar(vertices.length);
      return { ...sticker, vertices, center };
    });
    const world = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.31, -0.57, 0.23));
    world.setPosition(0.12, -0.08, 0.17);
    for (const move of FACES) {
      const normal = axes.get(move)!;
      const transformation = oracle.moveToTransformation(move).transformationData;
      let witness = false;
      for (const sticker of stickers) {
        const orbit = transformation[sticker.orbit];
        if (orbit.permutation[sticker.ord] === sticker.ord && orbit.orientationDelta[sticker.ord] === 0) continue;
        for (const point of [sticker.center, ...sticker.vertices.map((vertex) => sticker.center.clone().lerp(vertex, 0.23))]) {
          const camera = surfaceCamera(point, world);
          const delta = clockwiseDelta(point, normal, world, camera);
          if (!delta) continue;
          const token = pickNativePuzzleDrag(geometry, point, world, camera, delta, VIEWPORT, 'outer');
          if (token !== move) continue;
          const reverse = pickNativePuzzleDrag(geometry, point, world, camera, { x: -delta.x, y: -delta.y }, VIEWPORT, 'outer');
          expect(reverse).toBe(`${move}'`);
          expect(nativePuzzleKPuzzle('baby_fto').moveToTransformation(token).transformationData)
            .toEqual(oracle.moveToTransformation(move).transformationData);
          witness = true;
          break;
        }
        if (witness) break;
      }
      expect(witness, `No reachable Baby FTO drag for ${move}`).toBe(true);
    }
  });
});
