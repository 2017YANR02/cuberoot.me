import { describe, expect, it } from 'vitest';

import * as canonical from '@cuberoot/puzzle-solvers/timer-333-step';
import * as legacy from '@/app/[lang]/timer/_lib/solver/methods';
import * as canonicalCube from '@cuberoot/puzzle-solvers/timer-333-cube';
import * as legacyCube from '@/app/[lang]/timer/_lib/solver/cube3x3';

describe('Timer 3x3 solver Web migration', () => {
  it('keeps old Web imports as identity re-exports of the canonical engine', () => {
    expect(legacy.METHOD_REGISTRY).toBe(canonical.METHOD_REGISTRY);
    expect(legacy.CFOP_METHOD).toBe(canonical.CFOP_METHOD);
    expect(legacy.solveByMethodId).toBe(canonical.solveByMethodId);
    expect(legacy.solveMethodFrom).toBe(canonical.solveMethodFrom);
    expect(legacy.solveF2lTo).toBe(canonical.solveF2lTo);
    expect(legacyCube.cubeMove).toBe(canonicalCube.cubeMove);
    expect(legacyCube.faceTurnToken).toBe(canonicalCube.faceTurnToken);
  });

  it('returns exactly the same six outcomes through compatibility and public paths', () => {
    const scramble = "R U R' U'";
    for (const method of canonical.METHOD_REGISTRY) {
      expect(legacy.solveByMethodId(scramble, method.id)).toEqual(
        canonical.solveByMethodId(scramble, method.id),
      );
    }
  });
});
