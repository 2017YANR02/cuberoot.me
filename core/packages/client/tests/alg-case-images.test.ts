import { describe, expect, it } from 'vitest';
import type { AlgCase } from '@cuberoot/shared/alg';
import { caseImageBatch, imageFilename } from '@/lib/alg-case-images';
import { algCaseSvg } from '@/lib/alg_pdf/case_svg';
import { caseViewSetup, oriAdjustSetup } from '@/lib/alg_display';

const sample = {
  name: 'sample', sticker: { kind: 'raw', tag: '', attrs: {} },
  setup: "R U R'", algs: [[{ alg: "R U' R'" }], [{ alg: "L' U' L" }]],
} as AlgCase;

describe('case image exports', () => {
  it('uses raw setup and selected orientation, expanding orientations only on request', () => {
    const batch = caseImageBatch({ puzzle: '3x3', set: 'f2l', cases: [sample],
      title: '', filename: 'f2l', oriOf: () => 1, viewAngle: 'u', orientation: 'z2' });
    expect(batch.groups[0].current).toHaveLength(1);
    expect(batch.groups[0].current[0].input.setup).toBe(caseViewSetup(oriAdjustSetup(sample.setup, 1), 'u'));
    expect(batch.groups[0].current[0].input.orientation).toBe('z2');
    expect(batch.groups[0].all).toHaveLength(2);
    expect(batch.groups[0].all[0].input.setup).toBe(caseViewSetup(sample.setup, 'u'));
  });
  it('keeps view angle in the SVG cache key', async () => {
    const input = { puzzle: '3x3' as const, set: 'oll', sticker: sample.sticker, alg: '', setup: sample.setup };
    const normal = await algCaseSvg(input);
    expect(await algCaseSvg({ ...input, viewAngle: 'u' })).not.toBe(normal);
    expect(await algCaseSvg(input)).toBe(normal);
  });
  it('removes paths and trailing dots from image names', () => {
    expect(imageFilename('../OLL:1/.. ')).toBe('..-OLL-1-');
  });
});
