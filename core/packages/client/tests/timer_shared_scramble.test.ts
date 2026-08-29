import { describe, expect, it } from 'vitest';

import { randomFaceMoves, scramble333 } from '@cuberoot/shared/timer';
import { scramble333 as websiteScramble333 } from '@/app/[lang]/timer/_lib/scramble/nxnxn';

const AXIS: Record<string, number> = {
  U: 0,
  D: 0,
  L: 1,
  R: 1,
  F: 2,
  B: 2,
};

function assertValid(scramble: string): void {
  const moves = scramble.split(' ');
  expect(moves).toHaveLength(20);
  expect(moves.every((move) => /^[UDLRFB](?:2|')?$/.test(move))).toBe(true);

  const faces = moves.map((move) => move[0]);
  for (let index = 1; index < faces.length; index++) {
    expect(faces[index]).not.toBe(faces[index - 1]);
    if (index >= 2) {
      expect(
        AXIS[faces[index]] === AXIS[faces[index - 1]]
        && AXIS[faces[index - 1]] === AXIS[faces[index - 2]],
      ).toBe(false);
    }
  }
}

describe('shared 3x3 scramble generator', () => {
  it('is the website compatibility export instead of a second implementation', () => {
    expect(websiteScramble333).toBe(scramble333);
  });

  it('generates a valid sequence with a deterministic RNG', () => {
    let state = 0x12345678;
    const rng = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x100000000;
    };
    assertValid(scramble333(rng));
  });

  it('stays valid when the RNG is stuck or outside its normal range', () => {
    for (const value of [0, 1, -1, Number.NaN]) {
      assertValid(scramble333(() => value));
    }
  });

  it('shares canonical variable-length sequences with bounded count handling', () => {
    expect(randomFaceMoves(6, () => 0)).toHaveLength(6);
    expect(randomFaceMoves(3.9, () => 0)).toHaveLength(3);
    expect(randomFaceMoves(-1, () => 0)).toEqual([]);
    expect(randomFaceMoves(Number.POSITIVE_INFINITY, () => 0)).toEqual([]);
  });
});
