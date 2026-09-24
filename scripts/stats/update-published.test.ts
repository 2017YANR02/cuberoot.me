import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parsePublishedArgs } from './update-published.js';

test('daily command publishes and pushes; local command remains explicit', () => {
  const packageJson = JSON.parse(readFileSync(fileURLToPath(new URL('../../core/package.json', import.meta.url)), 'utf8'));
  assert.equal(packageJson.scripts['stats:scramble'], 'tsx ../scripts/stats/update-published.ts --publish --push');
  assert.equal(packageJson.scripts['stats:scramble:local'], 'tsx ../scripts/stats/update-local.ts');
});

test('production entry requires explicit publish flag and forwards only local options', () => {
  assert.throws(() => parsePublishedArgs(['--jobs', 'puzzles']), /--publish/);
  assert.throws(() => parsePublishedArgs(['--publish', '--unknown']), /Unknown/);
  assert.deepEqual(parsePublishedArgs(['--publish', '--publish-only', '--jobs', 'stages,puzzles', '--puzzles', 'sq1']), {
    jobs: ['stages', 'puzzles'], publishOnly: true, push: false,
    localArgs: ['--jobs', 'stages,puzzles', '--puzzles', 'sq1'],
  });
});
