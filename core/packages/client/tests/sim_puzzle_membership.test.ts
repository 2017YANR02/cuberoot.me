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
  it('keeps all 16 legacy puzzles in order and adds SQ2, SQ4, Duo, Magic, Master Magic, Ghost and Sphere', () => {
    const actual = SIM_FIXED_PUZZLE_OPTIONS.map((option) => option.value);
    const legacy = new Set<string>(LEGACY_SIM_PUZZLES);

    expect(new Set(actual).size).toBe(actual.length);
    expect(actual.filter((puzzle) => legacy.has(puzzle))).toEqual(LEGACY_SIM_PUZZLES);
    expect(actual.filter((puzzle) => !legacy.has(puzzle))).toEqual(['sq2', 'sq4', 'pyraminx_duo', 'magic', 'mmagic', 'ghost', 'sphere']);
    expect(actual).toHaveLength(LEGACY_SIM_PUZZLES.length + 7);
  });

  it.each(['sq2', 'sq4', 'pyraminx_duo', 'ghost', 'sphere'] as const)('%s uses the active simulator engine', (puzzle) => {
    expect(resolveCaps(puzzle, 'group').engineActive).toBe(true);
  });

  it('keeps sphere on ordinary 3x3 reconstruction rules and gates unsupported surface controls', () => {
    expect(reconEventForSim('sphere')).toBe('3x3');
    expect(resolveCaps('sphere', 'group').supports).toMatchObject({
      faceColors: true, scale: true, sensitivity: true, holdPartialTurn: true,
      thickness: false, hollow: false, hint: false, coreColor: false, coreFinish: false,
      logo: false, arrow: false, pictureCube: false, roomCube: false, hands: false,
      structureColor: false, stickering: false,
    });
  });

  it.each(['sq2', 'sq4', 'pyraminx_duo', 'ghost'] as const)('%s has no reconstruction event', (puzzle) => {
    expect(reconEventForSim(puzzle)).toBeNull();
  });
});
