import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { getPuzzleGeometryByDesc } from 'cubing/puzzle-geometry';
import { NATIVE_PUZZLES, generateNativePuzzleScramble, nativePuzzleMoves } from '@cuberoot/puzzle-solvers/native-puzzles';
import { nativePuzzleKPuzzle, parseNativePuzzleAlg } from '@cuberoot/puzzle-solvers/native-puzzle-model';

// Tom van der Zanden's 3x3x3 Dino has a uniform 3x3 grid and two complete
// diagonals on each face. Reconstruct that planar partition independently of PG.
// Source: https://www.tomvanderzanden.nl/puzzle.php?puz=3x3x3+Dino+Cube
type Point = readonly [number, number];
function clip(poly: Point[], normal: Point): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const da = a[0] * normal[0] + a[1] * normal[1];
    const db = b[0] * normal[0] + b[1] * normal[1];
    if (da >= -1e-10) out.push(a);
    if ((da > 1e-10 && db < -1e-10) || (da < -1e-10 && db > 1e-10)) {
      const t = da / (da - db);
      out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  }
  return out;
}
const polygonKey = (poly: Point[]): string => poly.map((p) => p.map((v) => Math.round(v * 1e8)).join(',')).sort().join(';');
function expectedFace(): string[] {
  const cells: Point[][] = [];
  for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) {
    const x0 = -1 + 2 * x / 3, x1 = -1 + 2 * (x + 1) / 3;
    const y0 = -1 + 2 * y / 3, y1 = -1 + 2 * (y + 1) / 3;
    let parts: Point[][] = [[[x0, y0], [x1, y0], [x1, y1], [x0, y1]]];
    for (const n of [[1, 1], [1, -1]] as const) {
      parts = parts.flatMap((p) => [clip(p, n), clip(p, [-n[0], -n[1]])]).filter((p) => {
        const area2 = p.reduce((sum, a, i) => {
          const b = p[(i + 1) % p.length];
          return sum + a[0] * b[1] - a[1] * b[0];
        }, 0);
        return Math.abs(area2) > 1e-10;
      });
    }
    cells.push(...parts);
  }
  return cells.map(polygonKey).sort();
}

// Face letters determine physical outside normals, independently of PG axes.
const FACE_NORMALS: Record<string, readonly [number, number, number]> = {
  F: [0, 0, 1], B: [0, 0, -1], D: [0, -1, 0], U: [0, 1, 0], L: [-1, 0, 0], R: [1, 0, 0],
};
const normalFor = (family: string): Vector3 => [...family].reduce((sum, face) => sum.add(new Vector3(...FACE_NORMALS[face])), new Vector3());

function fixture() {
  const pg = getPuzzleGeometryByDesc(NATIVE_PUZZLES.cube3dino.description, { allMoves: true, orientCenters: true, addRotations: true });
  const geometry = pg.get3d();
  const stickers = geometry.stickers.filter((s) => !s.isDup).map((sticker) => {
    const vertices = Array.from({ length: sticker.coords.length / 3 }, (_, i) => new Vector3().fromArray(sticker.coords, i * 3));
    return { ...sticker, vertices, center: vertices.reduce((sum, p) => sum.add(p), new Vector3()).divideScalar(vertices.length) };
  });
  const half = Math.max(...stickers.flatMap((s) => s.coords.map(Math.abs)));
  return { pg, geometry, stickers, half, puzzle: nativePuzzleKPuzzle('cube3dino') };
}

describe('3x3 + Dino physical geometry and mixed notation', () => {
  it('matches the independently clipped 16-region face and all sixty physical pieces', () => {
    const { pg, geometry, stickers, half, puzzle } = fixture();
    expect(geometry.faces.length).toBe(6);
    expect(pg.stickersPerFace).toBe(16);
    expect(stickers.length).toBe(96);
    expect(geometry.stickers.length).toBe(96);
    expect(new Set(stickers.map((s) => `${s.orbit}:${s.ord}`)).size).toBe(60);
    expect(puzzle.definition.orbits).toEqual([
      { orbitName: 'EDGES', numPieces: 24, numOrientations: 2 },
      { orbitName: 'EDGES2', numPieces: 12, numOrientations: 2 },
      { orbitName: 'CENTERS', numPieces: 24, numOrientations: 1 },
    ]);
    const expected = expectedFace();
    expect(expected.length).toBe(16);
    for (let face = 0; face < 6; face++) {
      const visible = stickers.filter((s) => s.face === face);
      expect(visible.filter((s) => s.vertices.length === 3).length).toBe(12);
      expect(visible.filter((s) => s.vertices.length === 4).length).toBe(4);
      expect(new Set(visible.map((s) => s.color)).size).toBe(1);
      const all = visible.flatMap((s) => s.vertices.map((p) => p.toArray()));
      const coordinates = [0, 1, 2].filter((axis) => all.some((p) => Math.abs(p[axis] - all[0][axis]) > 1e-8));
      expect(coordinates.length).toBe(2);
      const polygons = visible.map((s) => polygonKey(s.vertices.map((v) => {
        const p = v.toArray();
        return [p[coordinates[0]] / half, p[coordinates[1]] / half];
      }))).sort();
      expect(polygons).toEqual(expected);
    }
  });

  it('matches every outer, inner and wide move to independently selected clockwise geometry', () => {
    const { stickers, half, puzzle } = fixture();
    expect(nativePuzzleMoves('cube3dino').length).toBe(42);
    for (const family of NATIVE_PUZZLES.cube3dino.axes.flat()) {
      const normal = normalFor(family), axis = normal.clone().normalize();
      const order = family.length === 1 ? 4 : 3;
      const cut = half * (order === 4 ? 1 / 3 : 1);
      for (const [kind, move] of [['outer', family], ['inner', `2${family}`], ['wide', `${family}w`]] as const) {
        const transform = puzzle.moveToTransformation(move);
        expect(transform.repetitionOrder()).toBe(order);
        expect(nativePuzzleMoves('cube3dino').find((m) => m.move === move)?.order).toBe(order);
        const pattern = puzzle.defaultPattern().applyMove(move).patternData;
        let wrongSign = 0;
        for (const source of stickers) {
          const dot = source.center.dot(normal);
          const moving = kind === 'outer' ? dot > cut + 1e-9 : kind === 'inner' ? Math.abs(dot) < cut - 1e-9 : dot > -cut + 1e-9;
          const point = source.center.clone();
          if (moving) point.applyAxisAngle(axis, -2 * Math.PI / order);
          const target = stickers.find((s) => s.center.distanceTo(point) < 1e-8)!;
          expect(target, move).toBeDefined();
          const orbit = pattern[target.orbit];
          expect(target.orbit, move).toBe(source.orbit);
          expect(orbit.pieces[target.ord], move).toBe(source.ord);
          const orientationCount = source.orbit === 'CENTERS' ? 1 : 2;
          expect((target.ori - orbit.orientation[target.ord] + orientationCount) % orientationCount, move).toBe(source.ori);
          if (moving && source.center.clone().applyAxisAngle(axis, 2 * Math.PI / order).distanceTo(point) > 1e-6) wrongSign++;
          // Both cut planes are perpendicular to the axis, so their signed
          // distance is invariant throughout the actual turn, including midframes.
          for (const progress of [0, 0.2, 0.5, 0.8, 1]) {
            for (const vertex of source.vertices) {
              expect(vertex.clone().applyAxisAngle(axis, -2 * Math.PI * progress / order).dot(normal)).toBeCloseTo(vertex.dot(normal), 10);
            }
          }
        }
        expect(wrongSign).toBeGreaterThan(0);
      }
    }
  });

  it('keeps middle slices, wide turns and rotations distinct in the full parser', () => {
    const puzzle = nativePuzzleKPuzzle('cube3dino');
    for (const [a, b] of NATIVE_PUZZLES.cube3dino.axes) {
      for (const [actual, equivalent] of [
        [`${a}w`, `${a} 2${a}`], [`2${a}`, `2${b}'`], [`3${a}`, `${b}'`], [`${a}v`, `${a} 2${a} ${b}'`],
      ]) expect(puzzle.algToTransformation(parseNativePuzzleAlg('cube3dino', actual)).isIdentical(puzzle.algToTransformation(equivalent))).toBe(true);
    }
    for (const invalid of ['x', 'y', 'z', '3Fw', '3UFRw', '4F', '4UFR', 'DF']) {
      expect(() => parseNativePuzzleAlg('cube3dino', invalid)).toThrow();
    }
    const alg = parseNativePuzzleAlg('cube3dino', "[F, UFR] (Rw 2DRF')2 // mixed cuts\nFv UFRv");
    expect(puzzle.defaultPattern().applyAlg(alg).applyAlg(alg.invert()).isIdentical(puzzle.defaultPattern())).toBe(true);
    expect(puzzle.algToTransformation('F UFR').isIdentical(puzzle.algToTransformation('UFR F'))).toBe(false);
  });

  it('exercises both depths of both mechanisms even with extreme deterministic random sources', () => {
    for (const value of [0, 0.999999]) {
      const tokens = generateNativePuzzleScramble('cube3dino', () => value).split(' ');
      expect(tokens.length).toBe(40);
      const classes = tokens.map((token) => {
        parseNativePuzzleAlg('cube3dino', token);
        return `${token.replace(/[w2']/g, '').length === 1 ? 'face' : 'corner'}:${token.includes('w') ? 'wide' : 'outer'}`;
      });
      expect(classes).toEqual(Array.from({ length: 10 }, () => ['face:outer', 'corner:outer', 'face:wide', 'corner:wide']).flat());
    }
  });
});
