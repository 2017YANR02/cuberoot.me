import { expect, it } from 'vitest';
import { assemblePuzzleSamples } from '../src/build_puzzle_examples';

it('omits retired corpus IDs while preserving samples joined to current WCA metadata', () => {
  const scramble = "R' U2 F2 R2 U R F' R' U' R' F";
  expect(assemblePuzzleSamples(
    ['retired-id', 'current-id', 'current-with-opt'],
    new Map([
      ['retired-id', scramble],
      ['current-id', scramble],
      ['current-with-opt', "R U R'"],
    ]),
    new Map([['current-with-opt', "R U R'"]]),
    {
      'current-id': ['Test2026', '222', 1, '1', 'A', 0],
      'current-with-opt': ['Test2026', '222', 2, '1', 'A', 0],
    },
  )).toEqual([
    ['current-id', scramble],
    ['current-with-opt', "R U R'", "R U R'"],
  ]);
});
