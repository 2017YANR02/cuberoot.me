import { readFileSync } from 'node:fs';
import { afterAll, expect, it } from 'vitest';
import { configureAlgFileLoader, type AlgFile } from '@cuberoot/shared/alg';
import { prepareReconstruction, buildReconText } from '@cuberoot/shared/timer/reconstruct/recon-text';
import { applyScramble } from '@cuberoot/shared/timer/reconstruct/state';
import { checkReconIntake } from '@/lib/recon-intake-check.mts';
import { confirmedReconPrefix } from '@cuberoot/timer-ui/reconstruct/analysis-protocol';

const libraries = JSON.parse(readFileSync(new URL('./fixtures/recon-workbook/libraries.json', import.meta.url), 'utf8')) as Record<string, AlgFile>;
configureAlgFileLoader(async (_, set) => {
  if (!libraries[set]) throw new Error(`Missing frozen library: ${set}`);
  return libraries[set];
});
afterAll(() => configureAlgFileLoader(null));

// Source 2795, transcribed from the reported comparison. Synthetic timing is
// deliberate: this protects segmentation, not the unavailable device recording.
it('keeps a ZBLL opening turn out of the preceding opposite-face F2L insertion', async () => {
  const scramble = "U' L F L2 U' F L2 U R2 D B' F D' U2 R D R' x2 y";
  const lastLayer = "R' U R U R' U2 R U R D R' U2 R D' R'";
  const alg = `F' L' R2 U' R2' D' R2 U R' U' D' R' U' R L' U' L ${lastLayer}`;
  const moves = alg.split(' ').map((m, i) => ({ m, ts: (i + 1) * 200 }));
  const before = JSON.stringify(moves);
  const prepared = prepareReconstruction({ scramble, moves, timeMs: 6400 }, 'cfop', 'en');
  const result = await buildReconText(prepared.text!);
  expect(result.lines.map(line => [line.toIdx, line.label])).toEqual([[6, 'W psxcross (OB) cancel into'], [10, 'xxcross (RG)'], [13, 'GO'], [16, 'RB/ZBLS'], [31, 'ZBLL-U15']]);
  const pair = result.lines.at(-2)!;
  const ll = result.lines.at(-1)!;
  expect(pair.moves.join(' ')).toBe("L' U' L");
  expect(pair.toIdx).toBe(16);
  expect(pair.label).toBe('RB/ZBLS');
  expect(ll.moves.join(' ')).toBe(lastLayer);
  expect(ll.fromIdx).toBe(17);
  expect(ll.label).toBe('ZBLL-U15');
  expect(JSON.stringify(moves)).toBe(before);
  const state = applyScramble(3, [result.scramble, result.inspection, ...result.lines.flatMap(line => line.moves)].join(' '));
  expect(Object.values(state).every((face: string[]) => face.every(color => color === face[4]))).toBe(true);
  const input = prepareReconstruction({ scramble, moves: moves.slice(0, 14), timeMs: 2800 }, 'cfop', 'en').text!;
  const early = await buildReconText(input);
  const continued = await buildReconText({ ...prepared.text!, confirmed: confirmedReconPrefix(input, early) });
  expect(continued.lines.map(line => [line.toIdx, line.label])).toEqual(result.lines.map(line => [line.toIdx, line.label]));
  const checked = await checkReconIntake({ id: 'source-boundary-regression', expected: null,
    input: { recording: { scramble, moves, timeMs: 6400, model: 'GAN' }, source: '',
      observed: { inspection: '', lines: [] }, annotations: [], verdict: 'needs-fix', language: 'en', hadOverride: false } }, libraries);
  expect(checked.errors).toEqual([]);
  // The library pass preserves the reconstruction editor's comment convention.
  expect(checked.actual!.lines.map(line => line.label)).toEqual([
    'W psxcross (OB) cancel into', 'xxcross (RG)', 'GO', 'RB/ZBLS', 'ZBLL-U15',
  ]);
});
