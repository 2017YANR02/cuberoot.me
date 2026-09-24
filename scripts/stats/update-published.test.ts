import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parsePublishedArgs } from './update-published.js';

test('production entry requires explicit publish flag and forwards only local options', () => {
  assert.throws(() => parsePublishedArgs(['--jobs', 'puzzles']), /--publish/);
  assert.throws(() => parsePublishedArgs(['--publish', '--unknown']), /Unknown/);
  assert.deepEqual(parsePublishedArgs(['--publish', '--publish-only', '--jobs', 'stages,puzzles', '--puzzles', 'sq1']), {
    jobs: ['stages', 'puzzles'], publishOnly: true, push: false,
    localArgs: ['--jobs', 'stages,puzzles', '--puzzles', 'sq1'],
  });
});
