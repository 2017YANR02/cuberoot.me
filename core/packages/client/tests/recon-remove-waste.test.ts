import { describe, expect, it } from 'vitest';
import { removeReconWaste, cleanForPlayer } from '@/lib/recon-alg-utils';
import { applyScramble, toFaceletString } from '@cuberoot/shared/timer/reconstruct/state';

describe('removeReconWaste', () => {
  it('reduces over-turns and cross-line cancellations without removing useful moves', () => {
    const scramble = "F' L' B R' B2 U L2 B2 U2 F2 D R D L F' U L B'";
    const source = "x' z' // insp\nr' F R2 r' U r D F2 // W xxcross (RB+OB)\n(U' U' U') R' U R // GO\nU' R (U R' // GR\nR U) R' U R U2' R' U // ZBLL-S+67";
    const result = removeReconWaste(source, scramble)!;
    expect(result).toContain("U R' U R // GO");
    expect(result).toContain("U' R U2 // GR\nR' U R U2' R' U // ZBLL-S+67");
    expect(toFaceletString(applyScramble(3, `${scramble} ${cleanForPlayer(result)}`)))
      .toBe(toFaceletString(applyScramble(3, `${scramble} ${cleanForPlayer(source)}`)));
    expect(result.split('\n').map(line => line.split('//')[1])).toEqual(source.split('\n').map(line => line.split('//')[1]));
  });
  it('removes whole state loops and leaves normal solutions alone', () => {
    expect(removeReconWaste("R U F F' U' R' D // end", '')).toBe('D // end');
    expect(removeReconWaste('R U F', '')).toBeNull();
    expect(removeReconWaste('(R U)2', '')).toBeNull();
    expect(removeReconWaste('[R,U]', '')).toBeNull();
  });
});
