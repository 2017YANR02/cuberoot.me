import { describe, expect, it } from 'vitest';
import { SIM_FIXED_PUZZLE_OPTIONS } from '@/app/[lang]/sim/PlayerControls';
import { resolveCaps } from '@/app/[lang]/sim/simCaps';
import { reconEventForSim } from '@/lib/sim-recon-link';

const LEGACY_SIM_PUZZLES = [
  'nxn',
  'custom',
  'sq1',
  'ivy',
  'pyraminx',
  'skewb',
  'megaminx',
  'clock',
  'fto',
  'dino',
  'redi',
  'rex',
  'heli',
  'gear',
  'mirror',
  'mirror2',
] as const;

describe('sim puzzle registry membership', () => {
  it('keeps all 16 legacy puzzles in order and adds SQ2, SQ4 and Ghost', () => {
    const actual = SIM_FIXED_PUZZLE_OPTIONS.map((option) => option.value);
    const legacy = new Set<string>(LEGACY_SIM_PUZZLES);

    expect(new Set(actual).size).toBe(actual.length);
    expect(actual.filter((puzzle) => legacy.has(puzzle))).toEqual(LEGACY_SIM_PUZZLES);
    expect(actual.filter((puzzle) => !legacy.has(puzzle))).toEqual(['sq2', 'sq4', 'ghost']);
    expect(actual).toHaveLength(LEGACY_SIM_PUZZLES.length + 3);
  });

  it.each(['sq2', 'sq4', 'ghost'] as const)('%s uses the active simulator engine', (puzzle) => {
    expect(resolveCaps(puzzle, 'group').engineActive).toBe(true);
  });

  it.each(['sq2', 'sq4', 'ghost'] as const)('%s has no reconstruction event', (puzzle) => {
    expect(reconEventForSim(puzzle)).toBeNull();
  });
});
