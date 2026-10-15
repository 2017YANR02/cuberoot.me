import { describe, expect, it } from 'vitest';
import { COMPARISON_ROWS } from '@/app/[lang]/dev/solvers/compare/comparison-data';
import { BENCHMARK_MACHINES, WCA_BENCHMARK } from '@/app/[lang]/dev/solvers/compare/unified-benchmark';
import { BENCHMARK_MANIFEST, CANDIDATES, COHORTS, CURRENT_RESULTS } from '@/app/[lang]/dev/solvers/compare/benchmark-data';

describe('multithread solver comparison evidence', () => {
  it('publishes complete verified runs and discloses the retained original prefix', () => {
    expect(Object.fromEntries(CURRENT_RESULTS.map(row => [row.id, row.seconds]))).toEqual({
      'rust-opt8-wasm': 33.36867566599999,
      'rust-opt8-wasm-coset': 39.667527956000015,
      'rust-opt-9': 42.098461187999995,
      'cube48opt-wasm': 83.655909546,
      'rust-opt9-wasm': 99.88279715799992,
      'rust-opt9-wasm-quarter': 93.74520485000006,
    });
    for (const row of BENCHMARK_MANIFEST.currentRunResults) {
      const candidate = CANDIDATES.find(candidate => candidate.id === row.id)!;
      const cohort = COHORTS[candidate.cohort];
      expect([row.cases, row.threads, row.passes, row.warmupCases, row.verifiedSolutions, row.optimalLengthsMatched])
        .toEqual([cohort.cases, cohort.threads, 1, 0, cohort.cases, cohort.cases]);
      expect(row.corpusSha256).toBe(cohort.corpusSha256);
      expect(row.tableBytes).toBe(candidate.cohort === 'opt8' ? 7782727680 : 15565455360);
      expect(row.swapoutsDelta).toBe(0);
    }
    expect(BENCHMARK_MANIFEST.incompleteRuns).toEqual([{
      id: 'rust-opt9-wasm-coset', cohort: 'opt9', completedCases: 0, plannedCases: 1000,
      reason: 'Memory protection: Swapouts increased from 16 to 48 during table loading',
      phase: 'table-loading', stoppedAt: '2026-10-15T06:59:36.852Z', performanceResult: false,
    }]);
    expect(BENCHMARK_MANIFEST.continuation).toMatchObject({retainedCases:431,continuedCases:569,sessions:2});
    expect(CURRENT_RESULTS.find(r => r.id === 'cube48opt-wasm')?.continuation)
      .toMatchObject({completedCases:431,remainingCases:569,sessions:2});
  });
  it('separates Opt8 and Opt9 without substituting server results', () => {
    expect(Object.values(COHORTS).map(row => [row.id, row.tableBudgetGB, row.cases, row.threads]))
      .toEqual([['opt8', 8, 100, 4], ['opt9', 16, 1000, 16]]);
    expect(CURRENT_RESULTS.find(row => row.id === 'rust-opt8-wasm'))
      .toMatchObject({ seconds: 33.36867566599999, peakRssBytes: 7965376512, processTreePeakRssBytes: 8175861760 });
    expect(CANDIDATES.find(row => row.id === 'cube48opt8-wasm')?.cohort).toBe('opt8');
    expect(CURRENT_RESULTS.find(row => row.id === 'cube48opt8-wasm')).toBeUndefined();
    expect(CANDIDATES.every(row => row.cohort in COHORTS)).toBe(true);
  });
  it('records the slower Opt8 experiment and excludes the unmeasured Opt9 attempt', () => {
    expect(CURRENT_RESULTS.find(row => row.id === 'rust-opt8-wasm-coset'))
      .toMatchObject({ cases: 100, threads: 4, seconds: 39.667527956000015, verifiedSolutions: 100 });
    expect(CANDIDATES.find(row => row.id === 'rust-opt8-wasm-coset')?.status?.en)
      .toBe('Slower experiment · not promoted');
    expect(CURRENT_RESULTS.find(row => row.id === 'rust-opt9-wasm-coset')).toBeUndefined();
    expect(CANDIDATES.find(row => row.id === 'rust-opt9-wasm-coset')?.status?.en)
      .toBe('Memory protection stopped run');
  });
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
      { id: 'rust-opt-9', machineId: 'mac', threads: 16, seconds: 43.23124978399998, peakRssBytes: 15638528000 },
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
