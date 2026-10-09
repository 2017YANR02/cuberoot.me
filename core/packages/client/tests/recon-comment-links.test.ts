import { describe, expect, it } from 'vitest';
import type { AlgCase } from '@cuberoot/shared/alg';
import { reconCommentCaseIndex, reconCommentLinks } from '@/lib/recon-comment-links';

const makeCase = (id: number, name: string, extra: Partial<AlgCase> = {}): AlgCase => ({
  id, name, subgroup: '', setup: '', sticker: { kind: 'raw', tag: 'div', attrs: {} }, algs: [], ...extra,
});
const cases = new Map([
  ['zbll', reconCommentCaseIndex('zbll', [makeCase(5028, 'ZBLL S 67', { subgroup: 'S/SU', meta: { no: 352, ollcp: 'S+U3' } })])],
  ['oll', reconCommentCaseIndex('oll', [makeCase(1, 'OLL 27')])],
  ['pll', reconCommentCaseIndex('pll', [makeCase(2, 'Aa'), makeCase(3, 'Ua')])],
  ['f2l', reconCommentCaseIndex('f2l', [makeCase(4, 'A+')])],
]);

describe('recon comment learning links', () => {
  it.each([
    ['ZBLL-S+67', '/alg/3x3/zbll/s+u3'],
    ['ZBLL-S+U3', '/alg/3x3/zbll/s+u3'],
    ['zbll S 67', '/alg/3x3/zbll/s+u3'],
    ['OLL-S+', '/alg/3x3/oll/s+'],
    ['OLL 27', '/alg/3x3/oll/s+'],
    ['PLL-A+', '/alg/3x3/pll/aa'],
    ['PLL Aa', '/alg/3x3/pll/aa'],
    ['EPLL-U-', '/alg/3x3/pll/ua'],
    ['F2L-A+', '/alg/3x3/f2l/a+'],
  ])('resolves %s through the canonical library slug', (label, href) => {
    const line = `R U R' // ${label}`;
    const [link] = reconCommentLinks(line, cases);
    expect(link.href).toBe(href);
    expect(line.slice(link.start, link.end)).toBe(label);
  });

  it('only links comment labels and retains safe set links for unknown cases', () => {
    expect(reconCommentLinks('OLL-S+ R U R\'', cases)).toEqual([]);
    const line = 'R U // OLL PLL / F2L / ZBLL-unknown / ZBLS';
    expect(reconCommentLinks(line, cases).map(link => line.slice(link.start, link.end)))
      .toEqual(['OLL', 'PLL', 'F2L', 'ZBLL', 'ZBLS']);
    expect(reconCommentLinks('R U // ZBLL-unknown', cases)[0].href).toBe('/alg/3x3/zbll');
    expect(reconCommentLinks('R U // inspection / OLLCP / notF2L', cases)).toEqual([]);
  });

  it('does not guess a case when names collide across subgroups', () => {
    const index = reconCommentCaseIndex('zbls', [
      makeCase(5, 'EO', { subgroup: 'A+' }), makeCase(6, 'EO', { subgroup: 'A-' }),
    ]);
    expect(index.has('eo')).toBe(false);
  });
});
