import { describe, expect, it } from 'vitest';
import {
  DUO_GODS_NUMBER,
  DUO_LENGTH_DISTRIBUTION,
  applyDuoMove,
  classifyDuoTokens,
  duoApply,
  duoGraphStats,
  duoMovesToString,
  duoStickerColor,
  generatePyraminxDuoScramble,
  invertDuoMoves,
  isDuoSolved,
  parseDuoMoves,
  reduceDuoAlg,
  solvePyraminxDuo,
  solvedDuo,
  type DuoState,
} from '../src/pyraminx-duo';

type Vector = readonly [number, number, number];
interface GeometricMove { token: string; corner: number; angle: number }
interface StickerState { centers: number[]; cornerColors: Array<Array<number | null>> }

// Independent geometric oracle: no imported axes, face cycles, or move tables.
// Face f is opposite vertex f, so its outward normal is -vertex[f]. A bare
// move is clockwise when looking inward along that corner's outward axis.
const VERTICES: readonly Vector[] = [
  [1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1],
];
const NORMALS: Vector[] = VERTICES.map(([x, y, z]) => [-x, -y, -z]);
const MOVES: GeometricMove[] = ['U', 'L', 'R', 'B'].flatMap((name, corner) => [
  { token: name, corner, angle: -2 * Math.PI / 3 },
  { token: `${name}'`, corner, angle: 2 * Math.PI / 3 },
]);

function rodrigues(vector: Vector, axis: Vector, angle: number): Vector {
  const norm = Math.hypot(...axis);
  const [x, y, z] = axis.map(value => value / norm);
  const [vx, vy, vz] = vector;
  const dot = x * vx + y * vy + z * vz;
  const cosine = Math.cos(angle), sine = Math.sin(angle);
  return [
    vx * cosine + (y * vz - z * vy) * sine + x * dot * (1 - cosine),
    vy * cosine + (z * vx - x * vz) * sine + y * dot * (1 - cosine),
    vz * cosine + (x * vy - y * vx) * sine + z * dot * (1 - cosine),
  ];
}

function rotatedFace(face: number, move: GeometricMove): number {
  const normal = rodrigues(NORMALS[face], VERTICES[move.corner], move.angle);
  const destination = NORMALS.findIndex(candidate =>
    candidate.every((component, index) => Math.abs(component - normal[index]) < 1e-9));
  if (destination === -1) throw new Error('Geometric rotation did not land on a tetrahedron face');
  return destination;
}

function referenceSolved(): StickerState {
  return {
    centers: [0, 1, 2, 3],
    cornerColors: VERTICES.map((_, corner) => VERTICES.map((_, face) => face === corner ? null : face)),
  };
}

function referenceMove(state: StickerState, move: GeometricMove): StickerState {
  const next = { centers: state.centers.slice(), cornerColors: state.cornerColors.map(colors => colors.slice()) };
  for (let face = 0; face < 4; face++) {
    const destination = rotatedFace(face, move);
    next.centers[destination] = state.centers[face];
    if (face !== move.corner) next.cornerColors[move.corner][destination] = state.cornerColors[move.corner][face];
  }
  return next;
}

function referenceTokens(text: string): GeometricMove[] {
  return text.trim().split(/\s+/).filter(Boolean).map(token => {
    const move = MOVES.find(candidate => candidate.token === token);
    if (!move) throw new Error(`Invalid reference move: ${token}`);
    return move;
  });
}

function referenceApply(text: string): StickerState {
  return referenceTokens(text).reduce(referenceMove, referenceSolved());
}

function referenceTwists(state: StickerState): number[] {
  return state.cornerColors.map((colors, corner) => {
    // Recover orientation from a coloured sticker's geometric destination,
    // rather than repeating the implementation's modular twist arithmetic.
    const homeFace = (corner + 1) % 4;
    const destinations = [homeFace, rotatedFace(homeFace, MOVES[corner * 2]), rotatedFace(homeFace, MOVES[corner * 2 + 1])];
    const twist = destinations.indexOf(colors.indexOf(homeFace));
    if (twist === -1) throw new Error('Invalid geometric corner orientation');
    return twist;
  });
}

function canonicalStickers(state: DuoState): StickerState {
  return {
    centers: VERTICES.map((_, face) => duoStickerColor(state, face, null)),
    cornerColors: VERTICES.map((_, corner) => VERTICES.map((_, face) =>
      corner === face ? null : duoStickerColor(state, face, corner))),
  };
}

function expectGeometricState(text: string, expected = referenceApply(text)): DuoState {
  const actual = duoApply(text);
  expect(actual.centers, text).toEqual(expected.centers);
  expect(actual.corners, text).toEqual(referenceTwists(expected));
  expect(canonicalStickers(actual), text).toEqual(expected);
  return actual;
}

interface ReferenceNode { state: StickerState; scramble: string; distance: number }
const stickerKey = (state: StickerState): string => JSON.stringify(state);
let referenceNodes: ReferenceNode[] | undefined;

function geometricGraph(): ReferenceNode[] {
  if (referenceNodes) return referenceNodes;
  const nodes: ReferenceNode[] = [{ state: referenceSolved(), scramble: '', distance: 0 }];
  const seen = new Set([stickerKey(nodes[0].state)]);
  for (let head = 0; head < nodes.length; head++) {
    for (const move of MOVES) {
      const state = referenceMove(nodes[head].state, move);
      const key = stickerKey(state);
      if (seen.has(key)) continue;
      seen.add(key);
      nodes.push({ state, scramble: `${nodes[head].scramble} ${move.token}`.trim(), distance: nodes[head].distance + 1 });
    }
  }
  referenceNodes = nodes;
  return nodes;
}

describe('Pyraminx Duo independent geometry', () => {
  it.each(MOVES)('$token turns its corner and the three adjacent centers in the geometric direction', move => {
    const expected = referenceApply(move.token);
    const state = expectGeometricState(move.token, expected);
    const twists = [0, 0, 0, 0];
    twists[move.corner] = move.angle < 0 ? 1 : 2;
    expect(state.corners).toEqual(twists);
    expect(state.centers[move.corner]).toBe(move.corner);
    expect(isDuoSolved(state)).toBe(false);

    const initial = solvedDuo();
    expect(applyDuoMove(initial, parseDuoMoves(move.token)[0])).toEqual(state);
    expect(initial).toEqual({ corners: [0, 0, 0, 0], centers: [0, 1, 2, 3] });
    expect(duoApply(`${move.token} ${move.token} ${move.token}`)).toEqual(initial);
  });

  it('independently reaches exactly 324 states with distance counts [1, 8, 48, 188, 79]', () => {
    const nodes = geometricGraph();
    const histogram = [0, 0, 0, 0, 0];
    for (const node of nodes) histogram[node.distance] = (histogram[node.distance] ?? 0) + 1;
    expect(nodes.length).toBe(324);
    expect(histogram).toEqual([1, 8, 48, 188, 79]);
    expect(duoGraphStats()).toEqual({ total: 324, histogram: [1, 8, 48, 188, 79] });
    expect(DUO_GODS_NUMBER).toBe(4);
    expect(DUO_LENGTH_DISTRIBUTION).toEqual([1, 8, 48, 188, 79]);
  });

  it('matches every geometric state and solves every sequence and its inverse at the exact distance', () => {
    const solved = referenceSolved();
    for (const { state, scramble, distance } of geometricGraph()) {
      const actual = expectGeometricState(scramble, state);
      expect(isDuoSolved(actual), scramble).toBe(distance === 0);

      const inverse = duoMovesToString(invertDuoMoves(parseDuoMoves(scramble)));
      expect(referenceApply(`${scramble} ${inverse}`), scramble).toEqual(solved);
      expectGeometricState(`${scramble} ${inverse}`, solved);

      const result = solvePyraminxDuo(scramble);
      expect(result.length, scramble).toBe(distance);
      expect(referenceTokens(result.solution).length, scramble).toBe(distance);
      expect(referenceApply(`${scramble} ${result.solution}`), scramble).toEqual(solved);
    }
  });

  it('preserves geometric colors during a longer mixed sequence and its reduced form', () => {
    const sequence = "U L R B U' R' L B' R U L' B R' U' U' L L B B'";
    const tokens = sequence.split(' ');
    for (let length = 1; length <= tokens.length; length++) expectGeometricState(tokens.slice(0, length).join(' '));
    const reduced = reduceDuoAlg(sequence);
    expect(referenceApply(reduced)).toEqual(referenceApply(sequence));
    const inverse = duoMovesToString(invertDuoMoves(parseDuoMoves(sequence)));
    expect(referenceApply(`${sequence} ${inverse}`)).toEqual(referenceSolved());
    expectGeometricState(`${sequence} ${inverse}`, referenceSolved());
  });
});

describe('Pyraminx Duo native random-state generation', () => {
  it('stratified RNG visits each of the 315 states at distance >= 2 exactly once', () => {
    const nodes = geometricGraph();
    const byKey = new Map(nodes.map(node => [stickerKey(node.state), node]));
    const seen = new Set<string>();
    const histogram = [0, 0, 0, 0, 0];
    for (let index = 0; index < 315; index++) {
      let calls = 0;
      const scramble = generatePyraminxDuoScramble(() => { calls++; return (index + 0.5) / 315; });
      expect(calls).toBe(1);
      const state = referenceApply(scramble);
      expectGeometricState(scramble, state);
      const key = stickerKey(state);
      const node = byKey.get(key);
      expect(node, scramble).toBeDefined();
      expect([2, 3, 4], scramble).toContain(node!.distance);
      expect(referenceTokens(scramble).length, scramble).toBe(node!.distance);
      histogram[node!.distance]++;
      seen.add(key);
    }
    expect(seen.size).toBe(315);
    expect(histogram).toEqual([0, 0, 48, 188, 79]);
    expect([...seen].sort()).toEqual(nodes.filter(node => node.distance >= 2).map(node => stickerKey(node.state)).sort());
  });

  it('accepts both RNG boundaries and rejects values outside [0, 1)', () => {
    expect(generatePyraminxDuoScramble(() => 0)).toBe(generatePyraminxDuoScramble(() => 0.5 / 315));
    expect(generatePyraminxDuoScramble(() => 1 - Number.EPSILON))
      .toBe(generatePyraminxDuoScramble(() => 314.5 / 315));
    for (const value of [-0.001, 1, Number.NaN, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY]) {
      expect(() => generatePyraminxDuoScramble(() => value)).toThrow('Pyraminx Duo RNG must return a number in [0, 1)');
    }
  });
});

describe('Pyraminx Duo strict notation', () => {
  it('accepts only the eight corner turns and preserves whitespace in token classification', () => {
    const text = " \tU U'\nL L' R R'\tB B' ";
    expect(parseDuoMoves(text)).toEqual([
      { corner: 0, dir: -1 }, { corner: 0, dir: 1 },
      { corner: 1, dir: -1 }, { corner: 1, dir: 1 },
      { corner: 2, dir: -1 }, { corner: 2, dir: 1 },
      { corner: 3, dir: -1 }, { corner: 3, dir: 1 },
    ]);
    expect(classifyDuoTokens(text).map(token => token.text).join('')).toBe(text);
    expect(classifyDuoTokens(text).every(token => !token.bad)).toBe(true);
    expectGeometricState(text, referenceSolved());
    expect(parseDuoMoves(' \t\n ')).toEqual([]);
    expect(duoApply('')).toEqual(solvedDuo());
    expect(solvePyraminxDuo('')).toEqual({ solution: '', length: 0 });
  });

  it.each(['U2', 'L2', 'R2', 'B2', 'u', "u'", 'l', "l'", 'r', "r'", 'b', "b'", 'F', 'D', 'x', 'Uw', 'U3', "U''", 'U’', 'UL', '[U,L]', '(U)'])
    ('rejects %s instead of accepting tips, cube moves, or partial tokens', token => {
      const text = `L ${token} R'`;
      expect(() => parseDuoMoves(text)).toThrow(`Invalid Pyraminx Duo move: ${token}`);
      expect(() => duoApply(text)).toThrow(`Invalid Pyraminx Duo move: ${token}`);
      expect(() => solvePyraminxDuo(text)).toThrow(`Invalid Pyraminx Duo move: ${token}`);
      expect(() => reduceDuoAlg(text)).toThrow(`Invalid Pyraminx Duo move: ${token}`);
      expect(classifyDuoTokens(text).filter(part => part.bad)).toEqual([{ text: token, bad: true }]);
    });
});
