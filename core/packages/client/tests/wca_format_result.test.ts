import { describe, it, expect } from 'vitest';
import { formatWcaResult, formatWcaResultK } from '@/lib/wca-format-result';

describe('formatWcaResult — sentinels', () => {
  it('-1 → DNF', () => {
    expect(formatWcaResult(-1, '333', 'single')).toBe('DNF');
  });
  it('-2 → DNS', () => {
    expect(formatWcaResult(-2, '333', 'single')).toBe('DNS');
  });
  it('0 → em-dash', () => {
    expect(formatWcaResult(0, '333', 'single')).toBe('—');
  });
  it('failure: dash → "—" for DNF/DNS', () => {
    expect(formatWcaResult(-1, '333', 'single', { failure: 'dash' })).toBe('—');
    expect(formatWcaResult(-2, '333', 'single', { failure: 'dash' })).toBe('—');
  });
  it('zero: empty → "" for 0', () => {
    expect(formatWcaResult(0, '333', 'single', { zero: 'empty' })).toBe('');
  });
});

describe('formatWcaResult — time (centiseconds)', () => {
  it('< 1 minute', () => {
    expect(formatWcaResult(28, '333', 'single')).toBe('0.28');
    expect(formatWcaResult(553, '333', 'single')).toBe('5.53');
  });
  it('= 10s boundary keeps 2 decimal', () => {
    expect(formatWcaResult(1000, '333', 'single')).toBe('10.00');
  });
  it('1+ minute → m:ss.cc', () => {
    expect(formatWcaResult(8653, '333', 'single')).toBe('1:26.53');
    expect(formatWcaResult(6005, '333', 'single')).toBe('1:00.05');
  });
  it('1+ hour → h:mm:ss.cc (used by 333mbf rare overflow path indirectly)', () => {
    expect(formatWcaResult(360000, '333', 'single')).toBe('1:00:00.00');
  });
});

describe('formatWcaResult — 333fm (FMC)', () => {
  it('single = raw moves', () => {
    expect(formatWcaResult(28, '333fm', 'single')).toBe('28');
  });
  it('average = moves * 100, .toFixed(2)', () => {
    expect(formatWcaResult(2833, '333fm', 'average')).toBe('28.33');
    expect(formatWcaResult(3300, '333fm', 'average')).toBe('33.00');
  });
  it('average rounded option drops decimal', () => {
    expect(formatWcaResult(2867, '333fm', 'average', { fmcAverage: 'rounded' })).toBe('29');
  });
});

describe('formatWcaResult — 333mbf (multi-blind)', () => {
  // 0DDTTTTTMM — solved=99-DD+missed, attempted=solved+missed
  // example: 7/7 in 0:30 → DD=99-7=92, time=30, missed=0 → 0920003000 → 920003000
  it('encodes correctly: 7/7 in 0:30', () => {
    expect(formatWcaResult(920003000, '333mbf', 'single')).toBe('7/7 0:30');
  });
  it('with missed solves: 8/10 in 53:20 (DD=99-(8-2)=93, missed=2)', () => {
    // solved=8, attempted=10, missed=2, DD = 99-(solved-missed) = 99-6 = 93, time=3200s
    expect(formatWcaResult(930320002, '333mbf', 'single')).toBe('8/10 53:20');
  });
});

describe('formatWcaResult — 333mbo (old-style multi-blind, mixed encodings)', () => {
  // 333mbo stores BOTH encodings, discriminated by magnitude (old ≥ 1e9), never by event id.
  // Regression: Tim Habermaas GermanOpen2008 WR = 750815700 (< 1e9 → NEW format).
  // Forcing old-format decode produced the impossible "24/8 261:40" (solved > attempted).
  it('new-format value (< 1e9): 750815700 → 24/24 in 2:15:57', () => {
    expect(formatWcaResult(750815700, '333mbo', 'single')).toBe('24/24 2:15:57');
  });
  it('old-format value (≥ 1e9): 1960706900 → 3/7 in 1:55:00', () => {
    // 1SSAATTTTT: SS=96 → solved=99-96=3, AA=07 → attempted=7, TTTTT=06900 → 6900s
    expect(formatWcaResult(1960706900, '333mbo', 'single')).toBe('3/7 1:55:00');
  });
  it('old-format unknown time (TTTTT=99999) → ?:??', () => {
    // SS=90 → solved=9, AA=12 → attempted=12, time unknown
    expect(formatWcaResult(1901299999, '333mbo', 'single')).toBe('9/12 ?:??');
  });
});

describe('formatWcaResultK — index variant', () => {
  it('0 → single', () => {
    expect(formatWcaResultK(8653, '333', 0)).toBe('1:26.53');
  });
  it('1 → average', () => {
    expect(formatWcaResultK(2833, '333fm', 1)).toBe('28.33');
  });
});
