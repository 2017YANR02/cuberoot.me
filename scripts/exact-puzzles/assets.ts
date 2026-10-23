/** Immutable exact-puzzle corpora. Separate from the size-limited WCA snapshot. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { copyFile, lstat, mkdir, mkdtemp, open, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

export interface Asset { url: string; bytes: number; rows: number; sha256: string }
export interface Downloads { allStates: Asset; byDepth: Record<string, Asset> }
export interface DownloadManifest { schemaVersion: 1; puzzles: Record<string, Downloads>; inventorySha256?: string }
export interface FileRecord extends Asset { path: string }
export interface Archive { event: string; name: string; bytes: number; sha256: string; files: FileRecord[] }
export interface ReleaseManifest { schemaVersion: 1; kind: 'exact-puzzle-assets'; inventorySha256: string; downloads: DownloadManifest; archives: Archive[] }
export const PREFIX = '/stats/scramble/exact-puzzles/';
const digest = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
export const inventoryHash = (manifest: DownloadManifest) => digest(JSON.stringify(manifest.puzzles));
export function assetPath(event: string, asset: Asset, filename: string): string {
  assert(/^[a-z0-9_-]+$/.test(event) && /^(all\.csv|depth-\d+\.txt)\.gz$/.test(filename));
  assert(/^[a-f0-9]{64}$/.test(asset.sha256));
  return `scramble/exact-puzzles/${event}/${asset.sha256}/${filename}`;
}
export function records(manifest: DownloadManifest): Map<string, FileRecord[]> {
  assert.equal(manifest.schemaVersion, 1);
  const result = new Map<string, FileRecord[]>();
  for (const [event, d] of Object.entries(manifest.puzzles)) {
    const files = [[d.allStates, 'all.csv.gz'], ...Object.entries(d.byDepth).map(([depth, a]) => [a, `depth-${depth}.txt.gz`])] as [Asset, string][];
    result.set(event, files.map(([a, name]) => {
      const path = assetPath(event, a, name);
      assert.equal(a.url, `/stats/${path}`); assert(Number.isSafeInteger(a.bytes) && a.bytes > 0 && a.bytes <= 512 * 2 ** 20);
      assert(Number.isSafeInteger(a.rows) && a.rows > 0);
      return { ...a, path };
    }));
    assert.equal(Object.values(d.byDepth).reduce((n, a) => n + a.rows, 0), d.allStates.rows);
  }
  assert(result.size > 0 && result.size <= 100);
  assert([...result.values()].flat().reduce((n, a) => n + a.bytes, 0) <= 4 * 2 ** 30, 'Corpus exceeds the explicit 4 GiB publication budget');
  if (manifest.inventorySha256) assert.equal(manifest.inventorySha256, inventoryHash(manifest));
  return result;
}
export async function hashFile(file: string): Promise<string> {
  const hash = createHash('sha256'); for await (const chunk of createReadStream(file, { highWaterMark: 65536 })) hash.update(chunk);
  return hash.digest('hex');
}
export async function verifyFile(file: string, expected: { bytes: number; sha256: string }) {
  assert((await lstat(file)).isFile(), `Not a regular file: ${file}`);
  assert.equal((await stat(file)).size, expected.bytes, `Size mismatch: ${file}`);
  assert.equal(await hashFile(file), expected.sha256, `Checksum mismatch: ${file}`);
}
async function tar(args: string[]): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('tar', args, { env: { ...process.env, COPYFILE_DISABLE: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '', error = '';
    child.stdout.on('data', chunk => { output += chunk; if (output.length > 2 ** 20) child.kill('SIGKILL'); });
    child.stderr.on('data', chunk => { error = (error + chunk).slice(-8192); });
    child.on('error', reject); child.on('close', code => code === 0 ? resolvePromise(output) : reject(Error(`tar failed (${code}): ${error}`)));
  });
}
export async function prepare(manifest: DownloadManifest, statsRoot: string, output: string): Promise<{ path: string; manifest: ReleaseManifest }> {
  const grouped = records(manifest), archives: Archive[] = []; await mkdir(output, { recursive: true });
  const base = await realpath(statsRoot);
  for (const [event, files] of grouped) {
    for (const file of files) { const source = join(statsRoot, file.path); assert((await realpath(source)).startsWith(base + '/')); await verifyFile(source, file); }
    const temporary = join(output, `${event}.${process.pid}.partial.tar`);
    try {
      await tar(['--format=ustar', '-cf', temporary, '-C', statsRoot, '--', ...files.map(f => f.path)]);
      const sha256 = await hashFile(temporary), name = `exact-puzzles-${event}-${sha256}.tar`, bytes = (await stat(temporary)).size;
      const destination = join(output, name);
      try { await verifyFile(destination, { bytes, sha256 }); await rm(temporary); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; await rename(temporary, destination); }
      archives.push({ event, name, bytes, sha256, files });
    } finally { await rm(temporary, { force: true }); }
  }
  const value: ReleaseManifest = { schemaVersion: 1, kind: 'exact-puzzle-assets', inventorySha256: inventoryHash(manifest), downloads: manifest, archives };
  const bytes = JSON.stringify(value, null, 2) + '\n', path = join(output, `exact-puzzles-${digest(bytes)}.json`);
  await writeFile(path, bytes, { flag: 'wx' }).catch(async error => { if (error.code !== 'EEXIST') throw error; assert.equal(await readFile(path, 'utf8'), bytes); });
  return { path, manifest: value };
}
export async function readReleaseManifest(file: string): Promise<ReleaseManifest> {
  const handle = await open(file, 'r');
  let bytes: Buffer;
  try {
    const info = await handle.stat();
    assert(info.isFile() && info.size > 0 && info.size < 2 ** 20, 'Release manifest must be a bounded file below 1 MiB');
    // A fixed allocation also bounds a file that grows after fstat. Never call
    // readFile on a caller-supplied archive or gzip path before checking size.
    const buffer = Buffer.allocUnsafe(info.size + 1); let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length, null);
      if (!bytesRead) break;
      length += bytesRead;
    }
    assert.equal(length, info.size, 'Release manifest changed during the bounded read');
    bytes = buffer.subarray(0, length);
  } finally { await handle.close(); }
  assert.equal(file.split('/').at(-1), `exact-puzzles-${digest(bytes)}.json`, 'Manifest filename checksum differs');
  const value = JSON.parse(bytes.toString()) as ReleaseManifest;
  assert.equal(value.schemaVersion, 1); assert.equal(value.kind, 'exact-puzzle-assets');
  assert.equal(value.inventorySha256, inventoryHash(value.downloads));
  const groups = records(value.downloads); assert.equal(value.archives.length, groups.size);
  const seen = new Set<string>();
  for (const a of value.archives) {
    assert(!seen.has(a.event)); seen.add(a.event); assert.equal(a.name, `exact-puzzles-${a.event}-${a.sha256}.tar`);
    assert(/^[a-f0-9]{64}$/.test(a.sha256) && Number.isSafeInteger(a.bytes) && a.bytes > 0);
    assert.deepEqual(a.files, groups.get(a.event));
    assert(a.bytes <= a.files.reduce((n, f) => n + f.bytes, 0) + 2 ** 20, 'Unexpected tar overhead');
  }
  return value;
}
/** Restore into any stats root; verify the archive before safe extraction and each file before installation. */
export async function hydrate(manifestFile: string, archiveDirectory: string, statsRoot: string) {
  const manifest = await readReleaseManifest(manifestFile); await mkdir(statsRoot, { recursive: true });
  for (const archive of manifest.archives) {
    const file = resolve(archiveDirectory, archive.name); await verifyFile(file, archive);
    const names = (await tar(['-tf', file])).trimEnd().split('\n');
    assert.deepEqual(names, archive.files.map(f => f.path), 'Unexpected archive members');
    assert((await tar(['-tvf', file])).trimEnd().split('\n').every(line => line.startsWith('-')), 'Archive contains links or non-files');
    const temporary = await mkdtemp(join(tmpdir(), 'exact-puzzle-hydrate-'));
    try {
      await tar(['-xf', file, '-C', temporary, '--no-same-owner', '--no-same-permissions']);
      for (const expected of archive.files) await verifyFile(join(temporary, expected.path), expected);
      for (const expected of archive.files) {
        const destination = resolve(statsRoot, expected.path); await mkdir(dirname(destination), { recursive: true });
        assert((await realpath(dirname(destination))).startsWith((await realpath(statsRoot)) + '/'), 'Destination escaped stats root');
        try { await verifyFile(destination, expected); continue; }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
        const staged = `${destination}.${process.pid}.partial`; await copyFile(join(temporary, expected.path), staged); await rename(staged, destination);
      }
    } finally { await rm(temporary, { recursive: true, force: true }); }
  }
  return { events: manifest.archives.length, files: manifest.archives.reduce((n, a) => n + a.files.length, 0), inventorySha256: manifest.inventorySha256 };
}
