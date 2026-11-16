import { describe, expect, it, vi } from 'vitest';
import type { QueryRunner } from '../src/db/connection.js';
vi.mock('../src/db/connection.js', () => ({ query: vi.fn() }));
import { syncLinkedCaseAnnotations } from '../src/utils/alg_mirror.js';

describe('single-view annotation persistence', () => {
  it('resolves table number rather than id, saves marks and supports reverse clearing', async () => {
    const gc = { id: 4311, meta: { no: 14, mirror: 13 }, algs: [[{ alg: "R U R'", algHtml: "R <s>U</s> R'" }]] };
    const ga = { id: 4309, meta: { no: 13, mirror: 14 }, algs: [[{ alg: "L' U' L", source: 'keep' }]] };
    const run = vi.fn(async (sql: string, params: unknown[]) => {
      if (sql.startsWith('SELECT')) return params[2] === '13' ? [structuredClone(ga)] : [structuredClone(gc)];
      const target = params[1] === 4309 ? ga : gc;
      target.algs = params[0] as typeof target.algs;
      return [];
    });
    const report = await syncLinkedCaseAnnotations(run as QueryRunner, '3x3', 'pll', gc, [[{ alg: gc.algs[0][0].alg }]]);
    expect(report).toEqual({ updated: [4309], notes: [] });
    expect(run.mock.calls[0][1]).toEqual(['3x3', 'pll', '13']);
    expect(ga.algs).toEqual([[{ alg: "L' U' L", algHtml: "L' <s>U'</s> L", source: 'keep' }]]);
    const previous = structuredClone(ga.algs);
    ga.algs = [[{ alg: "L' U' L", source: 'keep' }]];
    expect(await syncLinkedCaseAnnotations(run as QueryRunner, '3x3', 'pll', ga, previous)).toEqual({ updated: [4311], notes: [] });
    expect(gc.algs).toEqual([[{ alg: "R U R'" }]]);
  });
  it('rejects non-reciprocal or unsupported partners and leaves four-slot generation alone', async () => {
    const self = { id: 1, meta: { no: 10, mirror: 20 }, algs: [[{ alg: 'R', algHtml: '<s>R</s>' }]] };
    const run = vi.fn(async () => [{ id: 2, meta: { no: 20, mirror: 30 }, algs: [[{ alg: "L'" }]] }]);
    expect((await syncLinkedCaseAnnotations(run as QueryRunner, '3x3', 'pll', self, [])).notes).toHaveLength(1);
    expect(run).toHaveBeenCalledTimes(1);
    await syncLinkedCaseAnnotations(run as QueryRunner, 'sq1', 'pbl', self, []);
    await syncLinkedCaseAnnotations(run as QueryRunner, '3x3', 'f2l', self, []);
    expect(run).toHaveBeenCalledTimes(1);
  });
  it('also follows a single-view database-id link without table metadata', async () => {
    const self = { id: 9, meta: null, mirror_case_id: 12, algs: [[{ alg: 'R', algHtml: '<s>R</s>' }]] };
    const run = vi.fn(async (sql: string) => sql.startsWith('SELECT')
      ? [{ id: 12, meta: null, mirror_case_id: 9, algs: [[{ alg: "L'" }]] }] : []);
    expect(await syncLinkedCaseAnnotations(run as QueryRunner, '3x3', 'cls', self, [[{ alg: 'R' }]]))
      .toEqual({ updated: [12], notes: [] });
    expect(run.mock.calls).toHaveLength(2);
  });
  it('inherits annotations on a new counterpart but not on an existing explicitly cleared entry', async () => {
    const self = { id: 1, meta: { no: 10, mirror: 20 }, algs: [[{ alg: 'R' }]] };
    const partner = { id: 2, meta: { no: 20, mirror: 10 }, algs: [[{ alg: "L'", algHtml: "<s>L'</s>" }]] };
    const run = vi.fn(async (sql: string, _params: unknown[]) => sql.startsWith('SELECT') ? [partner] : []);
    expect(await syncLinkedCaseAnnotations(run as QueryRunner, '3x3', 'oll', self, [[]]))
      .toEqual({ updated: [1], notes: [] });
    expect(run.mock.calls[1][1]).toEqual([[[{ alg: 'R', algHtml: '<s>R</s>' }]], 1]);
    run.mockClear();
    expect(await syncLinkedCaseAnnotations(run as QueryRunner, '3x3', 'oll', self, [[{ alg: 'R', algHtml: '<s>R</s>' }]]))
      .toEqual({ updated: [2], notes: [] });
    expect(run.mock.calls[1][1]).toEqual([[[{ alg: "L'" }]], 2]);
  });
});
