import { describe, expect, it } from 'vitest';
import { parseAlgorithm, parseCase, renderFromSimpleQuery } from '@cuberoot/visualcube';
import { invertAlg } from '@cuberoot/shared/alg-transform';

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
    ["(R U)'", "U' R'"],
    ["(R U)2'", "U' R' U' R'"],
    ['(R U)3', 'R U R U R U'],
    ["(R (U F)2)'", "F' U' F' U' R'"],
    ["(2-4r U)'", "U' R 4r'"],
    ["2-4r'2", '4r2 R2'],
    ["(2-4r'2 U)2'", "U' R2 4r2 U' R2 4r2"],
    ["(3Rw2' U)'", "U' 3Rw2"],
  ])('keeps %s equivalent to %s without a lookbehind-dependent parser', (input, expanded) => {
    expect(parseAlgorithm(input)).toEqual(parseAlgorithm(expanded));
  });

  it('renders the randomly inverted OLL 15 solution as the same case as its plain scramble', () => {
    const solution = "(R' F' M F') (r U R' F R)";
    const scramble = invertAlg(solution);
    const plain = "R' F' R U' r' F M' F R";
    const setup = "l' U' l U' L' U L l' U l";
    expect(parseAlgorithm(scramble)).toEqual(parseCase(solution));
    const diagram = (s: string) => renderFromSimpleQuery({ setup: s, view: 'oll', ngs: '1' });
    expect(diagram(scramble)).toBe(diagram(plain));
    expect(diagram(scramble)).toBe(diagram(setup));
  });
});
