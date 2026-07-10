import { describe, it, expect } from 'vitest';
import { cleanForPlayer, countMovesExpanded, expandGroupRepeats } from '@/lib/recon-alg-utils';

// Regression: `(R' F R F')2 // OG` only animated one iteration in the cuber
// engine — CuberReconPlayer tokenizes cleanForPlayer output on whitespace, so
// the un-expanded `(R' F R F')2` split into `["(R'","F","R","F')2"]` and the
// repeat count `2` was silently dropped. cleanForPlayer must expand `(...)N`
// into literal moves so every whitespace token is a single valid move.
describe('group-repeat expansion', () => {
  it('expandGroupRepeats unrolls `(...)N`', () => {
    expect(expandGroupRepeats("(R' F R F')2")).toBe("R' F R F' R' F R F'");
    expect(expandGroupRepeats('(R U R\')3')).toBe("R U R' R U R' R U R'");
    expect(expandGroupRepeats('R U R2')).toBe('R U R2'); // trailing digit ≠ group
  });

  it('cleanForPlayer expands the group into 8 whitespace tokens', () => {
    const out = cleanForPlayer("(R' F R F')2 // OG");
    expect(out.trim().split(/\s+/)).toEqual(["R'", 'F', 'R', "F'", "R'", 'F', 'R', "F'"]);
  });

  it('cleanForPlayer spaces out a glued repeated group', () => {
    expect(cleanForPlayer("(RUR')2")).toBe("R U R' R U R'");
  });

  it('countMovesExpanded counts the repeated group', () => {
    expect(countMovesExpanded("(R' F R F')2")).toBe(8);
    expect(countMovesExpanded("L' U L (R' F R F')2")).toBe(11);
  });

  it('full solution: OG group counts twice (recon 2415 regression)', () => {
    const solution = `z2 // insp
D' L R D R' U D // W cross
L' U L // RG
(R' F R F')2 // OG
y (R R') R U R2' U' // BR cancel into
F R F' U2' R U R' // BO
U2' R U R' U' R' F R F' // OLL(CP)-T2
M2' U2 M2' U M2' U2 M2' // EPLL-H`;
    // 1 + 7 + 3 + 8 + 7 + 7 + 9 + 7 = 49 (OG expanded to 8, not 4)
    expect(cleanForPlayer(solution).trim().split(/\s+/).filter(Boolean)).toHaveLength(49);
  });
});
