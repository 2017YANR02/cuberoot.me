import { expect, it } from 'vitest';
import { getCube3 } from '@cuberoot/shared/recon/cube3';
import { compactCubeRotations } from '@cuberoot/shared/timer/reconstruct/gyro-orient';
import { formatReconLine, simplifyF2lRotations, type ReconTextLine, type ReconTextResult } from '@cuberoot/shared/timer/reconstruct/recon-text';

function fixture(moves: string[], kind: ReconTextLine['kind'] = 'f2l'): ReconTextResult {
  const line: ReconTextLine = { kind, key: 'slot-FR', moves, fromIdx: 3, toIdx: 8,
    label: 'FR', recognitionMs: 20, executionMs: 400, stepMs: 420,
    moveRanges: moves.map((token, i) => ({ token, ts: i * 100, endTs: i * 100,
      startIdx: 3, endIdx: 2 })),
  };
  return { scramble: 'R U F', inspection: 'z2', lines: [line], text: `z2 // insp\n${formatReconLine(line)}`,
    turns: 6, stm: 6, seconds: 1, tps: 6, rotations: [], blindPairs: 0 };
}

it('preserves the full cube transformation for every three-rotation combination', async () => {
  const cube = await getCube3();
  const tokens = ['x', "x'", 'x2', 'y', "y'", 'y2', 'z', "z'", 'z2'];
  for (const a of tokens) for (const b of tokens) for (const c of tokens) {
    const input = `${a} ${b} ${c}`;
    expect(cube.algToTransformation(input).isIdentical(cube.algToTransformation(compactCubeRotations(input))), input).toBe(true);
  }
});

it('cancels only contiguous F2L rotations, retaining source records and remapping annotations', () => {
  const recon = fixture(["x'", 'x', 'y', 'U', "x'", 'R', 'x']);
  recon.lines[0].algorithmGroups = [{ from: 3, to: 7 }];
  recon.lines[0].wasteGroups = [null, null, null, 1, 1, 1, 1];
  const original = JSON.stringify(recon);
  const result = simplifyF2lRotations(recon);
  expect(result.lines[0].moves).toEqual(['y', 'U', "x'", 'R', 'x']);
  expect(result.lines[0].moveRanges?.[0]).toMatchObject({ token: 'y', ts: 0, endTs: 200, startIdx: 3, endIdx: 2 });
  expect(result.lines[0].moveRanges?.[1]).toBe(recon.lines[0].moveRanges?.[3]);
  expect(result.lines[0].algorithmGroups).toEqual([{ from: 1, to: 5 }]);
  expect(result.lines[0].wasteGroups).toEqual([null, 1, 1, 1, 1]);
  expect(result.rotations).toBe(recon.rotations);
  expect(JSON.stringify(recon)).toBe(original);
});

it('handles identity and half turns without crossing stage or layer boundaries', () => {
  expect(simplifyF2lRotations(fixture(["x'", 'x'])).lines[0].moves).toEqual([]);
  expect(simplifyF2lRotations(fixture(['x', 'x', 'U'])).lines[0].moves).toEqual(['x2', 'U']);
  for (const kind of ['cross', 'oll', 'pll'] as const) {
    const recon = fixture(["x'", 'x'], kind);
    expect(simplifyF2lRotations(recon)).toBe(recon);
  }
  const recon = fixture(['x']);
  recon.lines.push({ ...recon.lines[0], key: 'slot-BR', moves: ["x'"] });
  expect(simplifyF2lRotations(recon)).toBe(recon);
  const layers = fixture(["x'", 'M', 'x', 'r', "x'"]);
  expect(simplifyF2lRotations(layers)).toBe(layers);
});
