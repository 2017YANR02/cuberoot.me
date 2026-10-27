import { describe, expect, it, vi } from 'vitest';

vi.mock('@/app/[lang]/alg/[puzzle]/[set]/AlgSetClient', () => ({ default: () => null }));
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); } }));

import AlgSetPage, { generateStaticParams } from '@/app/[lang]/alg/[puzzle]/[set]/page';

describe('algorithm set static parameters', () => {
  it('admits the nested case shell alongside real sets', () => {
    const params = generateStaticParams();
    expect(params).toContainEqual({ puzzle: '_', set: '_' });
    expect(params).toContainEqual({ puzzle: '3x3', set: 'pll' });
    expect(params).not.toContainEqual({ puzzle: '3x3', set: 'missing' });
  });

  it('keeps the sentinel parent and unknown sets unavailable as standalone lists', async () => {
    await expect(AlgSetPage({ params: Promise.resolve({ puzzle: '_', set: '_' }) })).rejects.toThrow('NOT_FOUND');
    await expect(AlgSetPage({ params: Promise.resolve({ puzzle: '3x3', set: 'missing' }) })).rejects.toThrow('NOT_FOUND');
    await expect(AlgSetPage({ params: Promise.resolve({ puzzle: '3x3', set: 'pll' }) })).resolves.toBeTruthy();
  });
});
