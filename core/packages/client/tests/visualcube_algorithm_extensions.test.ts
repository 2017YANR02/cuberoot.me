import { describe, expect, it } from 'vitest';
import { parseAlgorithm } from '@cuberoot/visualcube';

describe('visualcube extended notation preprocessing', () => {
  it.each([
    ['1-2Uw', 'Uw'],
    ['1-4Rw2', '4Rw2'],
    ['2-4r', "4r R'"],
    ['3-5r', "5r 2r'"],
    ["2-4r'", "4r' R"],
    ['2R', "2r R'"],
    ["3R'", "3r' 2r"],
    ['R 2-4r U', "R 4r R' U"],
    ['U2R', 'U2 R'],
  ])('keeps %s equivalent to %s without a lookbehind-dependent parser', (input, expanded) => {
    expect(parseAlgorithm(input)).toEqual(parseAlgorithm(expanded));
  });
});
