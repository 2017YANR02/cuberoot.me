import { describe, expect, it, vi } from 'vitest';
import type { AlgCase, AlgFile } from '@cuberoot/shared/alg';
import { alignAlgSelection, sourceAlgCase } from '@/lib/alg_case_alignment';

vi.mock('@/lib/alg_validation', () => ({
  orientCaseSetup: vi.fn(async (_puzzle, _set, setup) => setup),
  setupForCase: vi.fn((_puzzle, setup) => setup),
  validateAlgCase: vi.fn(async (_setup, alg) => {
    if (alg.includes('UNSELECTED')) throw new Error('Hidden case was evaluated');
    return { ok: true };
  }),
  validateStoredAlgCase: vi.fn(async () => ({ ok: true })),
}));

const makeCase = (id: number, alg: string): AlgCase => ({
  id, name: `Case ${id}`, setup: "R'", subgroup: 'U/UU',
  sticker: { kind: 'face', us: 'yyyyyyyyy', ub: '', uf: '', ul: '', ur: '' },
  algs: [[{ alg }]],
});

describe('library alignment scope', () => {
  it('does not evaluate hidden cases and preserves full ordering and source payloads', async () => {
    const hidden = makeCase(1, 'UNSELECTED');
    const visible = makeCase(2, 'R');
    const file: AlgFile = { puzzle: '3x3', set: 'zbll', scrapedAt: '', source: '', cases: [hidden, visible] };
    const result = await alignAlgSelection(file, [visible]);
    expect(result.cases.map(c => c.id)).toEqual([1, 2]);
    expect(result.cases[0]).toBe(hidden);
    expect(sourceAlgCase(result.cases[1])).toBe(visible);
    expect(result.cases[1].algs[0][0].alg).toBe('R');
    expect(await alignAlgSelection(file, [visible])).toBe(result);
    expect(await alignAlgSelection(file, [])).toBe(file);
  });
});
