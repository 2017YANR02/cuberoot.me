/** Bounded offline full-state downloads. Concatenated gzip members are standard gzip.
 * At most 256 KiB per nonempty depth plus one CSV chunk is buffered; no corpus Blob.
 * Call only inside the serial measurement guard, while the puzzle's graph stays resident.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readSync, renameSync, statSync, truncateSync, unlinkSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

export interface ExactStateRow { depth: number; scramble: string }
export interface ResumableExactStates extends Iterable<ExactStateRow> {
  resume?(startRow: number): Iterable<ExactStateRow>;
  /** Digest of the distance data, metric and generator implementation. */
  resumeKey?: string;
}
export interface ExactDownloadAsset { url: string; bytes: number; rows: number; sha256: string }
export interface ExactDownloadSet { allStates: ExactDownloadAsset; byDepth: Record<string, ExactDownloadAsset> }
const client = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const statsRoot = resolve(client, '../../../stats');
const manifestPath = resolve(client, 'app/[lang]/scramble/stats/_data/exact-puzzle-downloads.json');
const CHUNK_BYTES = 256 * 1024;

function hashPrefix(file: string, bytes: number) {
  const fd = openSync(file, 'r'), hash = createHash('sha256'), buffer = Buffer.allocUnsafe(CHUNK_BYTES);
  try { for (let left = bytes; left > 0;) {
    const n = readSync(fd, buffer, 0, Math.min(buffer.length, left), null);
    assert(n > 0, 'Truncated export checkpoint'); hash.update(buffer.subarray(0, n)); left -= n;
  } }
  finally { closeSync(fd); }
  return hash;
}

export function writeExactStateDownloads(event: string, histogram: readonly number[], states: ResumableExactStates): ExactDownloadSet {
  assert(/^[a-z0-9_-]+$/.test(event));
  assert(histogram.length <= 128 && histogram.every(n => Number.isSafeInteger(n) && n >= 0));
  const directory = resolve(statsRoot, 'scramble/exact-puzzles', event);
  mkdirSync(directory, { recursive: true });
  const checkpointDirectory = resolve(client, '../../../.local/small-puzzle-distributions-20261023/download-checkpoints', event);
  mkdirSync(checkpointDirectory, { recursive: true });
  const progressFile = resolve(checkpointDirectory, 'progress.json');
  const evidenceFile = resolve(checkpointDirectory, 'export-evidence.json');
  if (!existsSync(progressFile) && states.resumeKey && existsSync(evidenceFile)) {
    const completed = JSON.parse(readFileSync(evidenceFile, 'utf8')) as {
      completed: boolean; event: string; histogram: number[]; resumeKey: string; downloads: ExactDownloadSet;
    };
    assert.equal(completed.completed, true); assert.equal(completed.event, event);
    assert.equal(completed.resumeKey, states.resumeKey, 'Completed export generator/data changed; preserve its evidence');
    assert.deepEqual(completed.histogram, histogram);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    assert.deepEqual(manifest.puzzles[event], completed.downloads, 'Completed export manifest changed');
    for (const asset of [completed.downloads.allStates, ...Object.values(completed.downloads.byDepth)]) {
      assert(asset.url.startsWith(`/stats/scramble/exact-puzzles/${event}/${asset.sha256}/`));
      const file = resolve(statsRoot, asset.url.slice('/stats/'.length));
      assert.equal(dirname(file), resolve(directory, asset.sha256)); assert.equal(statSync(file).size, asset.bytes);
      assert.equal(hashPrefix(file, asset.bytes).digest('hex'), asset.sha256, 'Completed download checksum mismatch');
    }
    return completed.downloads;
  }
  type Checkpoint = { event: string; histogram: number[]; resumeKey: string; rows: number; identityCount: number;
    files: Record<string, { file: string; rows: number; bytes: number; sha256: string }> };
  const previous: Checkpoint | undefined = existsSync(progressFile) ? JSON.parse(readFileSync(progressFile, 'utf8')) : undefined;
  if (previous) {
    assert(states.resume && states.resumeKey, 'This stream cannot resume; preserve and inspect its checkpoint');
    assert.equal(previous.event, event); assert.deepEqual(previous.histogram, histogram);
    assert.equal(previous.resumeKey, states.resumeKey, 'Export generator/data changed; preserve prior checkpoint');
  }
  const sinks = new Map<string, { file: string; buffer: string; rows: number; hash: ReturnType<typeof createHash> }>();
  const make = (name: string, header = '') => {
    const old = previous?.files[name];
    if (old) {
      assert(dirname(old.file) === checkpointDirectory && old.file.endsWith('.partial'));
      // A crash may occur between final file renames and manifest persistence.
      const file = existsSync(old.file) ? old.file : resolve(directory, old.sha256, name);
      assert(statSync(file).size >= old.bytes, 'Truncated export checkpoint');
      const hash = hashPrefix(file, old.bytes);
      assert.equal(hash.copy().digest('hex'), old.sha256, 'Export checkpoint checksum mismatch');
      if (file !== old.file) renameSync(file, old.file);
      truncateSync(old.file, old.bytes); // Discard only this task's uncommitted suffix.
      const sink = { file: old.file, buffer: '', rows: old.rows, hash }; sinks.set(name, sink); return sink;
    }
    assert(!previous, `Missing checkpoint member: ${name}`);
    const file = resolve(checkpointDirectory, `${name}.${process.pid}.partial`);
    assert(!existsSync(file), 'Preserve unfinished output before a retry');
    writeFileSync(file, '');
    const sink = { file, buffer: header, rows: 0, hash: createHash('sha256') }; sinks.set(name, sink); return sink;
  };
  const flush = (sink: ReturnType<typeof make>) => {
    if (sink.buffer) {
      const bytes = gzipSync(sink.buffer, { level: 1 }); appendFileSync(sink.file, bytes); sink.hash.update(bytes);
    }
    sink.buffer = '';
  };
  const append = (sink: ReturnType<typeof make>, line: string) => {
    sink.buffer += line; sink.rows++;
    if (sink.buffer.length >= CHUNK_BYTES) flush(sink);
  };
  const all = make('all.csv.gz', 'optimal_length,scramble\n');
  const depths = histogram.map((count, depth) => count ? make(`depth-${depth}.txt.gz`) : null);
  let identityCount = previous?.identityCount ?? 0;
  const checkpoint = () => {
    if (!states.resume || !states.resumeKey) return;
    const files: Checkpoint['files'] = {};
    for (const [name, sink] of sinks) {
      flush(sink);
      const fd = openSync(sink.file, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); }
      files[name] = { file: sink.file, rows: sink.rows, bytes: statSync(sink.file).size, sha256: sink.hash.copy().digest('hex') };
    }
    const temporary = `${progressFile}.${process.pid}.tmp`;
    writeFileSync(temporary, JSON.stringify({ event, histogram, resumeKey: states.resumeKey, rows: all.rows,
      identityCount, files, pid: process.pid, updatedAt: new Date().toISOString() }, null, 2) + '\n', { flush: true });
    renameSync(temporary, progressFile);
  };
  for (const { depth, scramble } of previous ? states.resume!(previous.rows) : states) {
    assert(Number.isInteger(depth) && depths[depth], `Invalid export depth ${depth}`);
    assert(!/[\r\n,"]/.test(scramble), 'Unexpected CSV/TXT token delimiter');
    // A partial training target need not contain the fully solved cube.
    if (!scramble) identityCount++;
    append(all, `${depth},${scramble}\n`);
    append(depths[depth]!, `${scramble}\n`);
    if (all.rows % 250000 === 0) checkpoint();
  }
  assert.equal(identityCount, 1, 'The all-state corpus must contain identity exactly once');
  assert.equal(all.rows, histogram.reduce((sum, n) => sum + n, 0));
  depths.forEach((sink, depth) => assert.equal(sink?.rows ?? 0, histogram[depth]));
  checkpoint();
  const assets: Record<string, ExactDownloadAsset> = {};
  for (const [name, sink] of sinks) {
    flush(sink);
    const sha256 = sink.hash.copy().digest('hex');
    const file = resolve(directory, sha256, name);
    mkdirSync(dirname(file), { recursive: true });
    if (existsSync(file)) {
      assert.equal(statSync(file).size, statSync(sink.file).size);
      assert.equal(hashPrefix(file, statSync(file).size).digest('hex'), sha256);
    }
    renameSync(sink.file, file);
    assets[name] = { url: `/stats/scramble/exact-puzzles/${event}/${sha256}/${name}`, bytes: statSync(file).size,
      rows: sink.rows, sha256 };
  }
  const downloads = { allStates: assets['all.csv.gz'], byDepth: Object.fromEntries(histogram.flatMap((count, depth) =>
    count ? [[String(depth), assets[`depth-${depth}.txt.gz`]]] : [])) };
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { schemaVersion: 1, puzzles: {} };
  manifest.puzzles[event] = downloads;
  manifest.inventorySha256 = createHash('sha256').update(JSON.stringify(manifest.puzzles)).digest('hex');
  const temp = `${manifestPath}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(manifest, null, 2) + '\n', { flush: true }); renameSync(temp, manifestPath);
  if (existsSync(progressFile)) {
    const evidence = JSON.parse(readFileSync(progressFile, 'utf8'));
    writeFileSync(evidenceFile, JSON.stringify({ ...evidence, completed: true, downloads }, null, 2) + '\n', { flush: true });
    unlinkSync(progressFile);
  }
  return downloads;
}
