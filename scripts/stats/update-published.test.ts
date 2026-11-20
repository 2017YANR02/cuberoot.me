import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parsePublishedArgs, runLocalForPublish } from './update-published.js';
import { CommandExitError, coreDir, run, tsx } from './common.js';
import { baselineArtifactAction, baselineArtifactChanges } from './shared-publication-baseline.js';

test('daily command publishes through Release; local command remains explicit', () => {
  const packageJson = JSON.parse(readFileSync(fileURLToPath(new URL('../../core/package.json', import.meta.url)), 'utf8'));
  assert.equal(packageJson.scripts['stats:scramble'], 'tsx ../scripts/stats/update-published.ts --publish');
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

test('completed local artifacts with pending puzzle states can proceed to publish', async () => {
  const warnings: string[] = [];
  const warn = console.warn;
  console.warn = message => { warnings.push(String(message)); };
  try {
    await runLocalForPublish(['--jobs', 'puzzles'], async (script, args, cwd) => {
      assert.deepEqual(args, ['--jobs', 'puzzles']);
      assert.equal(cwd, coreDir);
      throw new CommandExitError(tsx, [script, ...args], 2);
    });
  } finally { console.warn = warn; }
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /待解\/待定/);
});

test('fatal errors and unrelated exit 2 still block publishing', async () => {
  for (const kind of ['failed', 'other-script', 'other-command', 'untyped']) {
    let failure: Error;
    await assert.rejects(runLocalForPublish([], async (script) => {
      failure = kind === 'untyped' ? new Error('tsx exited with 2')
        : new CommandExitError(kind === 'other-command' ? 'other' : tsx,
          [kind === 'other-script' ? 'other.ts' : script], kind === 'failed' ? 1 : 2);
      throw failure;
    }), error => error === failure);
  }
});

test('command failures preserve the actual exit code and script identity', async () => {
  const args = ['-e', 'process.exit(2)'];
  await assert.rejects(run(process.execPath, args, coreDir), error => {
    assert.ok(error instanceof CommandExitError);
    assert.equal(error.code, 2);
    assert.equal(error.command, process.execPath);
    assert.deepEqual(error.args, args);
    return true;
  });
});

test('cross-machine baseline refresh replaces old published artifacts and protects local work', () => {
  const before = new Map([['same.json', 'same'], ['replace.json', 'old'], ['retired.json', 'known']]);
  const after = new Map([['same.json', 'same'], ['replace.json', 'new'], ['added.json', 'present']]);
  const changes = new Map(baselineArtifactChanges(before, after).map(change => [change.path, change]));
  assert.equal(changes.size, 3);
  assert.equal(baselineArtifactAction(changes.get('replace.json')!, 'old'), 'fetch');
  assert.equal(baselineArtifactAction(changes.get('replace.json')!, 'new'), 'keep');
  assert.equal(baselineArtifactAction(changes.get('replace.json')!), 'fetch');
  assert.equal(baselineArtifactAction(changes.get('retired.json')!, 'known'), 'archive');
  assert.equal(baselineArtifactAction(changes.get('retired.json')!), 'keep');
  assert.equal(baselineArtifactAction(changes.get('added.json')!), 'fetch');
  assert.throws(() => baselineArtifactAction(changes.get('replace.json')!, 'unpublished'), /unpublished changes/);
  assert.throws(() => baselineArtifactAction(changes.get('retired.json')!, 'unpublished'), /unpublished changes/);
  assert.throws(() => baselineArtifactAction(changes.get('added.json')!, 'unpublished'), /unpublished changes/);
});
