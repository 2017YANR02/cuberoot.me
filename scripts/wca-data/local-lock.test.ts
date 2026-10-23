import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withLocalLock } from './local-lock.ts';

test('overlapping baseline operations cannot replace each other and failures release the lock', async t => {
  const root = mkdtempSync(join(tmpdir(), 'stats-lock-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const lock = join(root, 'baseline.lock');
  await withLocalLock(lock, async () => {
    const owner = readFileSync(lock, 'utf8');
    await assert.rejects(withLocalLock(lock, () => { throw new Error('must not run'); }), /Another data operation/);
    assert.equal(readFileSync(lock, 'utf8'), owner);
  });
  assert(!existsSync(lock));
  await assert.rejects(withLocalLock(lock, () => { throw new Error('failed publication'); }), /failed publication/);
  assert(!existsSync(lock));
});

test('an old operation cannot release a replacement owner or steal an interrupted lock', async t => {
  const root = mkdtempSync(join(tmpdir(), 'stats-lock-owner-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const lock = join(root, 'baseline.lock');
  await withLocalLock(lock, () => { writeFileSync(lock, 'replacement'); });
  assert.equal(readFileSync(lock, 'utf8'), 'replacement');
  await assert.rejects(withLocalLock(lock, () => {}), /verify the recorded owner/);
});
