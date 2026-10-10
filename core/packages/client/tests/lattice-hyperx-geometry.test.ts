import { describe, expect, it } from 'vitest';
import { Move } from 'cubing/alg';
import { Vector3 } from 'three';
import { getPuzzleGeometryByDesc } from 'cubing/puzzle-geometry';
import { NATIVE_PUZZLES, nativePuzzleMoves, generateNativePuzzleScramble } from '@cuberoot/puzzle-solvers/native-puzzles';
import { nativePuzzleKPuzzle, parseNativePuzzleAlg } from '@cuberoot/puzzle-solvers/native-puzzle-model';

// Independently reconstructed from the physical cut families, not PG move sets.
// Lattice: https://twistypuzzles.com/articles/spotlight-okamoto/
// Hyper X (Master Skewb + 2x2): https://www.youtube.com/watch?v=moAp71Z9Ios
// Lattice X (Lattice + 2x2): https://www.youtube.com/watch?v=b0ie8C8XAnU
// The selected idealized Master Skewb depth is not a measured prototype size.
const CASES = [
  { id: 'lattice', faces: 72, pieces: 36, triangles: 8, quads: 4, faceCuts: false, cornerCuts: [2, 1],
    orbits: [['EDGES', 24, 2], ['EDGES2', 12, 2]], moves: 40 },
  { id: 'hyperx', faces: 120, pieces: 80, triangles: 16, quads: 4, faceCuts: true, cornerCuts: [Math.sqrt(3) * 0.275],
    orbits: [['CORNERS', 8, 3], ['CENTERS', 24, 1], ['CENTERS2', 24, 1], ['EDGES', 24, 2]], moves: 30 },
  { id: 'latticex', faces: 96, pieces: 48, triangles: 16, quads: 0, faceCuts: true, cornerCuts: [2, 1],
    orbits: [['EDGES', 24, 2], ['EDGES2', 24, 2]], moves: 46 },
] as const;
type Case = typeof CASES[number];
type Point = readonly [number, number];
const EPS = 1e-9;

function clean(poly: Point[]): Point[] {
  const unique = poly.filter((p, i) => !i || Math.hypot(p[0] - poly[i - 1][0], p[1] - poly[i - 1][1]) > EPS);
  return unique.filter((p, i) => {
    const a = unique[(i + unique.length - 1) % unique.length], b = unique[(i + 1) % unique.length];
    return Math.abs((p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0])) > EPS;
  });
}
function clip(poly: Point[], n: Point, cut: number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const da = a[0] * n[0] + a[1] * n[1] - cut, db = b[0] * n[0] + b[1] * n[1] - cut;
    if (da >= -EPS) out.push(a);
    if ((da > EPS && db < -EPS) || (da < -EPS && db > EPS)) {
      const t = da / (da - db);
      out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  }
  return clean(out);
}
function physicalFace(spec: Case): Point[][] {
  let regions: Point[][] = [[[-1, -1], [1, -1], [1, 1], [-1, 1]]];
  const planes: [Point, number][] = spec.faceCuts ? [[[1, 0], 0], [[0, 1], 0]] : [];
  // On z=1, sx*x + sy*y + sz*z = cut becomes a 2D straight line.
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    for (const cut of spec.cornerCuts) planes.push([[sx, sy], cut - sz]);
  }
  for (const [n, cut] of planes) regions = regions.flatMap((poly) => [clip(poly, n, cut), clip(poly, [-n[0], -n[1]], -cut)])
    .filter((poly) => poly.length >= 3);
  return regions;
}
const polygonKey = (poly: Point[]): string => poly.map((p) => p.map((x) => Math.round(x * 1e8)).join(',')).sort().join(';');
const NORMALS: Record<string, readonly [number, number, number]> = {
  F: [0, 0, 1], B: [0, 0, -1], U: [0, 1, 0], D: [0, -1, 0], R: [1, 0, 0], L: [-1, 0, 0],
};
const physicalNormal = (family: string): Vector3 => [...family].reduce((n, face) => n.add(new Vector3(...NORMALS[face])), new Vector3());

function fixture(spec: Case) {
  const data = getPuzzleGeometryByDesc(NATIVE_PUZZLES[spec.id].description, { allMoves: true, orientCenters: true, addRotations: true }).get3d();
  const stickers = data.stickers.filter((s) => !s.isDup).map((s) => {
    const vertices = Array.from({ length: s.coords.length / 3 }, (_, i) => new Vector3().fromArray(s.coords, i * 3));
    return { ...s, vertices, center: vertices.reduce((sum, p) => sum.add(p), new Vector3()).divideScalar(vertices.length) };
  });
  const half = Math.max(...data.faces[0].coords.map(Math.abs));
  return { data, stickers, half, puzzle: nativePuzzleKPuzzle(spec.id) };
}

describe.each(CASES)('$id independent physical cuts', (spec) => {
  it('matches every visible face polygon to an independent plane intersection', () => {
    const { data, stickers, half, puzzle } = fixture(spec);
    const expected = physicalFace(spec);
    expect(expected.length).toBe(spec.triangles + spec.quads);
    expect(data.faces.length).toBe(6);
    expect(data.stickers.length).toBe(spec.faces);
    expect(stickers.length).toBe(spec.faces);
    expect(new Set(stickers.map((s) => `${s.orbit}:${s.ord}`)).size).toBe(spec.pieces);
    expect(puzzle.definition.orbits.map((o) => [o.orbitName, o.numPieces, o.numOrientations])).toEqual(spec.orbits);
    for (let face = 0; face < 6; face++) {
      const visible = stickers.filter((s) => s.face === face);
      expect(visible.filter((s) => s.vertices.length === 3).length).toBe(spec.triangles);
      expect(visible.filter((s) => s.vertices.length === 4).length).toBe(spec.quads);
      const all = visible.flatMap((s) => s.vertices.map((p) => p.toArray()));
      const xy = [0, 1, 2].filter((axis) => all.some((p) => Math.abs(p[axis] - all[0][axis]) > EPS));
      const actual = visible.map((s) => polygonKey(s.vertices.map((v) => [v.toArray()[xy[0]] / half, v.toArray()[xy[1]] / half]))).sort();
      expect(actual).toEqual(expected.map(polygonKey).sort());
    }
  });

  it('independently selects each slice and matches clockwise geometry throughout a turn', () => {
    const { stickers, half, puzzle } = fixture(spec);
    const choices = nativePuzzleMoves(spec.id);
    expect(choices.length).toBe(spec.moves);
    for (const { move, family } of choices) {
      const parsed = new Move(move), isFace = family.length === 1;
      const normal = physicalNormal(family), axis = normal.clone().normalize(), order = isFace ? 4 : 3;
      const cuts = isFace ? [0] : [...spec.cornerCuts, ...[...spec.cornerCuts].reverse().map((v) => -v)];
      const bounds = [Infinity, ...cuts, -Infinity];
      const wide = parsed.family.endsWith('w'), layer = parsed.innerLayer ?? (wide ? 2 : 1);
      const low = bounds[layer], high = wide ? Infinity : bounds[layer - 1];
      const state = puzzle.defaultPattern().applyMove(move).patternData;
      expect(puzzle.moveToTransformation(move).repetitionOrder()).toBe(order);
      let wrongDirection = 0;
      for (const source of stickers) {
        const distance = source.center.dot(normal) / half;
        const moving = distance > low + EPS && distance < high - EPS;
        const point = source.center.clone();
        if (moving) point.applyAxisAngle(axis, -2 * Math.PI / order);
        const target = stickers.find((s) => s.center.distanceTo(point) < 1e-8);
        expect(target, `${spec.id} ${move}`).toBeDefined();
        const orbit = state[target!.orbit];
        expect(target!.orbit).toBe(source.orbit);
        expect(orbit.pieces[target!.ord], `${spec.id} ${move}`).toBe(source.ord);
        const count = puzzle.definition.orbits.find((o) => o.orbitName === source.orbit)!.numOrientations;
        expect((target!.ori - orbit.orientation[target!.ord] + count) % count).toBe(source.ori);
        if (!moving) continue;
        wrongDirection = Math.max(wrongDirection, source.center.clone().applyAxisAngle(axis, 2 * Math.PI / order).distanceTo(point));
        for (const vertex of source.vertices) {
          const before = vertex.dot(normal) / half;
          expect(before >= low - EPS && before <= high + EPS).toBe(true);
          for (const progress of [0, 0.2, 0.5, 0.8, 1]) {
            const after = vertex.clone().applyAxisAngle(axis, -2 * Math.PI * progress / order).dot(normal) / half;
            expect(after).toBeCloseTo(before, 10);
          }
        }
      }
      expect(wrongDirection > 0.1).toBe(true);
    }
  });

  it('preserves full-depth aliases and rejects fake face-wide or over-deep turns', () => {
    const { puzzle } = fixture(spec);
    for (const [a, b] of NATIVE_PUZZLES[spec.id].axes) {
      const face = a.length === 1;
      const count = face ? 2 : spec.id === 'hyperx' ? 3 : 5;
      for (let layer = 1; layer <= count; layer++) {
        const token = `${layer === 1 ? '' : layer}${a}`;
        const opposite = count + 1 - layer;
        expect(puzzle.moveToTransformation(token).isIdentical(puzzle.moveToTransformation(`${opposite === 1 ? '' : opposite}${b}'`))).toBe(true);
      }
      for (let width = 2; width < count; width++) {
        const token = `${width === 2 ? '' : width}${a}w`;
        const individual = Array.from({ length: width }, (_, i) => `${i ? i + 1 : ''}${a}`).join(' ');
        expect(puzzle.moveToTransformation(token).isIdentical(puzzle.algToTransformation(individual))).toBe(true);
      }
      const whole = Array.from({ length: count }, (_, i) => `${i ? i + 1 : ''}${a}`).join(' ');
      expect(puzzle.moveToTransformation(`${a}v`).isIdentical(puzzle.algToTransformation(whole))).toBe(true);
      for (const invalid of [`${count + 1}${a}`, `${count === 2 ? '' : count}${a}w`, `2${a}v`]) {
        expect(() => parseNativePuzzleAlg(spec.id, invalid)).toThrow();
      }
    }
  });

  it('exercises every supported mechanism and cut with extreme random sources', () => {
    const cycle = spec.id === 'lattice' ? ['corner:1', 'corner:2', 'corner:3']
      : spec.id === 'hyperx' ? ['face:1', 'corner:1', 'face:1', 'corner:2']
        : ['face:1', 'corner:1', 'face:1', 'corner:2', 'face:1', 'corner:3'];
    for (const value of [0, 0.999999]) {
      const scramble = generateNativePuzzleScramble(spec.id, () => value);
      parseNativePuzzleAlg(spec.id, scramble);
      const classes = scramble.split(' ').map((token) => {
        const move = new Move(token), family = move.family.replace(/w$/, '');
        return `${family.length === 1 ? 'face' : 'corner'}:${move.family.endsWith('w') ? move.innerLayer ?? 2 : 1}`;
      });
      expect(classes).toEqual(Array.from({ length: NATIVE_PUZZLES[spec.id].scrambleLength }, (_, i) => cycle[i % cycle.length]));
    }
  });
});
