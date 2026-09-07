import { describe, expect, it } from 'vitest';
import {
  checkReconCompletion,
  cleanReconCubeStateMoves,
  getReconScramble,
  normalizeReconMoveSuffixOrder,
  normalizeReconScrambleSpacing,
} from '@cuberoot/shared/recon-completion';
import {
  checkReconRowCompletion,
  hasUnsolvedReason,
  normalizeReconScrambleRow,
} from '../src/utils/recon_completion';

describe('reconstruction completion validation', () => {
  it('uses optimal, then WCA real, then generic scramble as the reconstruction state', () => {
    expect(getReconScramble({
      optimalScramble: 'optimal',
      wcaScramble: 'wca',
      scramble: 'generic',
    })).toBe('optimal');
    expect(getReconScramble({ wcaScramble: 'wca', scramble: 'generic' })).toBe('wca');
    expect(getReconScramble({ scramble: 'generic' })).toBe('generic');
    expect(getReconScramble({})).toBe('');
  });

  it('accepts a compact scramble followed by its solution', async () => {
    await expect(checkReconCompletion({
      event: '3x3',
      scramble: "RUR'",
      solution: "R U' R'",
    })).resolves.toEqual({ status: 'solved' });
  });

  it.each([
    ['U2', "U'2"],
    ['R3', "R'3"],
    ['3Rw4', "3Rw'4"],
  ])('accepts the prime-before-amount spelling %s + %s', async (scramble, solution) => {
    await expect(checkReconCompletion({
      event: '4x4',
      scramble,
      solution,
    })).resolves.toEqual({ status: 'solved' });
  });

  it('canonicalizes prime-before-amount moves without rewriting comments', () => {
    expect(normalizeReconMoveSuffixOrder(
      "U'2 R'3 3Rw'4 R2'3 // examples: U'2 and R'3",
    )).toBe("U2' R3' 3Rw4' R23' // examples: U'2 and R'3");
    expect(normalizeReconMoveSuffixOrder("U2' R3' R' // canonical"))
      .toBe("U2' R3' R' // canonical");
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

  it('adds spaces to compact cube moves without deleting unknown chunks', () => {
    expect(normalizeReconScrambleSpacing(
      '3x3',
      "ULB2LD' B' FR' B' U' L2F' D' R2F' U' B",
    )).toBe("U L B2 L D' B' F R' B' U' L2 F' D' R2 F' U' B");
    expect(normalizeReconScrambleSpacing('3x3', "R Q R'")).toBe("R Q R'");
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

  it('checks FTO completion across aliases, layers, rotations and macros', async () => {
    await expect(checkReconCompletion({
      event: 'fto',
      scramble: "BL rw Fs' Uo Rt2 S H' T",
      solution: "T' H S' Rt2 Uo' Fs Rw' Bl'",
    })).resolves.toEqual({ status: 'solved' });
    await expect(checkReconCompletion({
      event: 'FTO',
      scramble: "br R’",
      solution: "R Br'",
    })).resolves.toEqual({ status: 'solved' });
    await expect(checkReconCompletion({
      event: 'fto',
      scramble: '(Bl Rw)2 // paired turns',
      solution: "(Rw' Bl')2 // inverse",
    })).resolves.toEqual({ status: 'solved' });
  });

  it('rejects invalid or incomplete FTO reconstructions', async () => {
    await expect(checkReconCompletion({ event: 'fto', scramble: 'R nope', solution: "R'" }))
      .resolves.toEqual({ status: 'invalid' });
    await expect(checkReconCompletion({ event: 'fto', scramble: 'Rw', solution: "R'" }))
      .resolves.toEqual({ status: 'unsolved' });
  });

  it.each(['OH', '3BLD', 'Pyraminx', 'SQ1', 'Skewb', 'Mirror', '3x3 Smart'].map((event) => [event]))(
    'checks the historical %s event alias',
    async (event) => {
      const move = event.toLowerCase() === 'pyraminx' ? 'R' : event.toLowerCase() === 'sq1' ? '(1,0)' : 'R';
      const inverse = event.toLowerCase() === 'sq1' ? '(-1,0)' : "R'";
      await expect(checkReconCompletion({ event, scramble: move, solution: inverse }))
        .resolves.toEqual({ status: 'solved' });
    },
  );
});

describe('unsolved reason validation', () => {
  it('requires non-whitespace text', () => {
    expect(hasUnsolvedReason({ unsolved_reason: '   ' })).toBe(false);
    expect(hasUnsolvedReason({ unsolved_reason: '原视频缺少最后一步' })).toBe(true);
  });

  it('normalizes all SQL scramble columns before persistence', () => {
    const row: Record<string, unknown> = {
      event: '3x3',
      wca_scramble: "RUR'",
      optimal_scramble: "F2LU'",
      scramble: "B2DF'",
    };
    normalizeReconScrambleRow(row);
    expect(row.wca_scramble).toBe("R U R'");
    expect(row.optimal_scramble).toBe("F2 L U'");
    expect(row.scramble).toBe("B2 D F'");
  });
});

it('timing entries do not claim an unsolved reconstruction', async () => {
  await expect(checkReconRowCompletion({ record_type: 'timing', scramble: 'R', solution: '' })).resolves.toEqual({ status: 'unchecked' });
});

it('validates partial timing edits against database numeric strings', async () => {
  const { validateRow, rowToJson, jsonToRow } = await import('../src/utils/recon_helpers');
  const existing = { record_type: 'timing', pickup_time: '0.234', putdown_time: '0.123', solution: '' };
  expect(validateRow({ pickup_time: 0.345 }, existing)).toEqual([]);
  expect(validateRow({ pickup_time: null }, existing).length).toBe(1);
  expect(validateRow({ solution: 'R' }, existing).length).toBe(1);
  expect(validateRow({ record_type: 'reconstruction', solution: 'R' }, existing)).toEqual([]);
  expect(rowToJson(existing).pickupTime).toBe(0.234);
  expect(jsonToRow({ pickupTime: 0, putdownTime: 0.1 }).pickup_time).toBe(0);
});
