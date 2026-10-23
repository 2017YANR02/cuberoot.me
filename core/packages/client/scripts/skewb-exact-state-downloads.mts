/** Stream the existing public Skewb graph; only an explicit caller builds it. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { skewbGraph, SKEWB_MOVE_NAMES, type SkewbGraph } from '@cuberoot/puzzle-solvers/skewb';
import { productCoordinateAllStates, type ProductCoordinateMoves } from './exact-coordinate-bfs.mts';
import type { ProductCheckpointOptions } from './exact-coordinate-checkpoint.mts';

const sha256 = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
const sourceKey = () => createHash('sha256').update(readFileSync(new URL(import.meta.url)))
  .update(readFileSync(new URL(import.meta.resolve('@cuberoot/puzzle-solvers/skewb')))).digest('hex');
interface SavedSkewb {
  format: 'skewb-download-complete-v1'; sourceKey: string; firstCount: number; secondCount: number;
  total: number; histogram: number[];
  files: Record<'distance' | 'corners' | 'centers', { name: string; bytes: number; sha256: string }>;
}
function atomicWrite(file: string, data: string | Uint8Array) {
  const temp = `${file}.${process.pid}.tmp`, fd = openSync(temp, 'w', 0o600);
  try { writeFileSync(fd, data); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(temp, file);
}
function fromArrays(product: ProductCoordinateMoves, distance: Uint8Array, total: number) {
  const histogram: number[] = [];
  for (const depth of distance) {
    assert(depth !== 255);
    histogram[depth] = (histogram[depth] ?? 0) + 1;
  }
  assert.equal(histogram[0], 1, 'A unique fixed-frame root is required for these scrambles');
  assert.equal(distance[0], 0);
  assert.equal(total, 3149280);
  assert.equal(distance.length, total);
  assert.equal(product.firstCount * product.secondCount, total);
  assert.equal(histogram.reduce((sum, count) => sum + count, 0), total);
  return { histogram, total,
    allStates: productCoordinateAllStates(product, SKEWB_MOVE_NAMES, { distance, total }, move => move ^ 1) };
}

export function skewbAllStatesFromGraph(graph: SkewbGraph, options: ProductCheckpointOptions = {}) {
  const product: ProductCoordinateMoves = { firstCount: graph.corner.n, secondCount: graph.center.n,
    moveCount: SKEWB_MOVE_NAMES.length, firstMoves: graph.corner.moveTable, secondMoves: graph.center.moveTable };
  const result = fromArrays(product, graph.dist, graph.total);
  if (options.checkpointDirectory) {
    const directory = options.checkpointDirectory;
    mkdirSync(directory, { recursive: true });
    const arrays = { distance: graph.dist, corners: graph.corner.moveTable, centers: graph.center.moveTable };
    const files = {} as SavedSkewb['files'];
    for (const [key, array] of Object.entries(arrays) as [keyof typeof arrays, Uint8Array | Int32Array][]) {
      const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength), hash = sha256(bytes);
      const name = `${key}-${hash}.bin`;
      atomicWrite(join(directory, name), bytes);
      files[key] = { name, bytes: bytes.length, sha256: hash };
    }
    const saved: SavedSkewb = { format: 'skewb-download-complete-v1', sourceKey: sourceKey(),
      firstCount: product.firstCount, secondCount: product.secondCount, total: graph.total,
      histogram: result.histogram, files };
    atomicWrite(join(directory, 'skewb-download-checkpoint.json'), `${JSON.stringify(saved, null, 2)}\n`);
  }
  return result;
}

/** Restore completed arrays without BFS; otherwise use the public cached graph.
 * The caller schedules the first graph build explicitly in its serial guard. */
export function prepareSkewbStateDownloads(options: ProductCheckpointOptions = {}) {
  const directory = options.checkpointDirectory;
  const manifest = directory && join(directory, 'skewb-download-checkpoint.json');
  if (!manifest || !existsSync(manifest)) return skewbAllStatesFromGraph(skewbGraph(), options);
  const saved = JSON.parse(readFileSync(manifest, 'utf8')) as SavedSkewb;
  assert.equal(saved.format, 'skewb-download-complete-v1'); assert.equal(saved.sourceKey, sourceKey());
  function read(key: keyof SavedSkewb['files']) {
    const file = saved.files[key];
    assert.equal(basename(file.name), file.name);
    const bytes = readFileSync(join(directory!, file.name));
    assert.equal(bytes.length, file.bytes); assert.equal(sha256(bytes), file.sha256);
    return bytes;
  }
  function moves(key: 'corners' | 'centers', count: number) {
    const bytes = read(key), result = new Int32Array(count * SKEWB_MOVE_NAMES.length);
    assert.equal(bytes.length, result.byteLength); new Uint8Array(result.buffer).set(bytes);
    for (const value of result) assert(value >= 0 && value < count);
    return result;
  }
  const product: ProductCoordinateMoves = { firstCount: saved.firstCount, secondCount: saved.secondCount,
    moveCount: SKEWB_MOVE_NAMES.length, firstMoves: moves('corners', saved.firstCount),
    secondMoves: moves('centers', saved.secondCount) };
  const result = fromArrays(product, read('distance'), saved.total);
  assert.deepEqual(result.histogram, saved.histogram);
  return result;
}
