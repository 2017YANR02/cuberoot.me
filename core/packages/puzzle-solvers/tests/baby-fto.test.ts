import { beforeAll, describe, expect, it } from 'vitest';
import { Move } from 'cubing/alg';
import { puzzles } from 'cubing/puzzles';
import type { KPattern, KPuzzle } from 'cubing/kpuzzle';
import {
  BABY_FTO_FACE_NAMES, BABY_FTO_GODS_NUMBER, BABY_FTO_LENGTH_DISTRIBUTION,
  BABY_FTO_TOTAL_STATES, babyFtoAllScramblesByLength, babyFtoApply,
  babyFtoExamplesByLength, babyFtoGraphStats, classifyBabyFtoTokens,
  parseBabyFtoMoves, solveBabyFto, solveBabyFtoState, solvedBabyFto,
} from '../src/baby-fto';

const CANONICAL = ['U', "U'", 'F', "F'", 'BR', "BR'", 'BL', "BL'"];
const ALL_MOVES = BABY_FTO_FACE_NAMES.flatMap(face => [face, `${face}'`]);
let model: KPuzzle;
let rotations: KPattern[];

function fromPattern(pattern: KPattern) {
  return {
    centers: [...pattern.patternData.CENTERS.pieces],
    corners: [...pattern.patternData.C4RNER.pieces],
    orientation: [...pattern.patternData.C4RNER.orientation],
  };
}
function patternKey(pattern: KPattern): string { return JSON.stringify(fromPattern(pattern)); }
beforeAll(async () => {
  model = await puzzles.baby_fto.kpuzzle();
  rotations = [model.defaultPattern()];
  const seen = new Set([patternKey(rotations[0])]);
  for (let head = 0; head < rotations.length; head++) for (const move of ['Fv', 'D_BR_R_Fv']) {
    const next = rotations[head].applyMove(move), key = patternKey(next);
    if (!seen.has(key)) { seen.add(key); rotations.push(next); }
    if (rotations.length > 24) throw new Error('Independent rotation oracle exceeded 24 frames');
  }
});

/** Independent, full piece model: fourteen labelled bytes, with transitions
 * taken directly from cubing's named loader. No production coordinates/maps. */
function referenceGraph(): { distance: Map<string, number>; apply: (alg: string) => string } {
  const transforms = new Map(ALL_MOVES.map(token => [token, model.moveToTransformation(token).transformationData]));
  const initial = String.fromCharCode(...[0, 1, 2, 3, 4, 5, 6, 7], ...[0, 4, 8, 12, 16, 20]);
  const step = (state: string, token: string) => {
    const move = transforms.get(token)!;
    const next: number[] = [];
    for (let i = 0; i < 8; i++) next.push(state.charCodeAt(move.CENTERS.permutation[i]));
    for (let i = 0; i < 6; i++) {
      const piece = state.charCodeAt(8 + move.C4RNER.permutation[i]);
      next.push(Math.floor(piece / 4) * 4 + (piece % 4 + move.C4RNER.orientationDelta[i]) % 4);
    }
    return String.fromCharCode(...next);
  };
  const distance = new Map([[initial, 0]]), queue = [initial];
  for (let head = 0; head < queue.length; head++) for (const token of CANONICAL) {
    const next = step(queue[head], token);
    if (distance.has(next)) continue;
    if (queue.length >= 140_000) throw new Error('Independent BFS exceeded its state budget');
    distance.set(next, distance.get(queue[head])! + 1); queue.push(next);
  }
  return { distance, apply: alg => alg.trim().split(/\s+/).filter(Boolean).reduce(step, initial) };
}

describe('Baby FTO exact solver', () => {
  it('matches the named model for all face turns and rejects invalid notation without dropping tokens', () => {
    for (const face of BABY_FTO_FACE_NAMES) for (const suffix of ['', "'", '2']) {
      expect(babyFtoApply(face + suffix)).toEqual(fromPattern(model.defaultPattern().applyAlg(face + suffix)));
    }
    expect(parseBabyFtoMoves("BR2 U' BL")).toEqual(["BR'", "U'", 'BL']);
    expect(classifyBabyFtoTokens('BR2  X U3').filter(token => token.bad).map(token => token.text)).toEqual(['X', 'U3']);
    for (const invalid of ['X', 'u', 'Uw', 'BB', 'U3', 'R100000000', '(U R)2', 'U bad R']) {
      expect(() => babyFtoApply(invalid)).toThrow();
    }
    expect(() => babyFtoApply('U '.repeat(8193))).toThrow(/Too many/);
    expect(() => babyFtoApply(' '.repeat(65537))).toThrow(/too long/);
  });

  it('proves the full eight-face quotient uses exactly the canonical eight directed edges', () => {
    expect(rotations).toHaveLength(24);
    const identity = model.identityTransformation();
    const sameVisibleTransform = (a: ReturnType<KPuzzle['identityTransformation']>, b: ReturnType<KPuzzle['identityTransformation']>) =>
      JSON.stringify(a.transformationData.C4RNER) === JSON.stringify(b.transformationData.C4RNER)
      && a.transformationData.CENTERS.permutation.join() === b.transformationData.CENTERS.permutation.join();
    const rigid = rotations.map(pattern => pattern.experimentalToTransformation()!);
    const canonical = CANONICAL.map(token => model.moveToTransformation(token));
    const fixed = [0, 1, 2, 7];
    const usedFrames = new Set<string>();
    for (const token of ALL_MOVES) {
      const move = model.moveToTransformation(token);
      const matches = rigid.map(rotation => move.applyTransformation(rotation))
        .filter(normalized => fixed.every(slot => normalized.transformationData.CENTERS.permutation[slot] === slot));
      expect(matches, token).toHaveLength(1);
      expect(canonical.some(candidate => sameVisibleTransform(matches[0], candidate)), token).toBe(true);
    }
    // Face turns have even corner permutations: only 12 of the 24 rigid frames
    // themselves belong to the face-turn group. The other 12 are legal changes
    // of viewpoint, accepted by the state API but never generated as scrambles.
    for (const rotation of rigid) {
      const p = rotation.transformationData.C4RNER.permutation;
      let parity = 0;
      for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) if (p[i] > p[j]) parity ^= 1;
      if (parity === 0) usedFrames.add(JSON.stringify(rotation.transformationData.CENTERS.permutation));
    }
    expect(usedFrames.size).toBe(12);
    expect(sameVisibleTransform(identity, identity)).toBe(true);
  });

  it('independently enumerates all states and checks every exported shortest scramble', async () => {
    const oracle = referenceGraph();
    const histogram: number[] = [];
    for (const depth of oracle.distance.values()) histogram[depth] = (histogram[depth] ?? 0) + 1;
    expect(oracle.distance.size).toBe(BABY_FTO_TOTAL_STATES);
    expect(histogram).toEqual(BABY_FTO_LENGTH_DISTRIBUTION);
    expect(histogram.length - 1).toBe(BABY_FTO_GODS_NUMBER);
    const all = await babyFtoAllScramblesByLength();
    const seen = new Set<string>();
    for (const [depth, scrambles] of Object.entries(all)) {
      expect(scrambles.length).toBe(histogram[Number(depth)]);
      for (const scramble of scrambles) {
        const state = oracle.apply(scramble);
        expect(oracle.distance.get(state)).toBe(Number(depth));
        expect(seen.has(state)).toBe(false); seen.add(state);
      }
    }
    expect(seen.size).toBe(BABY_FTO_TOTAL_STATES);
    expect(all[0]).toEqual(['']);
    const stats = await babyFtoGraphStats();
    expect(stats.histogram).toEqual(histogram);
    expect(stats.typedArrayBytes).toBe(461408);
  }, 30000);

  it('solves arbitrary eight-face inputs, state-only inputs, and all external viewing frames', async () => {
    let seed = 0x33557799;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const solvedKeys = new Set(rotations.map(patternKey));
    expect(await solveBabyFto('')).toEqual({ solution: '', length: 0 });
    for (const token of ALL_MOVES) expect((await solveBabyFto(token)).length).toBe(1);
    for (let sample = 0; sample < 300; sample++) {
      const scramble = Array.from({ length: 50 }, () => ALL_MOVES[Math.floor(random() * ALL_MOVES.length)]).join(' ');
      const input = model.defaultPattern().applyAlg(scramble);
      expect(babyFtoApply(scramble)).toEqual(fromPattern(input));
      const result = await solveBabyFto(scramble);
      expect(result.length).toBeLessThanOrEqual(10);
      expect(result.solution.split(/\s+/).filter(Boolean)).toHaveLength(result.length);
      expect(solvedKeys.has(patternKey(input.applyAlg(result.solution)))).toBe(true);
      expect(await solveBabyFtoState(fromPattern(input))).toEqual(result);
      if (sample < 10) for (const rotation of rotations) {
        const rotated = input.applyTransformation(rotation.experimentalToTransformation()!);
        const answer = await solveBabyFtoState(fromPattern(rotated));
        expect(answer.length).toBe(result.length);
        expect(solvedKeys.has(patternKey(rotated.applyAlg(answer.solution)))).toBe(true);
      }
    }
    for (const rotation of rotations) expect((await solveBabyFtoState(fromPattern(rotation))).length).toBe(0);
    const invalid = solvedBabyFto(); invalid.orientation[0] = 1;
    await expect(solveBabyFtoState(invalid)).rejects.toThrow(/Unreachable/);
    const duplicate = solvedBabyFto(); duplicate.centers[0] = 1;
    await expect(solveBabyFtoState(duplicate)).rejects.toThrow(/Invalid/);
    const sparse = solvedBabyFto(); sparse.orientation = new Array<number>(6);
    await expect(solveBabyFtoState(sparse)).rejects.toThrow(/Invalid/);
    const missingCenter = solvedBabyFto(); delete missingCenter.centers[0];
    await expect(solveBabyFtoState(missingCenter)).rejects.toThrow(/Invalid/);
    const odd = solvedBabyFto(); [odd.centers[3], odd.centers[4]] = [odd.centers[4], odd.centers[3]];
    await expect(solveBabyFtoState(odd)).rejects.toThrow(/Unreachable/);
  });

  it('returns bounded representatives for every exact depth, including solved and all antipodes', async () => {
    const examples = await babyFtoExamplesByLength(20);
    expect(Object.keys(examples).map(Number)).toEqual(BABY_FTO_LENGTH_DISTRIBUTION.map((_, index) => index));
    expect(examples[10]).toHaveLength(15);
    for (const [depth, scrambles] of Object.entries(examples)) for (const scramble of scrambles) {
      const result = await solveBabyFto(scramble);
      expect(result.length).toBe(Number(depth));
      // Canonical examples fix the reference centres, hence restore the exact
      // default frame rather than just an arbitrary uniformly coloured frame.
      expect(patternKey(model.defaultPattern().applyAlg(`${scramble} ${result.solution}`))).toBe(patternKey(model.defaultPattern()));
    }
    expect(await babyFtoExamplesByLength(0)).toEqual({});
    await expect(babyFtoExamplesByLength(-1)).rejects.toThrow();
  });
});

type Vec = [number, number, number];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const centroid = (coords: number[]): Vec => {
  const point: Vec = [0, 0, 0];
  for (let i = 0; i < coords.length; i++) point[i % 3] += coords[i] * 3 / coords.length;
  return point;
};
const rotate = (point: Vec, axis: Vec, angle: number): Vec => {
  const c = Math.cos(angle), s = Math.sin(angle), d = dot(point, axis) * (1 - c);
  const cross: Vec = [axis[1] * point[2] - axis[2] * point[1], axis[2] * point[0] - axis[0] * point[2], axis[0] * point[1] - axis[1] * point[0]];
  return point.map((value, i) => value * c + cross[i] * s + axis[i] * d) as Vec;
};

it('replays returned solutions with independent physical sticker rotations', async () => {
  const geometry = (await puzzles.baby_fto.pg!()).get3d();
  const stickers = geometry.stickers.filter(sticker => !sticker.isDup);
  const centers = stickers.map(sticker => centroid(sticker.coords));
  const pieces = new Map<string, Vec>();
  for (const sticker of stickers) {
    const key = `${sticker.orbit}/${sticker.ord}`;
    const group = stickers.filter(candidate => candidate.orbit === sticker.orbit && candidate.ord === sticker.ord);
    pieces.set(key, centroid(group.flatMap(candidate => candidate.coords)));
  }
  const permutations = new Map<string, number[]>();
  for (const face of BABY_FTO_FACE_NAMES) {
    const entry = geometry.axis.find(axis => geometry.notationMapper.notationToExternal(new Move(axis.quantumMove.toString()))?.family === face)!;
    const magnitude = Math.hypot(...entry.coordinates);
    const axis = entry.coordinates.map(value => value / magnitude) as Vec;
    for (const [suffix, angle] of [['', -2 * Math.PI / 3], ["'", 2 * Math.PI / 3]] as const) {
      const perm = stickers.map((sticker, source) => {
        if (dot(pieces.get(`${sticker.orbit}/${sticker.ord}`)!, axis) < 0) return source;
        const rotated = rotate(centers[source], axis, angle);
        const target = centers.findIndex(point => point.every((value, i) => Math.abs(value - rotated[i]) < 1e-6));
        if (target < 0) throw new Error(`Geometric sticker match failed: ${face}${suffix}/${source}`);
        return target;
      });
      expect(new Set(perm).size).toBe(32); permutations.set(face + suffix, perm);
    }
  }
  const geometricApply = (scramble: string) => {
    let colours = stickers.map(sticker => sticker.face);
    for (const token of scramble.trim().split(/\s+/).filter(Boolean)) {
      const next = colours.slice();
      permutations.get(token)!.forEach((target, source) => { next[target] = colours[source]; });
      colours = next;
    }
    return colours;
  };
  const namedColours = (scramble: string) => {
    const pattern = model.defaultPattern().applyAlg(scramble).patternData;
    return stickers.map(sticker => {
      const orbit = pattern[sticker.orbit];
      const orientation = sticker.orbit === 'CENTERS' ? 0 : (sticker.ori - orbit.orientation[sticker.ord] + 4) % 4;
      return stickers.find(home => home.orbit === sticker.orbit && home.ord === orbit.pieces[sticker.ord] && home.ori === orientation)!.face;
    });
  };
  for (const token of ALL_MOVES) expect(geometricApply(token), token).toEqual(namedColours(token));
  let seed = 0x0babe123;
  for (let sample = 0; sample < 48; sample++) {
    const scramble = Array.from({ length: 31 }, () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return ALL_MOVES[seed >>> 28];
    }).join(' ');
    expect(geometricApply(scramble)).toEqual(namedColours(scramble));
    const { solution } = await solveBabyFto(scramble);
    const colours = geometricApply(`${scramble} ${solution}`);
    for (let face = 0; face < 8; face++) expect(new Set(stickers.map((sticker, index) => sticker.face === face ? colours[index] : -1).filter(value => value >= 0)).size).toBe(1);
  }
});
