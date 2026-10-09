import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { getPuzzleGeometryByDesc, type StickerDatSticker } from 'cubing/puzzle-geometry';
import { NATIVE_PUZZLES, nativePuzzleMoves } from '@cuberoot/puzzle-solvers/native-puzzles';
import { nativePuzzleKPuzzle } from '@cuberoot/puzzle-solvers/native-puzzle-model';

// Physical baselines and source references live in the sim-add-puzzle skill's
// references/native-pg-puzzles.md. These are visible pieces, excluding PG's
// duplicate polygons used to represent unmarked triangle orientations.
const CASES = [
  {
    id: 'dogic', faces: 20, perFace: 4, facelets: 80, pieces: 80, axes: 12, order: 5,
    orbits: [['CENTERS', 60, 1], ['CENTERS2', 20, 3]],
    moved: { outer: [5, 0], inner: [10, 5], wide: [15, 5] },
  },
  {
    id: 'octahedron4', faces: 8, perFace: 4, facelets: 32, pieces: 32, axes: 6, order: 4,
    orbits: [['CENTERS', 24, 1], ['CENTERS2', 8, 3]],
    moved: { outer: [4, 0], inner: [8, 4], wide: [12, 4] },
  },
  {
    id: 'dinoskewb', faces: 6, perFace: 12, facelets: 72, pieces: 48, axes: 8, order: 3,
    orbits: [['EDGES', 24, 2], ['CENTERS', 24, 1]],
    moved: { outer: [6, 6], inner: [6, 6], wide: [12, 12] },
  },
] as const;

function pointsByPiece(stickers: StickerDatSticker[]): Map<string, Vector3[]> {
  const points = new Map<string, Vector3[]>();
  for (const sticker of stickers) {
    const key = `${sticker.orbit}:${sticker.ord}`;
    const piece = points.get(key) ?? [];
    for (let i = 0; i < sticker.coords.length; i += 3) {
      piece.push(new Vector3().fromArray(sticker.coords, i));
    }
    points.set(key, piece);
  }
  return points;
}

function fixture(id: typeof CASES[number]['id']) {
  const pg = getPuzzleGeometryByDesc(NATIVE_PUZZLES[id].description, {
    allMoves: true, orientCenters: true, addRotations: true,
  });
  const geometry = pg.get3d();
  const visible = geometry.stickers.filter((sticker) => !sticker.isDup);
  const points = pointsByPiece(visible);
  const centroids = new Map([...points].map(([key, vertices]) => [
    key,
    vertices.reduce((sum, point) => sum.add(point), new Vector3()).divideScalar(vertices.length),
  ]));
  return { pg, geometry, visible, points, centroids, puzzle: nativePuzzleKPuzzle(id) };
}

describe.each(CASES)('$id native geometry and physical notation', (spec) => {
  it('matches the sourced face, piece and color counts', () => {
    const { pg, geometry, visible, points, puzzle } = fixture(spec.id);
    expect(geometry.faces.length).toBe(spec.faces);
    expect(pg.stickersPerFace).toBe(spec.perFace);
    expect(visible.length).toBe(spec.facelets);
    expect(NATIVE_PUZZLES[spec.id].visibleFacelets).toBe(spec.facelets);
    expect(points.size).toBe(spec.pieces);
    expect(puzzle.definition.orbits.map((orbit) => [
      orbit.orbitName, orbit.numPieces, orbit.numOrientations,
    ])).toEqual(spec.orbits);
    expect(new Set(visible.map((sticker) => sticker.color)).size).toBe(spec.faces);
    for (let face = 0; face < spec.faces; face++) {
      const facelets = visible.filter((sticker) => sticker.face === face);
      expect(facelets.length).toBe(spec.perFace);
      expect(new Set(facelets.map((sticker) => sticker.color)).size).toBe(1);
    }
  });

  it('uses physical vertex axes and distinguishes outer, inner and wide turns', () => {
    const { geometry, puzzle } = fixture(spec.id);
    const bases = NATIVE_PUZZLES[spec.id].axes.flat();
    expect(new Set(bases).size).toBe(spec.axes);
    // F is an octahedral/icosahedral face or a cube face. These three puzzles
    // turn around vertices only, although addRotations also exposes Fv.
    expect(() => puzzle.moveToTransformation('F')).toThrow();
    expect(() => puzzle.moveToTransformation('Fv')).not.toThrow();
    for (const base of bases) {
      expect(geometry.axis.find((axis) => axis.quantumMove.toString() === base)?.order).toBe(spec.order);
      const moves = { outer: base, inner: `2${base}`, wide: `${base}w` };
      for (const kind of ['outer', 'inner', 'wide'] as const) {
        const transformation = puzzle.moveToTransformation(moves[kind]);
        expect(transformation.repetitionOrder()).toBe(spec.order);
        expect(spec.orbits.map(([orbit]) => transformation.transformationData[orbit]
          .permutation.filter((source, destination) => source !== destination).length))
          .toEqual(spec.moved[kind]);
        expect(nativePuzzleMoves(spec.id).find(({ move }) => move === moves[kind])?.order).toBe(spec.order);
      }
      expect(puzzle.moveToTransformation(`${base}w`)
        .isIdentical(puzzle.algToTransformation(`${base} 2${base}`))).toBe(true);
      expect(puzzle.moveToTransformation(`2${base}`)
        .isIdentical(puzzle.algToTransformation(`${base}w ${base}'`))).toBe(true);
      expect(puzzle.moveToTransformation(base.toLowerCase())
        .isIdentical(puzzle.moveToTransformation(`${base}w`))).toBe(true);
    }
  });

  it('matches every moved piece to an independent clockwise rigid rotation', () => {
    const { geometry, centroids, puzzle } = fixture(spec.id);
    // Use Euclidean rotations independently of PG's permutation construction.
    // Checking A followed by A' would not detect an inverted notation convention.
    for (const base of NATIVE_PUZZLES[spec.id].axes.flat()) {
      const grip = geometry.axis.find((axis) => axis.quantumMove.toString() === base)!;
      const axis = new Vector3().fromArray(grip.coordinates).normalize();
      const angle = -2 * Math.PI / spec.order;
      for (const move of [base, `2${base}`, `${base}w`]) {
        const transformation = puzzle.moveToTransformation(move);
        let maxError = 0;
        let wrongDirectionError = 0;
        for (const [orbit, data] of Object.entries(transformation.transformationData)) {
          for (let destination = 0; destination < data.permutation.length; destination++) {
            const source = data.permutation[destination];
            if (source === destination) continue;
            const from = centroids.get(`${orbit}:${source}`)!;
            const to = centroids.get(`${orbit}:${destination}`)!;
            maxError = Math.max(maxError, from.clone().applyAxisAngle(axis, angle).distanceTo(to));
            wrongDirectionError = Math.max(wrongDirectionError, from.clone().applyAxisAngle(axis, -angle).distanceTo(to));
          }
        }
        // The sourced octahedron cut is rounded to 11 decimal places.
        expect(maxError, `${spec.id} ${move} clockwise correspondence`).toBeLessThan(1e-8);
        expect(wrongDirectionError, `${spec.id} ${move} negative control`).toBeGreaterThan(0.5);
      }
    }
  });
});
