import { describe, expect, it } from 'vitest';
import { COMPARISON_ROWS } from '@/app/[lang]/dev/solvers/compare/comparison-data';
import { BENCHMARK_MACHINES, WCA_BENCHMARK } from '@/app/[lang]/dev/solvers/compare/unified-benchmark';
import { BENCHMARK_MANIFEST, CANDIDATES, COHORTS, CURRENT_RESULTS } from '@/app/[lang]/dev/solvers/compare/benchmark-data';
import { SERVER_RESULTS, summarizeServerResults } from '@/app/[lang]/dev/solvers/compare/server-results';

describe('multithread solver comparison evidence', () => {
  it('keeps the independently verified single-pass server comparison separate from Mac results', () => {
    expect(SERVER_RESULTS).not.toBeNull();
    const result = SERVER_RESULTS!;
    expect([result.cases, result.threads, result.passes, result.warmupCases]).toEqual([100, 4, 1, 0]);
    expect(result.order).toEqual(['wasm', 'native']);
    expect(result.environment).toEqual({ os: 'Linux', vcpus: 4, cpu: 'Intel(R) Xeon(R) Platinum' });
    expect(result.corpusSha256).toBe(COHORTS.opt8.corpusSha256);
    expect(result.table.sha256).toBe('0c742e0ad31d2c6bb428ae8658fa0fe88ffe2f7ac09072dbc3eaab8fcad850f1');
    expect(result.versions.wasm.artifactSha256).toBe('b600c699ab91c29f0bef5a14b7c2871bf1fb03d840b8813d5656266132433bb6');
    expect(result.versions.native.artifactSha256).toBe('0f6f481c5f98130d5295aaf2b073f2b642a5b8c4e271dfb60c19f42c6c9a50c0');
    expect([result.wasm.solveSeconds, result.native.solveSeconds]).toEqual([128.27944568900006, 87.9764358779999]);
    expect([result.wasm.startupSeconds, result.native.startupSeconds]).toEqual([106.013499621, 48.36550826599999]);
    for (const pass of [result.wasm, result.native]) {
      expect([pass.verifiedSolutions, pass.optimalLengthsMatched]).toEqual([100, 100]);
      expect(pass.rawSha256).toMatch(/^[a-f0-9]{64}$/);
    }
    const summary = summarizeServerResults(result);
    expect(summary.timeReductionPercent).toBeCloseTo(31.41813530182421, 10);
    expect(summary.rows.map(row => row.solvesPerSecond)).toEqual([0.7795481143755439, 1.1366680066316122]);
    expect(CURRENT_RESULTS.find(row => row.id === 'rust-opt8-native')?.seconds).toBe(26.402382370999998);
  });
  it('publishes complete verified runs and discloses the retained original prefix', () => {
    expect(Object.fromEntries(CURRENT_RESULTS.map(row => [row.id, row.seconds]))).toEqual({
      'rust-opt8-wasm': 33.36867566599999,
      'rust-opt8-wasm-coset': 39.667527956000015,
      'cube48opt8-wasm': 44.984614784999984,
      'rust-opt-9': 42.098461187999995,
      'cube48opt-wasm': 83.655909546,
      'rust-opt9-wasm': 99.88279715799992,
      'rust-opt9-wasm-quarter': 93.74520485000006,
      'rust-opt9-wasm-batch': 81.08118170599995,
      'rust-opt9-wasm-padded': 83.6733282019999,
      'rust-opt9-wasm-batch-padded': 84.30364284300008,
      'rust-opt9-wasm-select': 83.68332329199988,
      'nxopt-22': 296.600813958,
      'rust-opt8-native': 26.402382370999998,
      'rust-opt10-native': 26.134212438000034,
    });
    for (const row of BENCHMARK_MANIFEST.currentRunResults) {
      const candidate = CANDIDATES.find(candidate => candidate.id === row.id)!;
      const cohort = COHORTS[candidate.cohort];
      expect([row.cases, row.threads, row.passes, row.warmupCases, row.verifiedSolutions, row.optimalLengthsMatched])
        .toEqual([cohort.cases, cohort.threads, 1, 0, cohort.cases, cohort.cases]);
      expect(row.corpusSha256).toBe(cohort.corpusSha256);
      expect(row.tableBytes).toBe(row.id === 'nxopt-22' ? 7809269764
        : candidate.cohort === 'opt10' ? 31130911744 : candidate.cohort === 'opt8' ? 7782727680 : 15565455360);
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
  it('shows the fastest verified Opt9 WASM and preserves all other experiments in the download', () => {
    const visible = CANDIDATES.filter(row => row.cohort === 'opt9' && row.runtime === 'wasm' && !row.archived);
    expect(visible.map(row => [row.id, row.name])).toEqual([
      ['rust-opt9-wasm-batch', 'CubeRoot Opt9'], ['cube48opt-wasm', 'cube48opt9'],
    ]);
    expect(CANDIDATES.filter(row => row.cohort === 'opt9' && row.runtime === 'wasm' && row.archived).map(row => row.id))
      .toEqual(['rust-opt9-wasm-padded', 'rust-opt9-wasm-batch-padded', 'rust-opt9-wasm-select',
        'rust-opt9-wasm-quarter', 'rust-opt9-wasm-coset', 'rust-opt9-wasm']);
    const results = BENCHMARK_MANIFEST.currentRunResults;
    const newIds = ['rust-opt9-wasm-batch', 'rust-opt9-wasm-padded', 'rust-opt9-wasm-batch-padded', 'rust-opt9-wasm-select'];
    const candidates = results.filter(row => newIds.includes(row.id));
    expect(candidates.map(row => row.id)).toEqual(newIds);
    for (const row of candidates) {
      expect(row.nodes).toBeNull();
      expect(row.searchNodes).toBeTypeOf('number');
      expect(row.comparison).toMatchObject({baselineId: 'cube48opt-wasm', baselineSeconds: 83.655909546,
        matchedProtocol: true, sameMachine: true, sameTable: true, baselineRerun: false,
        baselineContinuation: {completedCases: 431, remainingCases: 569, sessions: 2}});
      expect(row.retainedRustComparison).toMatchObject({baselineId: 'rust-opt9-wasm-quarter-fixed',
        baselineSeconds: 93.74520485000006, baselineRerun: false});
      expect(row.matchedExhaustedShardWork).toMatchObject({cases: 1000, workEquivalent: true,
        differingShards: 0, exhaustedLayers: 17708, differingLayers: 0});
      expect(row.reportSha256).toMatch(/^[a-f0-9]{64}$/);
    }
    expect(candidates.map(row => [row.candidateBuildEvidence?.opt9BatchEnabled,
      row.candidateBuildEvidence?.paddedStateLayout, row.candidateBuildEvidence?.opt9SelectEnabled]))
      .toEqual([[true, 0, false], [false, 4200468, false], [true, 4200468, false], [true, 0, true]]);
    const rust = candidates[0];
    expect(rust).toMatchObject({seconds: 81.08118170599995, peakRssBytes: 16191668224,
      processTreePeakRssBytes: 16442589184, searchNodes: 9983318127,
      artifactSha256: '17d66df66935894e28a5ee0c7494853f79444c96eac3b9b2b9d4832eedcfb545'});
    expect(rust.comparison).toMatchObject({rustFasterOnThisRun: true, rustTimeReductionPercent: 3.077759663331714});
    expect(results.filter(row => CANDIDATES.find(candidate => candidate.id === row.id)?.cohort === 'opt9'
      && row.engine !== 'rust-native').every(row => row.nodes === null)).toBe(true);
  });
  it('separates Opt8 and Opt9 without substituting server results', () => {
    expect(Object.values(COHORTS).map(row => [row.id, row.tableBudgetGB, row.cases, row.threads]))
      .toEqual([['opt10', 32, 1000, 16], ['opt8', 8, 100, 4], ['opt9', 16, 1000, 16]]);
    expect(CURRENT_RESULTS.find(row => row.id === 'rust-opt8-wasm'))
      .toMatchObject({ seconds: 33.36867566599999, peakRssBytes: 7965376512, processTreePeakRssBytes: 8175861760 });
    expect(CANDIDATES.find(row => row.id === 'cube48opt8-wasm')?.cohort).toBe('opt8');
    expect(BENCHMARK_MANIFEST.currentRunResults.find(row => row.id === 'cube48opt8-wasm'))
      .toMatchObject({
        cases: 100, threads: 4, passes: 1, warmupCases: 0,
        seconds: 44.984614784999984, peakRssBytes: 8076361728,
        processTreePeakRssBytes: 8399142912,
        corpusSha256: COHORTS.opt8.corpusSha256,
        originalEvidence: { upstreamWasmUnchanged: true },
        comparison: {
          baselineId: 'rust-opt8-wasm', baselineSeconds: 33.36867566599999,
          matchedProtocol: true, sameMachine: true, sameTable: true, baselineRerun: false,
        },
      });
    expect(CANDIDATES.every(row => row.cohort in COHORTS)).toBe(true);
  });
  it('retains complete engine-specific node counters without equating their definitions', () => {
    expect(Object.fromEntries(CURRENT_RESULTS.map(row => [row.id, row.nodeCounter.value]))).toEqual({
      'rust-opt-9': 9814932764,
      'cube48opt-wasm': 13926702773,
      'rust-opt9-wasm': 13448458239,
      'rust-opt9-wasm-quarter': 9954986953,
      'rust-opt8-wasm': 1717133808,
      'rust-opt8-wasm-coset': 1716985601,
      'cube48opt8-wasm': 2384839394,
      'rust-opt9-wasm-batch': 9983318127,
      'rust-opt9-wasm-padded': 9974653073,
      'rust-opt9-wasm-batch-padded': 9978389143,
      'rust-opt9-wasm-select': 9994096263,
      'nxopt-22': 2673464088,
      'rust-opt8-native': 1837689891,
      'rust-opt10-native': 5040774271,
    });
    for (const row of BENCHMARK_MANIFEST.currentRunResults) {
      expect(row.nodeCounter.cases).toBe(row.cases);
      expect(row.nodeCounter.rawSha256).toBe(row.rawSha256);
      expect(row.nodeCounter.definition).toBe(row.engine === 'original-wasm'
        ? 'cube48opt-active-query-slots-v1' : row.engine === 'nxopt-native' ? 'nxopt-evals-v1' : 'rust-context-visits-v1');
      if (row.searchNodes !== undefined) expect(row.nodeCounter.value).toBe(row.searchNodes);
      if (row.nodes !== null) expect(row.nodeCounter.value).toBe(row.nodes);
    }
    expect(BENCHMARK_MANIFEST.currentRunResults.find(row => row.id === 'cube48opt-wasm')?.nodeCounter)
      .toMatchObject({ value: 13926702773, inactiveContextSlots: 5223659, previousDepthActiveVisits: 7402568428 });
    expect(BENCHMARK_MANIFEST.currentRunResults.find(row => row.id === 'cube48opt8-wasm')?.nodeCounter)
      .toMatchObject({ value: 2384839394, inactiveContextSlots: 155654, previousDepthActiveVisits: 1157031384 });
    expect(Object.keys(BENCHMARK_MANIFEST.nodeCounters.definitions))
      .toEqual(['rust-context-visits-v1', 'cube48opt-active-query-slots-v1', 'nxopt-evals-v1']);
  });
  it('records the slower Opt8 experiment and excludes the unmeasured Opt9 attempt', () => {
    expect(CURRENT_RESULTS.find(row => row.id === 'rust-opt8-wasm-coset'))
      .toMatchObject({ cases: 100, threads: 4, seconds: 39.667527956000015, verifiedSolutions: 100 });
    expect(CANDIDATES.find(row => row.id === 'rust-opt8-wasm-coset')?.status?.en)
      .toBe('Slower experiment · not promoted');
    expect(CANDIDATES.find(row => row.id === 'rust-opt8-wasm-coset')?.archived).toBe(true);
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
