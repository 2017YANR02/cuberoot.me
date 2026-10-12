import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVm, swapDelta, restartKind, parseProcesses, memorySummary } from './mac-system-recorder.mts';

test('swap deltas never compare boots or silently accept a counter reset', () => {
  const vm = parseVm('Mach Virtual Memory Statistics: (page size of 16384 bytes)\nPages free: 20.\nSwapouts: 105.');
  const next = { boot: 'new', vm };
  assert.equal(swapDelta({ boot: 'old', vm }, next), null);
  assert.equal(swapDelta({ boot: 'new', vm: { pages: { Swapouts: 100 } } }, next), 81920);
  assert.equal(swapDelta({ boot: 'new', vm: { pages: { Swapouts: 106 } } }, next), null);
  assert.throws(() => parseVm('Permission denied'));
});
test('restart evidence does not claim a kernel crash or power failure', () => {
  assert.equal(restartKind(null, 'new'), 'first-install');
  assert.equal(restartKind({ boot: 'old' }, 'new'), 'new-boot-cause-unknown');
  assert.equal(restartKind({ boot: 'same' }, 'same'), 'recorder-interrupted-same-boot');
  assert.equal(restartKind({ boot: 'same', stoppedAt: 'now' }, 'same'), 'recorder-restart');
});
test('process snapshots retain units and parent IDs without storing full executable paths', () => {
  assert.deepEqual(parseProcesses('  23  1 2048 12.5 S /Applications/Example App.app/Contents/MacOS/Example App'),
    [{ pid: 23, ppid: 1, rssBytes: 2097152, cpuPercent: 12.5, state: 'S', name: 'Example App' }]);
});
test('free and file-backed estimates do not add inactive or purgeable pages again', () => {
  assert.deepEqual(memorySummary({ pageSize: 16384, pages: { 'Pages free': 10, 'File-backed pages': 20, 'Pages inactive': 30, 'Pages purgeable': 5 } }),
    { freeBytes: 163840, reclaimableEstimateBytes: 491520 });
  assert.equal(memorySummary(null), null);
});
