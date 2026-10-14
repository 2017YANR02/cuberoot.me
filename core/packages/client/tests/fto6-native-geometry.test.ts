import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { Move } from 'cubing/alg';
import { getPuzzleGeometryByDesc } from 'cubing/puzzle-geometry';
import { NATIVE_PUZZLES, generateNativePuzzleScramble, nativePuzzleMoves } from '@cuberoot/puzzle-solvers/native-puzzles';
import { nativePuzzleKPuzzle, parseNativePuzzleAlg } from '@cuberoot/puzzle-solvers/native-puzzle-model';

// Independent construction: for an octahedron of inradius 1, face-normal cuts
// at 0, +/-1/3 and +/-2/3 intersect each edge at its five sixth-division points.
// Each face has 36 equal triangles. Surface incidence gives 6 four-sticker
// corners, 48 two-sticker edges, and 168 one-sticker centers (222 pieces).
// See sim-add-puzzle/references/native-pg-puzzles.md, "Six-layer FTO".
const id = 'fto6' as const;
function fixture() {
  const pg = getPuzzleGeometryByDesc(NATIVE_PUZZLES[id].description, {
    allMoves: true, orientCenters: true, addRotations: true,
  });
  const geometry = pg.get3d();
  const visible = geometry.stickers.filter((sticker) => !sticker.isDup);
  const points = new Map<string, Vector3[]>();
  const faceletCounts = new Map<string, number>();
  for (const sticker of visible) {
    const key = `${sticker.orbit}:${sticker.ord}`;
    const vertices = points.get(key) ?? [];
    for (let i = 0; i < sticker.coords.length; i += 3) {
      vertices.push(new Vector3().fromArray(sticker.coords, i));
    }
    points.set(key, vertices);
    faceletCounts.set(key, (faceletCounts.get(key) ?? 0) + 1);
  }
  const centroids = new Map([...points].map(([key, vertices]) => [key,
    vertices.reduce((sum, vertex) => sum.add(vertex), new Vector3()).divideScalar(vertices.length),
  ]));
  return { pg, geometry, visible, points, faceletCounts, centroids, puzzle: nativePuzzleKPuzzle(id) };
}

describe('six-layer FTO native model', () => {
  it('has the independently constructed 288 equal triangular facelets and 222 visible pieces', () => {
    const { pg, geometry, visible, points, faceletCounts } = fixture();
    expect(NATIVE_PUZZLES[id].description).toBe('o f 0 f 0.3333333333333333 f 0.6666666666666666');
    expect(geometry.faces).toHaveLength(8);
    expect(pg.stickersPerFace).toBe(36);
    expect(visible).toHaveLength(288);
    expect(NATIVE_PUZZLES[id].visibleFacelets).toBe(288);
    expect(points.size).toBe(222);
    expect([...faceletCounts.values()].filter((n) => n === 4)).toHaveLength(6);
    expect([...faceletCounts.values()].filter((n) => n === 2)).toHaveLength(48);
    expect([...faceletCounts.values()].filter((n) => n === 1)).toHaveLength(168);
    const areas: number[] = [];
    for (let face = 0; face < 8; face++) {
      const stickers = visible.filter((sticker) => sticker.face === face);
      expect(stickers).toHaveLength(36);
      expect(new Set(stickers.map((sticker) => sticker.color)).size).toBe(1);
      for (const sticker of stickers) {
        expect(sticker.coords).toHaveLength(9);
        const a = new Vector3().fromArray(sticker.coords, 0);
        const b = new Vector3().fromArray(sticker.coords, 3);
        const c = new Vector3().fromArray(sticker.coords, 6);
        areas.push(b.sub(a).cross(c.sub(a)).length() / 2);
      }
    }
    expect(new Set(visible.map((sticker) => sticker.color)).size).toBe(8);
    expect(Math.min(...areas)).toBeGreaterThan(0);
    expect(Math.max(...areas) / Math.min(...areas)).toBeCloseTo(1, 8);
  });

  it('retains all three independent single layers and both native range-wide layers on every face', () => {
    const puzzle = nativePuzzleKPuzzle(id);
    const moves = nativePuzzleMoves(id);
    expect(moves).toHaveLength(40);
    expect(new Set(moves.map(({ depth }) => depth))).toEqual(new Set(['outer', 'inner', 'inner3', 'wide', 'wide3']));
    for (const base of NATIVE_PUZZLES[id].axes.flat()) {
      const tokens = [base, `2${base}`, `3${base}`, `1-2${base}`, `1-3${base}`];
      for (const token of tokens) {
        expect(moves.find(({ move }) => move === token)?.order).toBe(3);
        const transformation = puzzle.moveToTransformation(token);
        expect(transformation.repetitionOrder()).toBe(3);
        expect(puzzle.algToTransformation(`${token} ${token}'`).isIdentityTransformation()).toBe(true);
        expect(transformation.isIdentityTransformation()).toBe(false);
      }
      expect(puzzle.moveToTransformation(`1-2${base}`).isIdentical(puzzle.algToTransformation(`${base} 2${base}`))).toBe(true);
      expect(puzzle.moveToTransformation(`1-3${base}`).isIdentical(puzzle.algToTransformation(`${base} 2${base} 3${base}`))).toBe(true);
    }
    // Unlike a five-layer FTO, the two third layers are distinct halves,
    // not two names for the same central slice.
    for (const [front, back] of NATIVE_PUZZLES[id].axes) {
      expect(puzzle.moveToTransformation(`3${front}`).isIdentical(puzzle.moveToTransformation(`3${back}'`))).toBe(false);
    }
  });

  it('matches all 40 native moves to independent clockwise 120-degree rigid rotations', () => {
    const { geometry, centroids, puzzle } = fixture();
    for (const { move, family } of nativePuzzleMoves(id)) {
      const grip = geometry.axis.find((axis) => geometry.notationMapper
        .notationToExternal(new Move(axis.quantumMove.toString()))?.family === family)!;
      expect(grip.order).toBe(3);
      const axis = new Vector3().fromArray(grip.coordinates).normalize();
      let error = 0;
      let wrongDirectionError = 0;
      let moved = 0;
      for (const [orbit, data] of Object.entries(puzzle.moveToTransformation(move).transformationData)) {
        for (let destination = 0; destination < data.permutation.length; destination++) {
          const source = data.permutation[destination];
          if (source === destination) continue;
          const from = centroids.get(`${orbit}:${source}`)!;
          const to = centroids.get(`${orbit}:${destination}`)!;
          error = Math.max(error, from.clone().applyAxisAngle(axis, -2 * Math.PI / 3).distanceTo(to));
          wrongDirectionError = Math.max(wrongDirectionError, from.clone().applyAxisAngle(axis, 2 * Math.PI / 3).distanceTo(to));
          moved++;
        }
      }
      expect(moved, move).toBeGreaterThan(0);
      expect(error, `${move}: rigid correspondence`).toBeLessThan(1e-8);
      expect(wrongDirectionError, `${move}: negative direction control`).toBeGreaterThan(0.05);
    }
  });

  it('generates bounded reproducible practice scrambles without identity turns', () => {
    const puzzle = nativePuzzleKPuzzle(id);
    for (const random of [() => 0, () => 0.999999, () => 0.42]) {
      const scramble = generateNativePuzzleScramble(id, random);
      expect(scramble).toBe(generateNativePuzzleScramble(id, random));
      expect(scramble.split(/\s+/)).toHaveLength(72);
      expect(() => parseNativePuzzleAlg(id, scramble)).not.toThrow();
      for (const token of scramble.split(/\s+/)) {
        expect(puzzle.moveToTransformation(token).repetitionOrder()).toBe(3);
      }
      expect(scramble).toContain('1-2');
      expect(scramble).toContain('1-3');
    }
  });
});
