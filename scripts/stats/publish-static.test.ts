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
        if (program === 'scp' && args[0].endsWith('.tgz')) await promisify(execFile)('tar', ['-xzf', args[0], '-C', unpacked]);
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

test('publisher preserves baseline on remote failure and sends expected hashes for updates and deletions', async () => {
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
    assert.deepEqual(JSON.parse(calls.at(-1)!.input!), [
      { path: './中文 空格.txt', before: null, after: createHash('sha1').update('new').digest('hex') },
      { path: './gone.txt', before: 'b'.repeat(40), after: null },
    ]);
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

test('direct static publication never uploads or deletes Release-owned files, even on first publish', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'scramble-release-owner-'));
  try {
    const root = join(dir, 'scramble'), manifest = join(dir, 'baseline.sha1');
    await mkdir(root); await mkdir(join(root, 'comp_steps'));
    await writeFile(join(root, 'distribution.json'), '{}');
    await writeFile(join(root, 'comp_steps/example.json'), '{}');
    const calls: { program: string; args: string[]; input?: string }[] = [];
    const command = async (program: string, args: string[], input?: string) => { calls.push({ program, args, input }); };
    const first = await publishScrambleIncremental({ root, manifest, command });
    assert.deepEqual(first.changed, ['./comp_steps/example.json']);
    assert(!calls.some(c => c.args.some(a => /scramble\.new|scramble\.prev|mv scramble/.test(a))));
    await writeFile(manifest, `${'a'.repeat(40)}  ./distribution.json\n${'b'.repeat(40)}  ./no_bar.json\n`);
    const next = await publishScrambleIncremental({ root, manifest, command });
    assert.deepEqual(next.deleted, []); assert.deepEqual(next.changed, ['./comp_steps/example.json']);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('overlapping publishers keep their own uploads and apply deletion in one locked command', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'scramble-publish-overlap-'));
  try {
    const uploads = new Set<string>(), applies: string[] = [];
    let releaseFirst!: () => void, firstUploaded!: () => void;
    const blocked = new Promise<void>(resolve => { releaseFirst = resolve; });
    const uploaded = new Promise<void>(resolve => { firstUploaded = resolve; });
    const prepare = async (id: string) => {
      const root = join(dir, id), manifest = join(dir, `${id}.sha1`);
      await mkdir(root); await writeFile(join(root, 'state.txt'), id);
      await writeFile(manifest, `${'b'.repeat(40)}  ./gone.txt\n`);
      return { root, manifest };
    };
    const firstOptions = await prepare('first'), secondOptions = await prepare('second');
    const command = (wait: boolean) => async (program: string, args: string[], input?: string) => {
      if (program === 'scp' && args[0].endsWith('.tgz')) {
        assert(!uploads.has(args[1]), 'another publisher replaced this remote archive');
        uploads.add(args[1]);
        if (wait) { firstUploaded(); await blocked; }
      }
      if (program === 'ssh') {
        applies.push(args[1]);
        assert.match(args[1], /flock -w 120 \/tmp\/cuberoot-scramble-static.lock/);
        assert.match(args[1], /node .*\.tgz\.ts/);
        assert.deepEqual(JSON.parse(input!).find((c: { path: string }) => c.path === './gone.txt'), { path: './gone.txt', before: 'b'.repeat(40), after: null });
      }
    };
    const first = publishScrambleIncremental({ ...firstOptions, command: command(true) });
    await uploaded;
    try {
      await assert.rejects(publishScrambleIncremental({ ...firstOptions, command: command(false) }), /Another data operation/);
      await publishScrambleIncremental({ ...secondOptions, command: command(false) });
    } finally { releaseFirst(); }
    await first;
    assert.equal(uploads.size, 2); assert.equal(applies.length, 2);
    assert.equal(await readFile(firstOptions.manifest, 'utf8'), `${createHash('sha1').update('first').digest('hex')}  ./state.txt\n`);
    assert.equal(await readFile(secondOptions.manifest, 'utf8'), `${createHash('sha1').update('second').digest('hex')}  ./state.txt\n`);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
