import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { appendUniqueById } from './common.js';

test('an interrupted CSV triplet append resumes by ID without duplicate rows', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cuberoot-stats-'));
  try {
    const target = join(dir, 'std.csv');
    const source = join(dir, 'new_std.csv');
    await writeFile(target, 'id,depth\n1001,4\n');
    await writeFile(source, 'id,depth\n1001,4\n1002,5\n');
    assert.equal(await appendUniqueById(target, source, true, true), 1);
    assert.equal(await appendUniqueById(target, source, true, true), 0);
    assert.equal(await readFile(target, 'utf8'), 'id,depth\n1001,4\n1002,5\n');

    const master = join(dir, 'master.txt');
    const newRows = join(dir, 'new.txt');
    await writeFile(newRows, '1001,R U\n1002,F R\n');
    assert.equal(await appendUniqueById(master, newRows, false, false), 2);
    assert.equal(await appendUniqueById(master, newRows, false, false), 0);
    assert.equal(await readFile(master, 'utf8'), '1001,R U\n1002,F R\n');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
