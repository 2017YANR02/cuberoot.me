import { describe, expect, it } from 'vitest';
import {
  checkReconCompletion,
  cleanReconCubeStateMoves,
} from '@cuberoot/shared/recon-completion';
import { hasUnsolvedReason } from '../../server/src/utils/recon_completion';

describe('reconstruction completion validation', () => {
  it('accepts a compact scramble followed by its solution', async () => {
    await expect(checkReconCompletion({
      event: '3x3',
      scramble: "RUR'",
      solution: "R U' R'",
    })).resolves.toEqual({ status: 'solved' });
  });

  it('treats a solved cube in another whole-cube orientation as solved', async () => {
    await expect(checkReconCompletion({
      event: '6x6',
      scramble: 'R',
      solution: "R' x",
    })).resolves.toEqual({ status: 'solved' });
  });

  it('rejects the incomplete reconstruction from #2567', async () => {
    const solution = `y' // insp
F' R' R' U' R D' U' U' R' L2 U L' // Y cross(GO)
U' R' U R // RG
y' U L' U' L U L // RB
U L' U L U' L' U L // OB
U' R U R' U' R' F R2 U R2 U R' F' // oll-Y
U X R' U R' D2 R U' R' D2 R2 x' U' pl 1-A+`;

    await expect(checkReconCompletion({
      event: '3x3',
      scramble: "ULB2LD' B' FR' B' U' L2F' D' R2F' U' B",
      solution,
    })).resolves.toEqual({ status: 'unsolved' });
  });

  it('drops a whole prose chunk instead of reading a move inside it', () => {
    expect(cleanReconCubeStateMoves("U pl R' 1-A+")).toBe("U R'");
  });

  it('does not guess when the scramble is an unknown placeholder', async () => {
    await expect(checkReconCompletion({
      event: '3x3',
      scramble: '?',
      solution: 'R U',
    })).resolves.toEqual({ status: 'unchecked' });
  });

  it.each([
    ['sq1', '(1,0)', '(-1,0)'],
    ['mega', 'R++', 'R--'],
    ['clock', 'UR3+', 'UR3-'],
    ['pyra', 'R', "R'"],
    ['skewb', 'R', "R'"],
  ])('accepts inverse moves for %s notation', async (event, scramble, solution) => {
    await expect(checkReconCompletion({ event, scramble, solution }))
      .resolves.toEqual({ status: 'solved' });
  });
});

describe('unsolved reason validation', () => {
  it('requires non-whitespace text', () => {
    expect(hasUnsolvedReason({ unsolved_reason: '   ' })).toBe(false);
    expect(hasUnsolvedReason({ unsolved_reason: '原视频缺少最后一步' })).toBe(true);
  });
});
