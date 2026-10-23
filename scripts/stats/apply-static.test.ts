import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyStaticDelta } from './apply-static.ts';
const sha = (value: string) => createHash('sha1').update(value).digest('hex');
function fixture(t: any) {
  const root = mkdtempSync(join(tmpdir(), 'static-apply-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const live = join(root, 'live'), source = join(root, 'source'), archive = join(root, 'delta.tgz');
  mkdirSync(live); mkdirSync(source);
  return { root, live, source, archive };
}
function pack(source: string, archive: string, names: string[]) {
  execFileSync('tar', ['--format=ustar', '-czf', archive, '-C', source, ...names], { env: { ...process.env, COPYFILE_DISABLE: '1' } });
}

test('static publication rejects a stale writer before changing or deleting any file', async t => {
  const { live, source, archive } = fixture(t);
  writeFileSync(join(live, 'first.txt'), 'old'); writeFileSync(join(live, 'second.txt'), 'newer');
  writeFileSync(join(source, 'first.txt'), 'ours'); pack(source, archive, ['./first.txt']);
  await assert.rejects(applyStaticDelta(live, archive, [
    { path: './first.txt', before: sha('old'), after: sha('ours') },
    { path: './second.txt', before: sha('old'), after: null },
  ]), /Concurrent static update/);
  assert.equal(readFileSync(join(live, 'first.txt'), 'utf8'), 'old');
  assert.equal(readFileSync(join(live, 'second.txt'), 'utf8'), 'newer');
  assert.deepEqual(readdirSync(live), ['first.txt', 'second.txt']);
});

test('static updates replace complete files atomically and replay without losing a newer generation', async t => {
  const { live, source, archive } = fixture(t), path = './中文 空格.txt';
  writeFileSync(join(live, path), 'old'); const oldInode = statSync(join(live, path)).ino;
  writeFileSync(join(source, path), 'new'); pack(source, archive, [path]);
  const delta = [{ path, before: sha('old'), after: sha('new') }];
  await applyStaticDelta(live, archive, delta);
  assert.equal(readFileSync(join(live, path), 'utf8'), 'new');
  assert.notEqual(statSync(join(live, path)).ino, oldInode);
  await applyStaticDelta(live, archive, delta);
  writeFileSync(join(live, path), 'newer');
  await assert.rejects(applyStaticDelta(live, archive, delta), /Concurrent static update/);
  assert.equal(readFileSync(join(live, path), 'utf8'), 'newer');
});

test('changed source, unknown existing data and symlinks fail without modifying live content', async t => {
  const { root, live, source, archive } = fixture(t);
  writeFileSync(join(live, 'file.txt'), 'old'); writeFileSync(join(source, 'file.txt'), 'changed while packing');
  pack(source, archive, ['./file.txt']);
  await assert.rejects(applyStaticDelta(live, archive, [{ path: './file.txt', before: sha('old'), after: sha('new') }]), /Source changed|source changed/);
  await assert.rejects(applyStaticDelta(live, archive, [{ path: './file.txt', before: null, after: sha('new') }]), /Concurrent static update/);
  mkdirSync(join(root, 'outside')); writeFileSync(join(root, 'outside/keep.txt'), 'keep');
  symlinkSync(join(root, 'outside'), join(live, 'link'));
  await assert.rejects(applyStaticDelta(live, null, [{ path: './link/keep.txt', before: sha('keep'), after: null }]), /Unmanaged static path/);
  assert.equal(readFileSync(join(root, 'outside/keep.txt'), 'utf8'), 'keep');
  assert.equal(readFileSync(join(live, 'file.txt'), 'utf8'), 'old');
});
