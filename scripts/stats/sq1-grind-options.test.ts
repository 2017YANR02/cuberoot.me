import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseLocalArgs } from './update-local.js';
import { parsePublishedArgs } from './update-published.js';
import { sq1WcaPartial } from './puzzles.js';

test('daily and local parsers preserve the opt-in SQ1 grind skip without skipping other work', () => {
  assert.equal(parseLocalArgs([]).skipSq1Grind, false);
  const published = parsePublishedArgs(['--publish', '--push', '--jobs', 'puzzles', '--skip-sq1-grind']);
  assert.deepEqual(published.localArgs, ['--jobs', 'puzzles', '--skip-sq1-grind']);
  const local = parseLocalArgs(published.localArgs);
  assert.equal(local.skipSq1Grind, true);
  assert.equal(local.skipSolve333, false);
  assert.equal(local.dryRun, false);
  assert.deepEqual(local.jobs, ['puzzles']);
  assert(local.puzzles.includes('sq1'));
  assert.throws(() => parseLocalArgs(['--skip-sq1-grind', 'true']), /Unknown option/);
});

test('skipped SQ1 retry retains the exact pending count and never invokes the grinder', async () => {
  const grind = async () => { throw new Error('Grinder must not run'); };
  assert.equal(await sq1WcaPartial(1, true, grind), 'SQ1 WCA still has 1 unresolved states');
  assert.equal(await sq1WcaPartial(7, true, grind), 'SQ1 WCA still has 7 unresolved states');
  assert.equal(await sq1WcaPartial(0, false, grind), undefined);
});

test('normal SQ1 retry reports remaining states and propagates real failures', async () => {
  assert.equal(await sq1WcaPartial(7, false, async () => 2), 'SQ1 WCA still has 2 unresolved states');
  assert.equal(await sq1WcaPartial(7, false, async () => 0), undefined);
  await assert.rejects(sq1WcaPartial(7, false, async () => { throw new Error('solver failure'); }), /solver failure/);
});
