import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCandidateArguments, validateOriginalBaseline } from './rust-candidate-benchmark.mjs';

function fixture() {
  const cases = Array.from({ length: 100 }, (_, i) => ({ id: String(i + 1), scramble: 'R', sourceLine: i + 1 }));
  const reference = cases.map(item => ({ id: `r0_${item.id}`, length: 1, solution: "R'", cancelled: false }));
  const artifact = { files: { wrapper: '/baseline/module.mjs', wasm: '/baseline/module.wasm' }, sha256: { wrapper: 'a'.repeat(64), wasm: 'b'.repeat(64) } };
  const input = { schema: 'cuberoot.opt8.production-benchmark-input.v1', variant: 8, threads: 4, warmupCases: 0, measuredPasses: 1,
    engineOrder: ['original', 'rust'], machine: { platform: 'linux', hostname: 'fixture', node: 'v24' },
    corpusSha256: 'c'.repeat(64), tableSha256: 'd'.repeat(64), tableBytes: 7782727680, referenceSha256: 'e'.repeat(64),
    measurement: 'fixed public call', cases: cases.map(item => ({ ...item, htm: 1 })), artifacts: { original: artifact } };
  const ready = { type: 'ready', engine: 'original', threads: 4, warmupCases: 0, loaded: { sha256: input.tableSha256, bytes: input.tableBytes }, loadSeconds: 2 };
  const solved = cases.map((item, index) => ({ type: 'result', engine: 'original', index, id: item.id, threads: 4, length: 1,
    solution: "R'", seconds: 0.125, output: ["Solution found!: R'", 'Cube1 finished in 1'] }));
  const finished = { type: 'finished', engine: 'original', cases: 100, threads: 4, maxRssKiB: 2048 };
  const rows = solved.map(row => ({ ...row, expectedLength: 1, optimalLengthMatched: true, independentlyReplayed: false }));
  const report = { engine: 'original', cases: 100, threads: 4, measuredPasses: 1, warmupCases: 0, processExited: true,
    optimalLengthsMatched: 100, artifacts: artifact, totalSeconds: 12.5, peakRssBytes: 2097152, loadSeconds: 2 };
  return { current: structuredClone(input), old: { input, report, rows, raw: [ready, ...solved, finished], exit: { code: 0, signal: null },
    resources: [{ bootId: 'fixed-boot', treeRssBytes: 1, availableBytes: 12 * 1024 ** 3, pressureMetricUnavailable: true, fullPressureAvg10: null }],
    reference, casesSource: { corpusSha256: input.corpusSha256, cases } } };
}
test('Rust-only CLI requires an explicitly pinned original report and rejects repeat/engine options', () => {
  const argv = ['--fixture-input','/new/fixture.json','--baseline-dir','/old/run','--baseline-sha256','f'.repeat(64),'--out','/new/run'];
  assert.deepEqual(parseCandidateArguments(argv), {fixture:'/new/fixture.json',baseline:'/old/run',baselineSha256:'f'.repeat(64),out:'/new/run'});
  assert.throws(() => parseCandidateArguments(argv.slice(0,-2)));
  assert.throws(() => parseCandidateArguments([...argv,'--engine','original']));
  assert.throws(() => parseCandidateArguments(argv.map(value => value === 'f'.repeat(64) ? 'invalid' : value)));
});
test('retained original must contain exactly the ordered 100, successful exit, matching machine/boot/artifacts and raw times', () => {
  const valid = fixture(); assert.equal(validateOriginalBaseline(valid.old, valid.current, 'fixed-boot').totalSeconds, 12.5);
  const changes = [
    old => old.rows.pop(), old => { old.exit.code = 1; }, old => { old.exit.signal = 'SIGTERM'; },
    old => { old.input.machine.node = 'v25'; }, old => { old.resources[0].bootId = 'other-boot'; },
    old => { old.input.artifacts.original.sha256.wasm = '0'.repeat(64); }, old => { old.report.totalSeconds = 12; },
    old => { old.raw[1].id = '2'; }, old => { old.input.baselineReusedFrom = {}; }, old => { old.input.warmupCases = 100; },
  ];
  for (const change of changes) { const item = fixture(); change(item.old); assert.throws(() => validateOriginalBaseline(item.old, item.current, 'fixed-boot')); }
});
