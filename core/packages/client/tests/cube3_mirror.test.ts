import { describe, expect, it } from 'vitest';
import { Alg } from 'cubing/alg';
import { cube3x3x3 } from 'cubing/puzzles';
import { mirrorAlg, invertAlg } from '@/lib/cube3';

const kpuzzle = await cube3x3x3.kpuzzle();
const solved = kpuzzle.defaultPattern();

/**
 * Does `alg` leave every piece outside `layer` where it found it? An LL alg
 * touches only U (pieces 0..3 of each orbit); mirroring through E swaps U with
 * D, so the image is a D-layer alg — still "one layer only", just the other end.
 */
function touchesOnlyLayer(alg: string, layer: 'U' | 'D'): boolean {
  const { CORNERS, EDGES, CENTERS } = solved.applyAlg(new Alg(alg)).patternData;
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

// Chosen to exercise every family class a reflection has to flip: plain faces,
// the U/F faces the buggy version left un-negated, wide moves, and slices.
const LL_ALGS: Record<string, string> = {
  'T-perm': "R U R' U' R' F R2 U' R' U' R U R' F'",
  'Y-perm': "F R U' R' U' R U R' F' R U R' U' R' F R F'",
  'H-perm (M slice)': 'M2 U M2 U2 M2 U M2',
  'Ua-perm (M slice)': "M2 U M U2 M' U M2",
  Sune: "R U R' U R U2 R'",
  'OLL 45 (wide)': "r U R' U' r' F R F'",
  'Z-perm (M + U2)': "M' U M2 U M2 U M' U2 M2",
};

describe('mirrorAlg', () => {
  it.each(Object.entries(LL_ALGS))('mirrors %s to another single-layer alg', (_name, alg) => {
    expect(touchesOnlyLayer(alg, 'U')).toBe(true);
    // M (L↔R) and S (F↔B) keep the last layer on top; E (U↔D) flips it to the bottom.
    expect(touchesOnlyLayer(mirrorAlg(alg, 'M'), 'U')).toBe(true);
    expect(touchesOnlyLayer(mirrorAlg(alg, 'S'), 'U')).toBe(true);
    expect(touchesOnlyLayer(mirrorAlg(alg, 'E'), 'D')).toBe(true);
  });

  it('is an involution', () => {
    for (const alg of Object.values(LL_ALGS)) {
      for (const axis of ['M', 'S', 'E'] as const) {
        expect(new Alg(mirrorAlg(mirrorAlg(alg, axis), axis)).isIdentical(new Alg(alg))).toBe(true);
      }
    }
  });

  it('negates every move, not just the ones on the mirror axis', () => {
    // The pre-2026-07 bug flipped only {R,L,r,l,Rw,Lw,M,x}, leaving U/D/F/B
    // un-negated — the result was not an alg for the mirrored case at all.
    expect(mirrorAlg("R U R' U'", 'M')).toBe("L' U' L U");
    expect(mirrorAlg("F U F'", 'S')).toBe("B' U' B");
    expect(mirrorAlg("R U R'", 'E')).toBe("R' D' R");
  });

  it('flips slice and rotation moves too', () => {
    expect(mirrorAlg('M', 'M')).toBe("M'");
    expect(mirrorAlg('x', 'M')).toBe("x'");
    expect(mirrorAlg('y', 'M')).toBe("y'");
  });

  it('mirror commutes with invert', () => {
    for (const alg of Object.values(LL_ALGS)) {
      expect(new Alg(mirrorAlg(invertAlg(alg), 'M'))
        .isIdentical(new Alg(invertAlg(mirrorAlg(alg, 'M'))))).toBe(true);
    }
  });

  it('returns the input unchanged when it cannot be parsed', () => {
    expect(mirrorAlg('R (U', 'M')).toBe('R (U');
    expect(mirrorAlg('', 'M')).toBe('');
  });
});
