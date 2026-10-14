import { describe, expect, it } from 'vitest';
import { COMPARISON_ROWS, h48TableBytes } from '@/app/[lang]/dev/solvers/compare/comparison-data';
import { BENCHMARK_MACHINES, WCA100 } from '@/app/[lang]/dev/solvers/compare/unified-benchmark';

describe('multithread solver comparison evidence', () => {
  it('separates native Rust Opt, Rust WASM Opt and Rust H numbering', () => {
    expect(COMPARISON_ROWS.length).toBe(52);
    expect(new Set(COMPARISON_ROWS.map(row => row.id)).size).toBe(52);
    for (const family of ['opt', 'rust-wasm']) {
      expect(COMPARISON_ROWS.filter(row => row.family === family).map(row => row.eoBits))
        .toEqual([0, 2, 3, 4, 5, 6, 7, 8, 9]);
    }
    expect(COMPARISON_ROWS.filter(row => row.family === 'rust-opt').map(row => row.eoBits))
      .toEqual([0, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const family of ['nissy', 'rust']) {
      expect(COMPARISON_ROWS.filter(row => row.family === family).map(row => row.eoBits))
        .toEqual(Array.from({ length: 12 }, (_, h) => h));
    }
  });

  it('preserves table sizes and distinguishes missing tables from unmeasured runs', () => {
    for (let h = 0; h <= 11; h++) {
      const entries = 3393n * 34650n * (1n << BigInt(h));
      expect(BigInt(h48TableBytes(h))).toBe(((entries + 253n) / 254n) * 64n + 2060648n);
    }
    expect(h48TableBytes(7)).toBe(3793842344);
    expect(h48TableBytes(10)).toBe(30336314216);
    expect(h48TableBytes(11)).toBe(60670567784);
    for (const invalid of [-1, 12, 0.5, NaN, Infinity]) expect(() => h48TableBytes(invalid)).toThrow(RangeError);
    for (const row of COMPARISON_ROWS) expect(row.tableBytes).toBe(row.mainTableBytes + row.auxiliaryBytes);
    expect(COMPARISON_ROWS.filter(row => row.family === 'rust' && row.tableAvailable).map(row => row.id))
      .toEqual(['rust-h7', 'rust-h10']);
    expect(COMPARISON_ROWS.find(row => row.id === 'rust-h11')?.execution).toBe('disabled');
    expect(COMPARISON_ROWS.find(row => row.id === 'rust-opt-10')?.mainTableBytes).toBe(31130911744);
  });

  it('never relabels single-thread results or mixes server and Mac thread counts', () => {
    expect([WCA100.count, WCA100.passes, WCA100.warmup]).toEqual([100, 1, 0]);
    expect(BENCHMARK_MACHINES.map(machine => [machine.id, machine.threads])).toEqual([['mac', 18]]);
    expect(WCA100.results.every(row => row.machineId === 'mac' && row.threads === 18)).toBe(true);
    expect(new Set(WCA100.results.map(row => row.id)).size).toBe(WCA100.results.length);
    for (const row of WCA100.results) {
      expect(row.threads).toBe(BENCHMARK_MACHINES.find(machine => machine.id === row.machineId)?.threads);
      expect(COMPARISON_ROWS.some(solver => solver.id === row.id)).toBe(true);
    }
  });
});
