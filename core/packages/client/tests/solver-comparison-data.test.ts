import { describe, expect, it } from 'vitest';
import { COMPARISON_ROWS } from '@/app/[lang]/dev/solvers/compare/comparison-data';
import { BENCHMARK_MACHINES, WCA_BENCHMARK } from '@/app/[lang]/dev/solvers/compare/unified-benchmark';

describe('multithread solver comparison evidence', () => {
  it('shows only the retained native Opt9 and Opt10 tiers', () => {
    expect(COMPARISON_ROWS.map(row => [row.id, row.family, row.eoBits]))
      .toEqual([['rust-opt-9', 'rust-opt', 9], ['rust-opt-10', 'rust-opt', 10]]);
  });

  it('preserves table sizes and records the approved Opt10 result at 16 threads', () => {
    for (const row of COMPARISON_ROWS) expect(row.tableBytes).toBe(row.mainTableBytes + row.auxiliaryBytes);
    expect(COMPARISON_ROWS.map(row => row.tableAvailable)).toEqual([true, true]);
    expect(COMPARISON_ROWS.find(row => row.id === 'rust-opt-9')?.mainTableBytes).toBe(15565455360);
    expect(COMPARISON_ROWS.find(row => row.id === 'rust-opt-10')?.mainTableBytes).toBe(31130911744);
    expect(WCA_BENCHMARK.results).toEqual([
      { id: 'rust-opt-9', machineId: 'mac', threads: 16, seconds: 70.54567079799996, peakRssBytes: 15645851648 },
      { id: 'rust-opt-10', machineId: 'mac', threads: 16, seconds: 24.591098480000003, peakRssBytes: 31207653376 },
    ]);
  });

  it('never relabels single-thread results or mixes server and Mac thread counts', () => {
    expect([WCA_BENCHMARK.count, WCA_BENCHMARK.passes, WCA_BENCHMARK.warmup]).toEqual([1000, 1, 0]);
    expect(BENCHMARK_MACHINES.map(machine => [machine.id, machine.threads])).toEqual([['mac', 16]]);
    expect(WCA_BENCHMARK.results.every(row => row.machineId === 'mac' && row.threads === 16)).toBe(true);
    expect(new Set(WCA_BENCHMARK.results.map(row => row.id)).size).toBe(WCA_BENCHMARK.results.length);
    for (const row of WCA_BENCHMARK.results) {
      expect(row.threads).toBe(BENCHMARK_MACHINES.find(machine => machine.id === row.machineId)?.threads);
      expect(COMPARISON_ROWS.some(solver => solver.id === row.id)).toBe(true);
    }
  });
});
