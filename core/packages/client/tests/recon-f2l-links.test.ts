import { describe, expect, it, vi } from 'vitest';
// All 41 canonical setups from the public F2L API, captured 2026-10-08.
import cases from './fixtures/recon-f2l-cases.json';
import { reconF2lLinks } from '@/lib/recon-f2l-links';
import { CUBE_ORIENTATIONS } from '@cuberoot/shared/timer';
import { applyScramble } from '@cuberoot/shared/timer/reconstruct/state';
import { FACE_COLOR_KEY } from '@cuberoot/shared/timer/reconstruct/orient';

vi.mock('@cuberoot/shared/alg', async importOriginal => ({
  ...await importOriginal<typeof import('@cuberoot/shared/alg')>(),
  loadAlg: vi.fn(async (_puzzle: string, set: string) => ({ cases: set === 'f2l' ? cases : [] })),
}));

describe('F2L comment state recognition', () => {
  it('recognizes both actual white-cross pairs in recon 2796', async () => {
    const links = await reconF2lLinks("F' L' B R' B2 U L2 B2 U2 F2 D R D L F' U L B'", [
      "x'z' // insp",
      "r' F R2 r' U r D F2 // W xxcross (BR+OB)",
      "(U' U' U') R' U R // GO",
      "U' R U R' // GR",
      "R U R' U R U2' R' U // ZBLL-S+67",
    ].join('\n'));
    expect([...links.entries()].map(([line, pairs]) => [line, [...pairs]])).toEqual([
      [2, [['GO', '/alg/3x3/f2l/a-']]],
      [3, [['GR', '/alg/3x3/f2l/b+']]],
    ]);
  });

  it.each(cases)('recognizes the standard $name case from its actual setup', async c => {
    const links = await reconF2lLinks(c.setup, '// Y cross\n// GR');
    expect(links.get(1)?.get('GR')).toBe(`/alg/3x3/f2l/${c.name.toLowerCase()}`);
  });

  it('resolves a generic F2L label from the pair completed on that line', async () => {
    const links = await reconF2lLinks("R U R' U'", "U R U' R' // F2L");
    expect(links.get(0)?.get('F2L')).toBe('/alg/3x3/f2l/a+');
  });

  it.each(CUBE_ORIENTATIONS)('keeps A+ correct in orientation $label and its cross colour', async ({ value }) => {
    const centres = applyScramble(3, value);
    const color = (face: keyof typeof FACE_COLOR_KEY) => FACE_COLOR_KEY[face][0].toUpperCase();
    const cross = color(centres.D[4]);
    const pair = color(centres.F[4]) + color(centres.R[4]);
    const links = await reconF2lLinks(`${value} R U R' U'`, `// ${cross} cross\nU R U' R' // ${pair}`);
    expect(links.get(1)?.get(pair)).toBe('/alg/3x3/f2l/a+');
  });

  it('leaves missing scrambles and already solved pairs unlinked', async () => {
    expect((await reconF2lLinks('', 'R U // GR')).size).toBe(0);
    expect((await reconF2lLinks('U', 'U\' // GR')).size).toBe(0);
  });
});
