import { confirmedReconPrefix } from '@cuberoot/timer-ui/reconstruct/analysis-protocol';
import { describe, expect, it } from 'vitest';
import { buildReconText, prepareReconstruction, retainConfirmedRecon, simplifyF2lRotations } from '@cuberoot/shared/timer/reconstruct/recon-text';
import type { ReconTextInput, ReconTextResult } from '@cuberoot/shared/timer/reconstruct/recon-text';
import { patternFromAlg } from '@/lib/cube3';
import { projectReconNotation } from '@cuberoot/timer-ui/reconstruct/report-presentation';

const scramble = "D R' D' R B' U' R' F2 L' F2 D' U2 L' D2 F L' B R'";
const moves = "U R' F R' B B L U F F R' F F U U R U B' U U B F L F L' F F U' F U U L' U L U' L' U' L U U F U R U' R' F' U' F F U' F F D R R B B U B B D' R R U"
  .split(' ').map((m, i) => ({ m, ts: (i + 1) * 200 }));
const alg = (result: ReconTextResult) => [result.scramble, result.inspection, ...result.lines.flatMap(line => line.moves)].join(' ');
const rotations = ['', 'x', "x'", 'x2', 'y', "y'", 'y2', 'z', "z'", 'z2'];

describe('confirmed live reconstruction', () => {
  it('keeps completed raw and displayed rows across new stages and final playback', async () => {
    let previous: ReconTextInput | undefined;
    let result: ReconTextResult | undefined;
    let confirmedCount = 0;
    for (const length of [12, 22, 32, 42, moves.length]) {
      const input = prepareReconstruction({ scramble, moves: moves.slice(0, length), timeMs: length * 200 + 300 }, 'cfop', 'en').text!;
      const prefix = previous && result ? confirmedReconPrefix(previous, result) : undefined;
      const built = await buildReconText({ ...input, confirmed: prefix });
      const retained = await retainConfirmedRecon(built, prefix);
      const presentation = await retainConfirmedRecon(simplifyF2lRotations(retained), prefix?.presentation);
      result = { ...retained, presentation };
      for (const [i, line] of (prefix?.lines ?? []).entries()) expect(result.lines[i]).toBe(line);
      for (const [i, line] of (prefix?.presentation?.lines ?? []).entries()) expect(presentation.lines[i]).toBe(line);
      confirmedCount += prefix?.lines.length ?? 0;
      const expected = await patternFromAlg([scramble, ...input.physical!.moves.map(move => move.m)].join(' '));
      for (const reconstruction of [result, presentation]) {
        const actual = await patternFromAlg(alg(reconstruction));
        expect(rotations.some(a => rotations.some(b => actual.applyAlg(`${a} ${b}`).isIdentical(expected)))).toBe(true);
      }
      expect(projectReconNotation(result, 'cfop').simplifiedRecon).toBe(presentation);
      expect(simplifyF2lRotations(result)).toBe(presentation);
      if (length === moves.length) expect(confirmedReconPrefix(input, result).lines).toHaveLength(result.lines.length);
      previous = input;
    }
    expect(confirmedCount).toBe(13);
  }, 30_000);

  it('never confirms the active tail or an encoder gesture at the stream boundary', async () => {
    const input = prepareReconstruction({ scramble, moves: moves.slice(0, 7), timeMs: 1400 }, 'cfop', 'en').text!;
    const result = await buildReconText(input);
    expect(confirmedReconPrefix(input, result).lines).toEqual([]);
  });
});

it('bridges a changed display frame in the new row without rewriting the confirmed row', async () => {
  const input = prepareReconstruction({ scramble, moves: moves.slice(0, 12), timeMs: 2700 }, 'cfop', 'en').text!;
  const built = await buildReconText(input);
  const prefix = confirmedReconPrefix(input, built);
  const end = prefix.lines.at(-1)!.toIdx;
  const changed = { ...built, lines: built.lines.flatMap(line => line.toIdx === end
    ? [line, { ...line, key: 'rotation', fromIdx: end + 1, moves: ['y'] }] : [line]) };
  const merged = await retainConfirmedRecon(changed, prefix);
  expect(merged.lines[0]).toBe(prefix.lines[0]);
  expect(merged.lines[prefix.lines.length].moves[0]).toBe('y');
  expect((await patternFromAlg(alg(merged))).isIdentical(await patternFromAlg(alg(changed)))).toBe(true);
  await expect(retainConfirmedRecon({ ...changed, lines: changed.lines.map(line => line.toIdx === end
    ? { ...line, moves: [...line.moves, 'R'] } : line) }, prefix)).rejects.toThrow('Confirmed reconstruction state changed');
});
