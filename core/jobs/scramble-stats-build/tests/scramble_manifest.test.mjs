import { afterAll, expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { renameSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rename, rm, stat, utimes, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildManifest } from '../scramble_manifest.mjs';

const scratch = fileURLToPath(new URL('../../../../.tmp/png/', import.meta.url));
await mkdir(scratch, { recursive: true });
const temporary = await mkdtemp(path.join(scratch, 'manifest-test-'));
afterAll(() => rm(temporary, { recursive: true, force: true }));
let sequence = 0;
async function fixture() {
  const base = path.join(temporary, String(sequence++));
  const root = path.join(base, 'files');
  await mkdir(root, { recursive: true });
  return { root, cache: path.join(base, 'cache.json'), output: path.join(base, 'manifest.sha1') };
}
const hash = content => createHash('sha1').update(content).digest('hex');

test('cold, warm, excluded CSV, Unicode, empty file and full verification', async () => {
  const f = await fixture();
  await mkdir(path.join(f.root, 'steps'));
  await writeFile(path.join(f.root, 'steps/wca_scramble_steps.csv'), 'excluded');
  await writeFile(path.join(f.root, '中文 空格.txt'), '中文');
  await writeFile(path.join(f.root, '-option.txt'), '');
  expect(await buildManifest(f)).toMatchObject({ total: 2, hashed: 2, reused: 0 });
  const cold = await readFile(f.output, 'utf8');
  expect(cold).toBe(`${hash('')}  ./-option.txt\n${hash('中文')}  ./中文 空格.txt\n`);
  expect(await buildManifest(f)).toMatchObject({ total: 2, hashed: 0, reused: 2 });
  expect(await readFile(f.output, 'utf8')).toBe(cold);
  expect(await buildManifest({ ...f, force: true })).toMatchObject({ hashed: 2, reused: 0 });
  expect(await readFile(f.output, 'utf8')).toBe(cold);
});

test('new, deleted, renamed and same-size files with restored mtime match full scan', async () => {
  const f = await fixture();
  for (const name of ['changed', 'deleted', 'renamed', 'unchanged']) await writeFile(path.join(f.root, name), 'before');
  await buildManifest(f);
  const before = await stat(path.join(f.root, 'changed'));
  await new Promise(resolve => setTimeout(resolve, 20));
  await writeFile(path.join(f.root, 'changed'), 'after!');
  await utimes(path.join(f.root, 'changed'), before.atime, before.mtime);
  await rm(path.join(f.root, 'deleted'));
  await rename(path.join(f.root, 'renamed'), path.join(f.root, 'new-name'));
  await writeFile(path.join(f.root, 'added'), 'new');
  expect(await buildManifest(f)).toMatchObject({ total: 4, hashed: 3, reused: 1 });
  const cached = await readFile(f.output, 'utf8');
  expect(cached).toContain(`${hash('after!')}  ./changed\n`);
  expect(cached).not.toContain('./deleted');
  await buildManifest({ ...f, force: true });
  expect(await readFile(f.output, 'utf8')).toBe(cached);
});

test('large files are hashed correctly through the streaming path', async () => {
  const f = await fixture();
  const content = Buffer.alloc(2 * 1024 * 1024, 123);
  await writeFile(path.join(f.root, 'large'), content);
  expect(await buildManifest(f)).toMatchObject({ hashed: 1 });
  expect(await readFile(f.output, 'utf8')).toBe(`${hash(content)}  ./large\n`);
});

test.each(['{broken', 'null', '{}', 'checksum'])('invalid cache %s forces fresh hashes', async content => {
  const f = await fixture();
  await writeFile(path.join(f.root, 'file'), 'data');
  await buildManifest(f);
  if (content === 'checksum') {
    const saved = JSON.parse(await readFile(f.cache, 'utf8'));
    saved.entries.file[1] = '0'.repeat(40);
    content = JSON.stringify(saved);
  }
  await writeFile(f.cache, content);
  expect(await buildManifest(f)).toMatchObject({ hashed: 1, reused: 0 });
  expect(await readFile(f.output, 'utf8')).toBe(`${hash('data')}  ./file\n`);
});

test('empty directory and cache copied from another root', async () => {
  const f = await fixture();
  expect(await buildManifest(f)).toMatchObject({ total: 0 });
  expect(await readFile(f.output, 'utf8')).toBe('');
  await writeFile(path.join(f.root, 'file'), 'one');
  await buildManifest(f);
  const other = await fixture();
  await writeFile(path.join(other.root, 'file'), 'two');
  await writeFile(other.cache, await readFile(f.cache));
  expect(await buildManifest(other)).toMatchObject({ hashed: 1, reused: 0 });
});

test('invalid concurrency and output inside root fail before writing', async () => {
  const f = await fixture();
  await expect(buildManifest({ ...f, concurrency: 15 })).rejects.toThrow('1..14');
  await expect(buildManifest({ ...f, output: path.join(f.root, 'manifest') })).rejects.toThrow('outside');
});

test('source disappearance preserves previous cache and output', async () => {
  const f = await fixture();
  await writeFile(path.join(f.root, 'file'), 'data');
  await buildManifest(f);
  const cache = await readFile(f.cache, 'utf8');
  const output = await readFile(f.output, 'utf8');
  let removed = false;
  await expect(buildManifest({ ...f, force: true, progress(s) {
    if (s.phase === 'hashing' && !removed) {
      removed = true;
      renameSync(path.join(f.root, 'file'), path.join(f.root, 'moved'));
    }
  } })).rejects.toThrow();
  expect(await readFile(f.cache, 'utf8')).toBe(cache);
  expect(await readFile(f.output, 'utf8')).toBe(output);
});
