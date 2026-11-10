import assert from 'node:assert/strict';
import test from 'node:test';
import { assertNoConflict } from './native-service-benchmark.mjs';

test('excludes an egg service or generator from a different artifact directory', () => {
  for (const command of ['serve', 'generate']) {
    const rows = [{pid:process.pid+100,argv:['/other-release/cuberoot-egg',command,'/other/table','4']}];
    assert.throws(() => assertNoConflict(rows, ['/candidate/cuberoot-egg']), /Another daemon or benchmark/);
    assert.doesNotThrow(() => assertNoConflict(rows, [], [rows[0].pid]));
  }
  assert.doesNotThrow(() => assertNoConflict([{pid:process.pid+100,argv:['/other/cuberoot-egg','--server-info']}], []));
});
