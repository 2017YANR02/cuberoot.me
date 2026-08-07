import { describe, expect, it } from 'vitest';
import { ALG_CATALOG } from '@cuberoot/shared';

describe('SQ1 algorithm set names', () => {
  it('keeps compact English labels separate from localized descriptions', () => {
    expect(ALG_CATALOG.sq1.map(({ slug, short, zh }) => ({ slug, short, zh }))).toEqual([
      { slug: 'cs', short: 'CS', zh: '复形' },
      { slug: 'csp', short: 'CSP', zh: '复形奇偶' },
      { slug: 'co', short: 'CO', zh: '角块朝向' },
      { slug: 'eo', short: 'EO', zh: '棱块朝向' },
      { slug: 'cp', short: 'CP', zh: '角块排列' },
      { slug: 'ep', short: 'EP', zh: '棱块排列' },
      { slug: 'parity', short: 'Parity', zh: 'Parity' },
    ]);
  });
});
