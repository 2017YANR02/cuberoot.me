import { expect, it } from 'vitest';
import { summarizeCompRecords } from '@/lib/comp-records';

it('counts all rounds, separates single/average and prioritizes record levels over PR', () => {
  const row = { e: '333', b: 400, a: 500, pS: 1, pA: 1 };
  expect(summarizeCompRecords([
    { ...row, sr: 'WR', ar: 'FWR' },
    { ...row, sr: 'AsR', ar: 'NR' },
    row, row,
    { ...row, pS: 2, pA: 3 },
    ...['AfR', 'ER', 'NAR', 'OcR', 'SAR', 'CR'].map(sr => ({ ...row, sr, a: 0 })),
  ])).toEqual({ WR: 1, FWR: 1, CR: 7, NR: 1, PR: 4 });
});

it('ignores invalid, missing and unofficial multi-blind averages', () => {
  expect(summarizeCompRecords([
    { e: '333', b: -1, a: 0, sr: 'WR', ar: 'FWR', pS: 1, pA: 1 },
    { e: '333', b: NaN, a: Infinity, pS: 1, pA: 1 },
    { e: '333', b: 400, a: 500 },
    { e: '333mbf', b: 100000001, a: 100000002, sr: 'WR', ar: 'WR' },
  ])).toEqual({ WR: 1, FWR: 0, CR: 0, NR: 0, PR: 0 });
  expect(summarizeCompRecords([])).toEqual({ WR: 0, FWR: 0, CR: 0, NR: 0, PR: 0 });
});
