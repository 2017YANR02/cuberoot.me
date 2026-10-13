import { describe, expect, it } from 'vitest';
import {
  BENCHMARK_GROUPS, COMPARISON_ROWS, h48TableBytes,
} from '@/app/[lang]/dev/solvers/compare/comparison-data';

describe('solver comparison evidence boundaries', () => {
  it('keeps Opt numbering separate from retained EO bits and H48 tiers', () => {
    expect(COMPARISON_ROWS.length).toBe(33);
    expect(new Set(COMPARISON_ROWS.map((row) => row.id)).size).toBe(33);
    expect(COMPARISON_ROWS.filter((row) => row.family === 'opt').map((row) => row.eoBits))
      .toEqual([0, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const family of ['nissy', 'rust']) {
      expect(COMPARISON_ROWS.filter((row) => row.family === family).map((row) => row.eoBits))
        .toEqual(Array.from({ length: 12 }, (_, h) => h));
    }
  });

  it('calculates the 64-bit H48 format without truncating large indices', () => {
    // Independent integer arithmetic from the pinned upstream format. This
    // allocates no table and performs no H11 solver execution.
    for (let h = 0; h <= 11; h++) {
      const entries = 3393n * 34650n * (1n << BigInt(h));
      const expected = ((entries + 253n) / 254n) * 64n + 2060648n;
      expect(BigInt(h48TableBytes(h))).toBe(expected);
    }
    expect(h48TableBytes(7)).toBe(3793842344);
    expect(h48TableBytes(10)).toBe(30336314216);
    expect(h48TableBytes(11)).toBe(60670567784);
    for (const invalid of [-1, 12, 0.5, NaN, Infinity]) {
      expect(() => h48TableBytes(invalid)).toThrow(RangeError);
    }
    for (const row of COMPARISON_ROWS) {
      expect(row.tableBytes).toBe(row.mainTableBytes + row.auxiliaryBytes);
    }
  });

  it('never supplies invented timings or RSS for unmeasured H48 tiers', () => {
    for (const row of COMPARISON_ROWS.filter((row) => row.family !== 'opt' && row.eoBits !== 10)) {
      expect(row.measurements).toEqual([]);
      expect(row.nativeRssBytes).toBeNull();
      expect(row.statusKind).not.toBe('measured');
    }
    for (const row of COMPARISON_ROWS.filter((row) => row.family === 'opt')) {
      expect(row.nativeRssBytes).toBeNull(); // WASM RSS is not the Rust Opt RSS.
    }
    expect(COMPARISON_ROWS.find((row) => row.id === 'rust-h11')?.statusKind).toBe('code-only');
  });

  it('keeps the three benchmark protocols separate and preserves measured totals', () => {
    expect(BENCHMARK_GROUPS.map((group) => [group.id, group.cases, group.rounds, group.comparisons.length]))
      .toEqual([['opt18', 18, 3, 8], ['opt9-60', 60, 3, 1], ['h10-60', 60, 3, 1]]);
    const opt9 = BENCHMARK_GROUPS[1].comparisons[0];
    expect([opt9.originalSeconds, opt9.rustSeconds]).toEqual([60.718842, 52.117762]);
    const h10 = BENCHMARK_GROUPS[2].comparisons[0];
    expect([h10.originalSeconds, h10.rustSeconds]).toEqual([57.605142, 36.782246953]);
    for (const group of BENCHMARK_GROUPS) {
      for (const row of group.comparisons) {
        expect(row.ratio).toBe(row.originalSeconds / row.rustSeconds);
      }
    }
  });
});
