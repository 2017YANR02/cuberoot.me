/** Completed small distance tables survive a long corpus export interruption. */
import { createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { assertExact, enumerateProductCoordinates, productCoordinateFingerprint,
  type ProductCoordinateMoves } from './exact-coordinate-bfs.mts';

export interface ProductCheckpointOptions {
  /** Reuse the resource guard's original session; never reset its baseline. */
  checkpointDirectory?: string;
}
type Graph = ReturnType<typeof enumerateProductCoordinates>;
interface CompletedCheckpoint {
  format: 'product-coordinate-complete-v1'; complete: true; fingerprint: string;
  distanceFile: string; sha256: string; histogram: number[]; total: number; edgeChecks: number;
  coordinateCount: number;
}
function atomicWrite(filename: string, data: string | Uint8Array) {
  const temporary = `${filename}.${process.pid}.tmp`, descriptor = openSync(temporary, 'w', 0o600);
  try { writeFileSync(descriptor, data); fsyncSync(descriptor); } finally { closeSync(descriptor); }
  renameSync(temporary, filename);
}

/** Only completed, checksummed tables are restored. Invalid checkpoints fail;
 * they never silently trigger another search or reset any resource baseline. */
export function completedProductCoordinates(model: ProductCoordinateMoves, options: ProductCheckpointOptions = {}): Graph {
  if (!options.checkpointDirectory) return enumerateProductCoordinates(model);
  const directory = options.checkpointDirectory, manifest = join(directory, 'product-checkpoint.json');
  const fingerprint = productCoordinateFingerprint(model);
  if (existsSync(manifest)) {
    const saved = JSON.parse(readFileSync(manifest, 'utf8')) as CompletedCheckpoint;
    assertExact(saved.format === 'product-coordinate-complete-v1' && saved.complete === true
      && saved.fingerprint === fingerprint, 'completed coordinate checkpoint does not match this model/code');
    assertExact(saved.coordinateCount === model.firstCount * model.secondCount
      && basename(saved.distanceFile) === saved.distanceFile, 'invalid completed coordinate checkpoint path/size');
    const distance = readFileSync(join(directory, saved.distanceFile));
    assertExact(distance.length === saved.coordinateCount
      && createHash('sha256').update(distance).digest('hex') === saved.sha256, 'completed distance checksum mismatch');
    const histogram: number[] = [], representatives: number[] = [], samplesByDepth: number[][] = [];
    let total = 0;
    for (let state = 0; state < distance.length; state++) {
      const depth = distance[state];
      if (depth === 255) continue;
      histogram[depth] = (histogram[depth] ?? 0) + 1;
      const samples = samplesByDepth[depth] ??= [];
      if (samples.length === 0) representatives[depth] = state;
      if (samples.length < 256) samples.push(state);
      total++;
    }
    assertExact(distance[0] === 0 && histogram[0] === 1 && total === saved.total
      && JSON.stringify(histogram) === JSON.stringify(saved.histogram)
      && saved.edgeChecks === total * model.moveCount, 'completed distance certificate mismatch');
    return { distance, histogram, representatives, samplesByDepth, total, edgeChecks: saved.edgeChecks,
      arrayBytes: distance.byteLength };
  }
  const graph = enumerateProductCoordinates(model);
  const sha256 = createHash('sha256').update(graph.distance).digest('hex');
  const distanceFile = `distance-${sha256}.bin`;
  const saved: CompletedCheckpoint = { format: 'product-coordinate-complete-v1', complete: true, fingerprint,
    distanceFile, sha256, coordinateCount: graph.distance.length, histogram: graph.histogram,
    total: graph.total, edgeChecks: graph.edgeChecks };
  mkdirSync(directory, { recursive: true });
  atomicWrite(join(directory, distanceFile), graph.distance);
  atomicWrite(manifest, `${JSON.stringify(saved, null, 2)}\n`);
  return graph;
}
