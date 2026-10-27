import { expect, it, vi } from 'vitest';
import recordings from './fixtures/f2l-share-recognition.json';
import cases from './fixtures/recon-f2l-cases.json';
import { prepareReconstruction, buildReconText, simplifyF2lRotations } from '@cuberoot/shared/timer/reconstruct/recon-text';
import { correctReconFromLibrary, correctLibraryLine } from '@cuberoot/shared/timer/reconstruct/library-correction';
import { applyScramble } from '@cuberoot/shared/timer/reconstruct/state';
import { applyOneToken } from '@cuberoot/shared/timer/reconstruct/apply-token';
import { isCross } from '@cuberoot/shared/timer/reconstruct/cfop-detect';
import { isSlotSolved } from '@cuberoot/shared/timer/reconstruct/f2l-slots';
import { reconF2lAnnotations } from '@/lib/recon-f2l-links';

vi.mock('@cuberoot/shared/alg', async importOriginal => ({
  ...await importOriginal<typeof import('@cuberoot/shared/alg')>(),
  loadAlg: vi.fn(async (_puzzle: string, set: string) => ({ cases: set === 'f2l' ? cases.map(c => ({
    // Public library variants retain their trailing orientation reset.
    ...c, algs: c.name === 'A-' ? [[{ alg: "U' f' L f y2" }]] : c.name === 'A+' ? [[{ alg: "U f R' f' y" }]] : [],
  })) : [] })),
}));

it('keeps WF5Kzh53C_s on its yellow cross through incidental crosses', async () => {
  const solve = recordings.WF5Kzh53C_s;
  const input = prepareReconstruction(solve, 'cfop', 'en').text!;
  const recon = await buildReconText(input);
  expect(recon.crossColor).toBe('D');
  expect(recon.lines.filter(line => line.kind === 'f2l').map(line => line.label)).toEqual(['OG', 'RG', 'BR', 'BO']);
  const shown = simplifyF2lRotations(recon);
  const { diagrams } = await reconF2lAnnotations(solve.scramble, shown.text);
  expect([...diagrams.keys()]).toEqual([2, 3, 4, 5]);
  for (const rows of diagrams.values()) expect(rows[0].facelets[31]).toBe('y');
});

it('closes buTLFG2cVU8 F3 at B U prime B prime and recognizes both closed wide formulas without adding AUF', async () => {
  const solve = recordings.buTLFG2cVU8;
  const prepared = prepareReconstruction(solve, 'cfop', 'en');
  // State evidence independent of the segmentation heuristic.
  const afterThird = applyScramble(3, `${prepared.view.scramble} ${prepared.view.moves.slice(0, 21).map(move => move.m).join(' ')}`);
  expect(isCross(afterThird)).toBe(true);
  expect((['FR', 'FL', 'BR', 'BL'] as const).filter(slot => isSlotSolved(afterThird, slot))).toHaveLength(3);
  expect(prepared.slots!.slots.map(slot => slot.endIdx)).toEqual([9, 17, 20, 29]);
  const raw = await buildReconText(prepared.text!);
  const corrected = await correctReconFromLibrary(raw);
  const shown = simplifyF2lRotations(corrected);
  const pairs = shown.lines.filter(line => line.kind === 'f2l');
  expect(pairs[0].libraryCorrection?.algorithm).toBe("U' f' L f y2");
  expect(pairs[2].libraryCorrection?.algorithm).toBe("U f R' f' y");
  expect(pairs[0].moves.join(' ')).toBe("B' U B");
  expect(pairs[2].moves.join(' ')).toBe("B U' B'");
  expect(pairs[3].fromIdx).toBe(21);
  expect(pairs[3].moves.join(' ')).toBe("U2 R' F R F' R U R'");
  let state = applyScramble(3, `${solve.scramble} ${shown.inspection}`);
  for (const line of shown.lines) state = applyOneToken(state, line.moves.join(' '));
  expect(Object.values(state).every((face: string[]) => face.every(sticker => sticker === face[4]))).toBe(true);
});

it.each([
  ["B' U B", "U' f' L f"],
  ["B U' B'", "U f R' f'"],
  ["B' U B", "U' f' L f y2"],
  ["B U' B'", "U f R' f' y"],
])('matches the closed wide equivalent of %s without inventing the library AUF', async (source, formula) => {
  const moves = source.split(' ');
  const line = {
    kind: 'f2l' as const, key: 'slot-BR', label: 'RB', moves, fromIdx: 0, toIdx: 2,
    recognitionMs: 0, executionMs: 300, stepMs: 300,
    moveRanges: moves.map((token, i) => ({ token, ts: i * 100, endTs: i * 100, startIdx: i, endIdx: i })),
  };
  const result = await correctLibraryLine(line, [{ alg: formula }], true);
  expect(result.libraryCorrection?.algorithm).toBe(formula);
  expect(result.moves).toEqual(line.moves);
  expect(result.moveRanges).toEqual(line.moveRanges);
});
