import { describe, expect, it, vi } from 'vitest';
// All 41 canonical setups from the public F2L API, captured 2026-10-08.
import cases from './fixtures/recon-f2l-cases.json';
import { reconF2lLinks, reconF2lAnnotations } from '@/lib/recon-f2l-links';
import { CUBE_ORIENTATIONS } from '@cuberoot/shared/timer';
import { applyScramble } from '@cuberoot/shared/timer/reconstruct/state';
import { FACE_COLOR_KEY } from '@cuberoot/shared/timer/reconstruct/orient';

const advancedCases = [
  { id: 3557, name: 'AF2L 24', setup: "L' R U2' R' L", algs: [] },
  { id: 3559, name: 'AF2L 26', setup: "R L U2' L' R'", algs: [] },
];
vi.mock('@cuberoot/shared/alg', async importOriginal => ({
  ...await importOriginal<typeof import('@cuberoot/shared/alg')>(),
  loadAlg: vi.fn(async (_puzzle: string, set: string) => ({ cases: set === 'f2l' ? cases : set === 'adv-f2l' ? advancedCases : [] })),
}));

describe('F2L comment state recognition', () => {
  it('shows only the green-orange pair above the cross in recon 2795', async () => {
    const { diagrams } = await reconF2lAnnotations("U' L F L2 U' F L2 U R2 D B' F D' U2 R D R'", [
      "x' z' // insp",
      "U' r' R2 U' R2' D' R2 // W xcross (OB) cancel into",
      "U R' U'D' // xxcross (RG)",
      "R' U' R // OG",
    ].join('\n'));
    const diagram = diagrams.get(3)![0];
    expect(diagram.colors).toBe('OG');
    const actual = applyScramble(3, "U' L F L2 U' F L2 U R2 D B' F D' U2 R D R' x' z' U' r' R2 U' R2' D' R2 U R' U'D'");
    expect([diagram.facelets[22], diagram.facelets[13]]).toEqual([FACE_COLOR_KEY[actual.F[4]][0], FACE_COLOR_KEY[actual.R[4]][0]]);
    const topLayer = [0, 9, 18, 36, 45].map((start, i) => diagram.facelets.slice(start, start + (i === 0 ? 9 : 3))).join('');
    expect([...topLayer].filter(c => c !== 'd').sort()).toEqual(['g', 'g', 'o', 'o', 'w']);
  });
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

  it('finds an advanced case by its setup when no standard case matches', async () => {
    const links = await reconF2lLinks(advancedCases[0].setup, '// Y cross\n// GR');
    expect(links.get(1)?.get('GR')).toBe('/alg/3x3/adv-f2l/af2l-24');
  });

  it('does not guess when multiple advanced cases share the same pair state', async () => {
    const { loadAlg } = await import('@cuberoot/shared/alg');
    vi.mocked(loadAlg).mockImplementationOnce(async () => ({ cases } as never))
      .mockImplementationOnce(async () => ({ cases: [advancedCases[0], { ...advancedCases[0], id: 9999, name: 'AF2L 99' }] } as never));
    const links = await reconF2lLinks(advancedCases[0].setup, '// Y cross\n// GR');
    expect(links.get(1)?.get('GR')).toBeUndefined();
  });

  it('keeps standard matches when the advanced library is unavailable', async () => {
    const { loadAlg } = await import('@cuberoot/shared/alg');
    vi.mocked(loadAlg).mockImplementationOnce(async () => ({ cases } as never))
      .mockRejectedValueOnce(new Error('unavailable'));
    const links = await reconF2lLinks("D' F U B2 L R' D U2 F' D2 U F D U' R2 B' L2 R2", [
      'x2 y // insp', "R' B' R2 U D R2' F2 // W cross", "U' L' U' L R U' R' // GR",
      "(U U') B U y R2' U' R // OB", "(U' U) R U R' // GO",
    ].join('\n'));
    expect(links.get(2)?.get('GR')).toBeUndefined();
    expect(links.get(4)?.get('GO')).toBe('/alg/3x3/f2l/b+');
  });

  it.each(CUBE_ORIENTATIONS)('keeps A+ correct in orientation $label and its cross colour', async ({ value }) => {
    const centres = applyScramble(3, value);
    const color = (face: keyof typeof FACE_COLOR_KEY) => FACE_COLOR_KEY[face][0].toUpperCase();
    const cross = color(centres.D[4]);
    const pair = color(centres.F[4]) + color(centres.R[4]);
    const { links, diagrams } = await reconF2lAnnotations(`${value} R U R' U'`, `// ${cross} cross\nU R U' R' // ${pair}`);
    expect(links.get(1)?.get(pair)).toBe('/alg/3x3/f2l/a+');
    const facelets = diagrams.get(1)?.[0].facelets;
    expect(facelets?.length).toBe(54);
    expect([...facelets!].filter(c => c === 'd')).toHaveLength(36);
    // Actual bottom and side centres survive even for non-yellow crosses.
    expect(facelets![31]).toBe(cross.toLowerCase());
    expect(facelets![22]).toBe(pair[0].toLowerCase());
    expect(facelets![13]).toBe(pair[1].toLowerCase());
  });

  it('leaves missing scrambles and already solved pairs unlinked', async () => {
    expect((await reconF2lLinks('', 'R U // GR')).size).toBe(0);
    expect((await reconF2lLinks('U', 'U\' // GR')).size).toBe(0);
  });
});

it('unions both 2796 pair masks into exactly one pre-line cube', async () => {
  const scramble = "F' L' B R' B2 U L2 B2 U2 F2 D R D L F' U L B'";
  const diagramsFor = async (pairs: string) => (await reconF2lAnnotations(scramble,
    `x'z' // insp\nr' F R2 r' U r D F2 // W xxcross (${pairs})`)).diagrams.get(1)!;
  const [combined, br, ob] = await Promise.all([diagramsFor('BR+OB'), diagramsFor('BR'), diagramsFor('OB')]);
  expect(combined).toHaveLength(1);
  expect(combined[0].colors).toBe('BR+OB');
  expect(combined[0].facelets).toBe([...br[0].facelets].map((c, i) => c === 'd' ? ob[0].facelets[i] : c).join(''));
});

it('publishes all F2L images before the formula-library request settles', async () => {
  const { loadAlg } = await import('@cuberoot/shared/alg');
  let release!: (value: Awaited<ReturnType<typeof loadAlg>>) => void;
  vi.mocked(loadAlg).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  const ready = vi.fn();
  const started = performance.now();
  const pending = reconF2lAnnotations("F' L' B R' B2 U L2 B2 U2 F2 D R D L F' U L B'", [
    "x'z' // insp", "r' F R2 r' U r D F2 // W xxcross (BR+OB)",
    "(U' U' U') R' U R // GO", "U' R U R' // GR",
  ].join('\n'), ready);
  expect(ready).toHaveBeenCalledTimes(1);
  expect([...ready.mock.calls[0][0].values()].map(rows => rows.length)).toEqual([1, 1, 1]);
  console.info(`F2L diagrams ready before network response: ${(performance.now() - started).toFixed(2)}ms`);
  release({ cases } as Awaited<ReturnType<typeof loadAlg>>);
  await pending;
});
