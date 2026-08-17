import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AlgCase } from '@cuberoot/shared';
import type { KPattern } from 'cubing/kpuzzle';
import { cube3x3x3 } from 'cubing/puzzles';

import {
  generateScramble,
  replaceOuterDAdjustment,
  trainerSetScrambleFeatures,
} from '@/lib/trainer-scramble';
import { normalizeScramble } from '@/lib/cross-solver';
import {
  buildPsf2lExtraSuffixPool,
  preparePsf2lExtraScrambles,
} from '@/lib/psf2l-extra-scramble';

const PSF2L_CASE: AlgCase = {
  name: 'PSF2L 01',
  subgroup: '',
  setup: "D R U R' D'",
  sticker: { kind: 'f2l', fl: '' },
  algs: [[{ alg: "D R U' R' D'" }]],
};

const REAL_PSF2L_CASE: AlgCase = {
  ...PSF2L_CASE,
  setup: "D R U R' U' D'",
};

const ROTATED_PSF2L_CASE: AlgCase = {
  ...PSF2L_CASE,
  name: 'PSF2L A-',
  setup: "D L' U' L d D'",
};

// Canonical F2L A+ setup. A single case is enough to exercise both legal
// enhanced outcomes; production prepares candidates from all 41 cases.
const BASE_F2L_CASE: AlgCase = {
  name: 'A+',
  subgroup: '',
  setup: "F R' F' R",
  sticker: { kind: 'f2l', fl: '' },
  algs: [[{ alg: "R' F R F'" }]],
};

const F2L_SLOTS = [
  { id: 'FR', corner: 4, edge: 8 },
  { id: 'FL', corner: 5, edge: 9 },
  { id: 'BL', corner: 6, edge: 11 },
  { id: 'BR', corner: 7, edge: 10 },
] as const;
const CROSS_EDGES = [4, 5, 6, 7] as const;
type Orbit = { pieces: number[]; orientation?: number[] };

const home = (orbit: Orbit, piece: number): boolean => (
  orbit.pieces[piece] === piece && (orbit.orientation?.[piece] ?? 0) === 0
);

const fingerprint = (orbit: Orbit, piece: number): string => {
  const slot = orbit.pieces.indexOf(piece);
  return `${slot}.${slot >= 0 ? (orbit.orientation?.[slot] ?? 0) : -1}`;
};

const f2lStatus = (pattern: KPattern) => {
  const corners = pattern.patternData.CORNERS as Orbit;
  const edges = pattern.patternData.EDGES as Orbit;
  return F2L_SLOTS.map(slot => ({
    ...slot,
    cornerHome: home(corners, slot.corner),
    edgeHome: home(edges, slot.edge),
  }));
};

afterEach(() => { vi.restoreAllMocks(); });

describe('PSF2L trainer D adjustment', () => {
  it('is declared only by the PSF2L set', () => {
    expect(trainerSetScrambleFeatures('3x3', 'psf2l')).toEqual({
      randomInitialD: true,
      psf2lExtraScramble: true,
      randomFinalAuf: false,
      f2lSlots: false,
    });
    expect(trainerSetScrambleFeatures('2x2', 'psf2l').randomInitialD).toBe(false);
  });

  it.each([
    ['D', "D R U R' D'"],
    ['D2', "D2 R U R' D2"],
    ["D'", "D' R U R' D"],
  ])('replaces both ends with the inverse pair for %s', (adjustment, expected) => {
    expect(replaceOuterDAdjustment(PSF2L_CASE.setup, adjustment)).toBe(expected);
  });

  it('leaves malformed or non-PSF2L setups untouched', () => {
    expect(replaceOuterDAdjustment('', 'D2')).toBe('');
    expect(replaceOuterDAdjustment("R U R'", 'D2')).toBe("R U R'");
    expect(replaceOuterDAdjustment("D R U R' D", 'D2')).toBe("D R U R' D");
    expect(replaceOuterDAdjustment(PSF2L_CASE.setup, 'U')).toBe(PSF2L_CASE.setup);
  });

  it('draws D, D2 and D-prime without adding an unadjusted fourth state', () => {
    const random = vi.spyOn(Math, 'random');
    random.mockReturnValueOnce(0);
    expect(generateScramble(PSF2L_CASE, '3x3', 'inv', { randomInitialD: true }))
      .toBe("D R U R' D'");

    random.mockReturnValueOnce(0.34);
    expect(generateScramble(PSF2L_CASE, '3x3', 'inv', { randomInitialD: true }))
      .toBe("D2 R U R' D2");

    random.mockReturnValueOnce(0.99);
    expect(generateScramble(PSF2L_CASE, '3x3', 'inv', { randomInitialD: true }))
      .toBe("D' R U R' D");
  });

  it('keeps the document setup exact when the switch is off', () => {
    expect(generateScramble(PSF2L_CASE, '3x3', 'inv', { randomInitialD: false }))
      .toBe(PSF2L_CASE.setup);
  });

  it('rewrites lowercase wide turns and rotations to fixed-frame face turns', () => {
    expect(normalizeScramble(ROTATED_PSF2L_CASE.setup))
      .toBe("D L' U' L U D'");
    expect(generateScramble(ROTATED_PSF2L_CASE, '3x3', 'inv', {
      randomInitialD: false,
      psf2lFaceTurnsOnly: true,
    })).toBe("D L' U' L U D'");
  });

  it('keeps the exact XXCross and target pair in every generated suffix', async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const orientationAlgs = [
      '', 'y', 'y2', "y'", 'x', 'x y', 'x y2', "x y'",
      'x2', 'x2 y', 'x2 y2', "x2 y'", "x'", "x' y", "x' y2", "x' y'",
      'z', 'z y', 'z y2', "z y'", "z'", "z' y", "z' y2", "z' y'",
    ];
    const orientationTransforms = orientationAlgs.map(alg => (
      alg ? kpuzzle.algToTransformation(alg) : kpuzzle.identityTransformation()
    ));
    const normalize = (pattern: KPattern): KPattern => {
      for (const transform of orientationTransforms) {
        const rotated = pattern.applyTransformation(transform);
        if (rotated.patternData.CENTERS.pieces.join(',') === '0,1,2,3,4,5') return rotated;
      }
      throw new Error('Could not normalize cube centers');
    };

    const bases = [REAL_PSF2L_CASE, ROTATED_PSF2L_CASE].flatMap(c => (
      [...new Set([
        c.setup,
        ...['D', 'D2', "D'"].map(d => replaceOuterDAdjustment(c.setup, d)),
      ])]
    ));

    for (const base of bases) {
      const basePattern = normalize(kpuzzle.defaultPattern().applyAlg(base));
      const baseCorners = basePattern.patternData.CORNERS as Orbit;
      const baseEdges = basePattern.patternData.EDGES as Orbit;
      const baseStatus = f2lStatus(basePattern);
      const fullIds = baseStatus
        .filter(slot => slot.cornerHome && slot.edgeHome)
        .map(slot => slot.id);
      const cornerOnly = baseStatus.find(slot => slot.cornerHome && !slot.edgeHome);
      const edgeOnly = baseStatus.find(slot => !slot.cornerHome && slot.edgeHome);
      expect(fullIds).toHaveLength(2);
      expect(cornerOnly).toBeDefined();
      expect(edgeOnly).toBeDefined();

      const targetCorner = edgeOnly!.corner;
      const targetEdge = cornerOnly!.edge;
      const pool = await buildPsf2lExtraSuffixPool(base, [BASE_F2L_CASE]);
      expect(pool.corner.length).toBeGreaterThan(0);
      expect(pool.edge.length).toBeGreaterThan(0);

      for (const [expectedPartial, suffixes] of Object.entries(pool)) {
        for (const suffix of suffixes) {
          const pattern = normalize(kpuzzle.defaultPattern().applyAlg(`${base} ${suffix}`));
          const corners = pattern.patternData.CORNERS as Orbit;
          const edges = pattern.patternData.EDGES as Orbit;
          expect(CROSS_EDGES.every(piece => home(edges, piece))).toBe(true);
          expect(fingerprint(corners, targetCorner)).toBe(fingerprint(baseCorners, targetCorner));
          expect(fingerprint(edges, targetEdge)).toBe(fingerprint(baseEdges, targetEdge));

          const status = f2lStatus(pattern);
          expect(status.filter(slot => slot.cornerHome && slot.edgeHome).map(slot => slot.id))
            .toEqual(fullIds);
          const remaining = status.filter(slot => !fullIds.includes(slot.id));
          expect(remaining.filter(slot => slot.cornerHome !== slot.edgeHome)).toHaveLength(1);
          expect(remaining.filter(slot => !slot.cornerHome && !slot.edgeHome)).toHaveLength(1);
          const partial = remaining.find(slot => slot.cornerHome !== slot.edgeHome)!;
          expect(partial.cornerHome ? 'corner' : 'edge').toBe(expectedPartial);
        }
      }
    }
  });

  it('uses a prepared legal candidate only when the enhanced switch is on', async () => {
    await preparePsf2lExtraScrambles(
      [REAL_PSF2L_CASE],
      [BASE_F2L_CASE],
      replaceOuterDAdjustment,
    );
    vi.spyOn(Math, 'random').mockReturnValue(0);

    expect(generateScramble(REAL_PSF2L_CASE, '3x3', 'inv', {
      randomInitialD: false,
      psf2lExtraScramble: false,
    })).toBe(REAL_PSF2L_CASE.setup);
    expect(generateScramble(REAL_PSF2L_CASE, '3x3', 'inv', {
      randomInitialD: false,
      psf2lExtraScramble: true,
      psf2lFaceTurnsOnly: true,
    })).toMatch(/^(?:[URFDLB](?:2|')?)(?: [URFDLB](?:2|')?)*$/);
  });
});
