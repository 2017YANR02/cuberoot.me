import assert from 'node:assert/strict';
import test from 'node:test';
import { assertResources, conflictingProcesses, descendants, LIMITS, parseArguments, parseMemory } from './production-benchmark.mjs';

test('remote CLI requires fixed explicit absolute input and exclusive output; no hidden rounds/options', () => {
  assert.deepEqual(parseArguments(['--fixture-input','/tmp/f.json','--out','/tmp/new']), { fixture:'/tmp/f.json',out:'/tmp/new' });
  for (const args of [[], ['--fixture-input','relative','--out','/tmp/new'], ['--out','/tmp/new','--out','/tmp/old'],
    ['--fixture-input','/tmp/f.json','--repeat','3']]) assert.throws(() => parseArguments(args));
});
test('Linux memory uses MemAvailable once; remote swap is recorded rather than forbidden', () => {
  const sample = parseMemory('MemTotal: 16777216 kB\nMemAvailable: 12582912 kB\nSwapTotal: 4194304 kB\nSwapFree: 1048576 kB\n',
    'some avg10=0.10 avg60=0.02 avg300=0.01 total=345\nfull avg10=0.00 avg60=0.00 avg300=0.00 total=12\n');
  assert.equal(sample.availableBytes, 12 * 1024 ** 3); assert.equal(sample.swapFreeBytes, 1024 ** 3);
  assert.doesNotThrow(() => assertResources(sample, LIMITS.maxTreeRssBytes, true));
  assert.doesNotThrow(() => assertResources({ ...sample, availableBytes: LIMITS.reserveBytes }, LIMITS.maxTreeRssBytes));
  for (const change of [{ availableBytes: LIMITS.reserveBytes - 1 }, { fullPressureAvg10: 5.01 }])
    assert.throws(() => assertResources({ ...sample, ...change }, 0));
  assert.throws(() => assertResources(sample, LIMITS.maxTreeRssBytes + 1));
  assert.throws(() => parseMemory('MemTotal: 12 kB\n',''));
  const unavailable = parseMemory('MemTotal: 16777216 kB\nMemAvailable: 12582912 kB\nSwapTotal: 0 kB\nSwapFree: 0 kB\n', null);
  assert.equal(unavailable.pressureMetricUnavailable, true); assert.equal(unavailable.fullPressureAvg10, null);
  assert.equal(unavailable.fullPressureTotalUs, null); assert.doesNotThrow(() => assertResources(unavailable, 0, true));
  assert.throws(() => assertResources({ ...unavailable, fullPressureAvg10: 0 }, 0), /not be represented as zero/);
  assert.throws(() => assertResources({ ...unavailable, availableBytes: LIMITS.reserveBytes - 1 }, 0));
});
test('RSS counts process IDs, not four worker threads; all actual daemon spellings conflict', () => {
  const rows = [
    {pid:1,ppid:0,rssBytes:100,command:'node production-benchmark.mjs'},
    {pid:2,ppid:1,rssBytes:800,command:'node wasm-benchmark.mjs --worker input rust'},
    {pid:3,ppid:2,rssBytes:10,command:'child'},
    {pid:4,ppid:0,rssBytes:800,command:'node /api/dist/cubeopt/solve-daemon.mjs'},
    {pid:5,ppid:0,rssBytes:800,command:'node /api/cubeopt-daemon.mjs'},
    {pid:6,ppid:0,rssBytes:800,command:'node /api/cubeopt/daemon.mjs'},
    {pid:7,ppid:0,rssBytes:800,command:'node /other-parent/remote/rust-candidate-benchmark.mjs --out /different/run'},
  ];
  assert.deepEqual(descendants(rows,2).map(r=>r.pid),[2,3]);
  assert.equal(descendants(rows,2).reduce((sum,r)=>sum+r.rssBytes,0),810);
  assert.deepEqual(conflictingProcesses(rows,1,[2,3]).map(r=>r.pid),[4,5,6,7]);
});
