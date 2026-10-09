import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';
import { parseManifest, publishScrambleIncremental } from './publish-static.js';

test('manifest parser rejects traversal, duplicates, and malformed rows', () => {
  const hash = 'a'.repeat(40);
  assert.equal(parseManifest(`${hash}  ./one.txt\n${hash} *./中文 空格.txt\n`).size, 2);
  for (const bad of [`${hash}  ./../escape\n`, `${hash}  ./nested/./file\n`, `${hash}  ./back\\slash\n`,
    `${hash}  ./same\n${hash}  ./same\n`, 'broken\n']) assert.throws(() => parseManifest(bad));
});

test('delta tar preserves unusual names', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'scramble-tar-test-'));
  try {
    const root = join(dir, 'scramble');
    const unpacked = join(dir, 'unpacked');
    const manifest = join(dir, 'baseline.sha1');
    await mkdir(root); await mkdir(unpacked);
    await writeFile(manifest, '');
    const names = ['-option.txt', '中文 空格.txt', "quote'file.txt", ' leading.txt'];
    for (const name of names) await writeFile(join(root, name), `contents:${name}`);
    await publishScrambleIncremental({ root, manifest, host: 'fixture', destination: '/tmp/scramble',
      command: async (program, args) => {
        if (program === 'tar') await promisify(execFile)(program, args);
        if (program === 'scp') await promisify(execFile)('tar', ['-xzf', args[0], '-C', unpacked]);
      } });
    for (const name of names) assert.equal(await readFile(join(unpacked, name), 'utf8'), `contents:${name}`);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('dry run does not create a persistent hash cache or baseline', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'scramble-dry-test-'));
  try {
    const root = join(dir, 'scramble');
    const manifest = join(dir, 'baseline.sha1');
    await mkdir(root);
    await writeFile(join(root, 'file.txt'), 'data');
    await publishScrambleIncremental({ root, manifest, dryRun: true });
    await assert.rejects(() => access(manifest));
    await assert.rejects(() => access(`${manifest}.cache.json`));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('publisher preserves baseline on remote failure and sends exact UTF-8 LF deletion list', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'scramble-publisher-test-'));
  try {
    const root = join(dir, 'scramble');
    const manifest = join(dir, 'baseline.sha1');
    await mkdir(root);
    await writeFile(join(root, '中文 空格.txt'), 'new');
    const old = `${'b'.repeat(40)}  ./gone.txt\n`;
    await writeFile(manifest, old);
    const calls: Array<{ program: string; args: string[]; input?: string }> = [];
    const run = async (program: string, args: string[], input?: string) => {
      calls.push({ program, args, input });
      if (program === 'ssh' && input) throw new Error('simulated delete failure');
    };
    await assert.rejects(() => publishScrambleIncremental({ root, manifest, host: 'fixture', destination: '/tmp/scramble', command: run }));
    assert.equal(await readFile(manifest, 'utf8'), old);
    assert.equal(calls.at(-1)?.input, './gone.txt\n');
    calls.length = 0;
    const result = await publishScrambleIncremental({ root, manifest, host: 'fixture', destination: '/tmp/scramble',
      command: async (program, args, input) => { calls.push({ program, args, input }); } });
    assert.deepEqual(result.changed, ['./中文 空格.txt']);
    assert.deepEqual(result.deleted, ['./gone.txt']);
    assert.equal(await readFile(manifest, 'utf8'), `${createHash('sha1').update('new').digest('hex')}  ./中文 空格.txt\n`);
    calls.length = 0;
    await publishScrambleIncremental({ root, manifest, dryRun: true, command: async () => { throw new Error('dry run executed remote command'); } });
  } finally { await rm(dir, { recursive: true, force: true }); }
});
