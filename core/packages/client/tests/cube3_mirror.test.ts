import { describe, expect, it } from 'vitest';
import { Alg } from 'cubing/alg';
import { cube3x3x3 } from 'cubing/puzzles';
import { mirrorAlg, invertAlg } from '@/lib/cube3';

const kpuzzle = await cube3x3x3.kpuzzle();
const solved = kpuzzle.defaultPattern();

const state = (alg: string) => solved.applyAlg(new Alg(alg));
const sameState = (a: string, b: string) => state(a).isIdentical(state(b));

/**
 * Does `alg` leave every piece outside `layer` where it found it? An LL alg
 * touches only U (pieces 0..3 of each orbit); mirroring through E swaps U with
 * D, so the image is a D-layer alg — still "one layer only", just the other end.
 */
function touchesOnlyLayer(alg: string, layer: 'U' | 'D'): boolean {
  const { CORNERS, EDGES, CENTERS } = state(alg).patternData;
  const cornerRange = layer === 'U' ? [4, 8] : [0, 4];
  const edgeRange = layer === 'U' ? [4, 12] : [0, 4];
  for (let i = cornerRange[0]; i < cornerRange[1]; i++) {
    if (CORNERS.pieces[i] !== i || CORNERS.orientation[i] !== 0) return false;
  }
  for (let i = edgeRange[0]; i < edgeRange[1]; i++) {
    if (EDGES.pieces[i] !== i || EDGES.orientation[i] !== 0) return false;
  }
  // D-layer algs still leave the 4 side edges alone; only the E-slice ones move.
  if (layer === 'D') for (let i = 8; i < 12; i++) if (EDGES.pieces[i] !== i) return false;
  for (let i = 0; i < 6; i++) if (CENTERS.pieces[i] !== i) return false;
  return true;
}

// Chosen to exercise every family a reflection has to decide about: plain faces,
// wide moves, all three slices, and rotations. The M/S/E-slice entries are the
// ones that used to come out as garbage.
const LL_ALGS: Record<string, string> = {
  'T-perm': "R U R' U' R' F R2 U' R' U' R U R' F'",
  'Y-perm': "F R U' R' U' R U R' F' R U R' U' R' F R F'",
  'H-perm (M slice)': 'M2 U M2 U2 M2 U M2',
  'Ua-perm (M slice)': "M2 U M U2 M' U M2",
  Sune: "R U R' U R U2 R'",
  'OLL 45 (wide)': "r U R' U' r' F R F'",
  'Z-perm (M + U2)': "M' U M2 U M2 U M' U2 M2",
  'Aa-perm (x rotation)': "x R' U R' D2 R U' R' D2 R2 x'",
  'OLL 2 (S slice)': "F R U R' U' S R U R' U' f'",
};

/**
 * cubing.js's own move algebra. These are the ONLY premise the mirror rule rests
 * on — everything else is forced from them, so assert them rather than assume.
 */
const DECOMPOSITIONS: [string, string][] = [
  ['r', "R M'"], ['l', 'L M'],
  ['u', "U E'"], ['d', 'D E'],
  ['f', 'F S'], ['b', "B S'"],
  ['x', "R M' L'"], ['y', "U E' D'"], ['z', "F S B'"],
];

const AXES = ['M', 'S', 'E'] as const;

describe('mirrorAlg', () => {
  it.each(DECOMPOSITIONS)('cubing.js writes %s as %s', (compound, parts) => {
    expect(sameState(compound, parts)).toBe(true);
  });

  /**
   * The load-bearing test. A reflection is a group automorphism, so it must commute
   * with these decompositions: mirroring `r` and mirroring `R M'` have to land on the
   * same transformation. That single requirement pins what the mirror does to M/S/E
   * and x/y/z — there is no freedom left.
   *
   * It is also what the old "negate every move" rule failed: it broke 3 of these 9
   * on every axis, and with them 590 of the 7771 stored last-layer algs under M.
   */
  it.each(AXES)('%s: mirroring a compound move == mirroring its decomposition', (axis) => {
    for (const [compound, parts] of DECOMPOSITIONS) {
      expect(
        sameState(mirrorAlg(compound, axis), mirrorAlg(parts, axis)),
        `mirror(${compound}) = ${mirrorAlg(compound, axis)} but mirror(${parts}) = ${mirrorAlg(parts, axis)}`,
      ).toBe(true);
    }
  });

  it.each(Object.entries(LL_ALGS))('mirrors %s to another single-layer alg', (_name, alg) => {
    expect(touchesOnlyLayer(alg, 'U')).toBe(true);
    // M (L↔R) and S (F↔B) keep the last layer on top; E (U↔D) flips it to the bottom.
    expect(touchesOnlyLayer(mirrorAlg(alg, 'M'), 'U')).toBe(true);
    expect(touchesOnlyLayer(mirrorAlg(alg, 'S'), 'U')).toBe(true);
    expect(touchesOnlyLayer(mirrorAlg(alg, 'E'), 'D')).toBe(true);
  });

  it('is an involution', () => {
    for (const alg of Object.values(LL_ALGS)) {
      for (const axis of AXES) {
        expect(sameState(mirrorAlg(mirrorAlg(alg, axis), axis), alg)).toBe(true);
      }
    }
  });

  // Ua and Ub are each other's L↔R mirror — that is what the letters mean. An
  // end-to-end check against knowledge from outside this file.
  it('sends Ua-perm to Ub-perm', () => {
    const ua = "M2 U M U2 M' U M2";
    const ub = "M2 U' M U2 M' U' M2";
    expect(sameState(mirrorAlg(ua, 'M'), ub)).toBe(true);
    expect(sameState(mirrorAlg(ub, 'M'), ua)).toBe(true);
  });

  it('negates the faces, and the slice/rotation off the mirror axis', () => {
    expect(mirrorAlg("R U R' U'", 'M')).toBe("L' U' L U");
    expect(mirrorAlg("F U F'", 'S')).toBe("B' U' B");
    expect(mirrorAlg("R U R'", 'E')).toBe("R' D' R");
    expect(mirrorAlg('y', 'M')).toBe("y'");   // y is off the M axis
    expect(mirrorAlg('E', 'M')).toBe("E'");
  });

  /**
   * M follows L and x follows R — the two families the M mirror swaps. Flipping
   * their reference direction cancels flipping the move, so they come through
   * unchanged. Same story for S/z under S, and E/y under E.
   */
  it('leaves the slice and rotation ON the mirror axis alone', () => {
    expect(mirrorAlg('M', 'M')).toBe('M');
    expect(mirrorAlg('x', 'M')).toBe('x');
    expect(mirrorAlg('S', 'S')).toBe('S');
    expect(mirrorAlg('z', 'S')).toBe('z');
    expect(mirrorAlg('E', 'E')).toBe('E');
    expect(mirrorAlg('y', 'E')).toBe('y');
  });

  it('mirror commutes with invert', () => {
    for (const alg of Object.values(LL_ALGS)) {
      expect(sameState(mirrorAlg(invertAlg(alg), 'M'), invertAlg(mirrorAlg(alg, 'M')))).toBe(true);
    }
  });

  /**
   * `R4` is the identity as a group element but a real physical action — a full
   * revolution of the R layer, which costs time and drives the hand animation.
   * The 1LLL sheet writes it on purpose. Mirroring must hand it back, not eat it.
   */
  it('preserves whole-revolution moves', () => {
    expect(mirrorAlg('R4', 'M')).toBe("L4'");
    expect(mirrorAlg("L4'", 'M')).toBe('R4');
    expect(mirrorAlg("R U R4 U'", 'M')).toBe("L' U' L4' U");
    expect(mirrorAlg('R3', 'M')).toBe("L3'");
  });

  /**
   * `new Move(family, amount)` throws the layer prefix away, so `2R` came out as
   * `L'` and `3Rw` as `Lw'` — a different move on a different layer. /sim's mirror
   * buttons are live on 4x4 and 5x5, so this was reachable.
   */
  it('keeps the layer prefix on NxN moves', () => {
    expect(mirrorAlg('2R', 'M')).toBe("2L'");
    expect(mirrorAlg('3Rw', 'M')).toBe("3Lw'");
    expect(mirrorAlg("3Rw2'", 'M')).toBe('3Lw2');
    expect(mirrorAlg('2-3r', 'M')).toBe("2-3l'");
    expect(mirrorAlg('3Uw', 'E')).toBe("3Dw'");
  });

  it('returns the input unchanged when it cannot be parsed', () => {
    expect(mirrorAlg('R (U', 'M')).toBe('R (U');
    expect(mirrorAlg('', 'M')).toBe('');
  });
});
