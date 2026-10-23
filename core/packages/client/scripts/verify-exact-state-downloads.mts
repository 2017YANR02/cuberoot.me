/** Read-only streaming integrity check; never constructs a puzzle graph. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream, readFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGunzip } from 'node:zlib';
import type { ExactDownloadAsset, ExactDownloadSet } from './export-exact-state-downloads.mts';
const client = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(resolve(client, 'app/[lang]/scramble/stats/_data/exact-puzzle-downloads.json'), 'utf8')) as {
  puzzles: Record<string, ExactDownloadSet>;
};
const data = JSON.parse(readFileSync(resolve(client, 'app/[lang]/scramble/stats/_data/precomputed-exact-puzzles.json'), 'utf8')) as {
  puzzles: Record<string, { histogram: number[] }>;
};
async function verify(asset: ExactDownloadAsset, histogram: readonly number[], csv: boolean) {
  assert(asset.url.startsWith('/stats/scramble/exact-puzzles/'));
  const file = resolve(client, '../../..', asset.url.slice(1));
  assert(file.startsWith(resolve(client, '../../../stats/scramble/exact-puzzles') + '/'));
  assert.equal(statSync(file).size, asset.bytes);
  const compressedHash = createHash('sha256'), input = createReadStream(file, { highWaterMark: 65536 });
  const unzip = createGunzip({ chunkSize: 65536 });
  input.on('data', chunk => compressedHash.update(chunk));
  input.on('error', error => unzip.destroy(error)); input.pipe(unzip);
  const counts = histogram.map(() => 0);
  let header = !csv, rows = 0, identity = 0, pending = '';
  for await (const chunk of unzip) {
    pending += (chunk as Buffer).toString('utf8');
    assert(pending.length < 2 ** 20, 'Unbounded or malformed export line');
    const lines = pending.split('\n'); pending = lines.pop()!;
    for (const line of lines) {
      if (!header) { assert.equal(line, 'optimal_length,scramble'); header = true; continue; }
      if (csv) {
        const comma = line.indexOf(','), depth = Number(line.slice(0, comma));
        assert(comma > 0 && Number.isInteger(depth) && histogram[depth] > 0);
        assert(!line.slice(comma + 1).includes(','));
        if (!line.slice(comma + 1)) identity++;
        counts[depth]++;
      }
      rows++;
    }
  }
  assert.equal(pending, ''); assert.equal(rows, asset.rows);
  assert.equal(compressedHash.digest('hex'), asset.sha256);
  if (csv) { assert.deepEqual(counts, histogram); assert.equal(identity, 1); }
  return rows;
}
const selected = process.argv.slice(2);
let files = 0, states = 0;
for (const [event, downloads] of Object.entries(manifest.puzzles)) {
  if (selected.length && !selected.includes(event)) continue;
  const histogram = data.puzzles[event]?.histogram;
  assert(histogram, `No completed histogram for ${event}`);
  states += await verify(downloads.allStates, histogram, true); files++;
  for (const [depth, asset] of Object.entries(downloads.byDepth)) {
    assert.equal(asset.rows, histogram[+depth]);
    await verify(asset, histogram, false); files++;
  }
  console.log(JSON.stringify({ event, completed: true, rows: downloads.allStates.rows, files: Object.keys(downloads.byDepth).length + 1 }));
}
console.log(JSON.stringify({ completed: true, files, states, maxRssBytes: process.resourceUsage().maxRSS * 1024 }));
