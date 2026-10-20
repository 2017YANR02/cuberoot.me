import { expect, it } from 'vitest';
import { prepareSimVideoAlg } from '@/app/[lang]/sim/sim_export';
import { parseSq1Scramble } from '@/app/[lang]/sim/engine/sq1/sq1State';
import { parseSquareFamilyMoves, SQUARE_FAMILY_SPECS } from '@/app/[lang]/sim/engine/squareFamily/squareFamilyState';
import { parseDinoMoves, dinoMovesToString } from '@/app/[lang]/sim/engine/dino/dinoState';

it.each(['sq1', 'sq2', 'sq4'] as const)('keeps %s video turns consumable by its actual engine parser', (puzzle) => {
  const alg = prepareSimVideoAlg('(1,0) /', puzzle);
  const moves = puzzle === 'sq1' ? parseSq1Scramble(alg)
    : parseSquareFamilyMoves(alg, SQUARE_FAMILY_SPECS[puzzle]);
  expect(moves).toEqual([{ kind: 'turn', top: 1, bot: 0 }, { kind: 'slice' }]);
});

it('keeps corner-turn names intact instead of splitting them into cube face moves', () => {
  const moves = parseDinoMoves(prepareSimVideoAlg('UFR UFL // two corner turns', 'dino'));
  expect(dinoMovesToString(moves)).toBe('UFR UFL');
});

it('still expands repeated NxN moves for the video queue', () => {
  expect(prepareSimVideoAlg('(R U)2', 3)).toBe('R U R U');
});
